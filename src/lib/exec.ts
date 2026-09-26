import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { resolve } from "node:path";
import { shellJoin } from "./argv";

export interface LdRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LdRunResult {
  args: string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError?: string;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;
const MAX_RESULT_BYTES = 50 * 1024;
const MAX_RESULT_LINES = 2_000;

function truncate(s: string): string {
  if (s.length <= MAX_RESULT_BYTES && s.split("\n").length <= MAX_RESULT_LINES) return s;
  const lines = s.split("\n");
  const byLines = lines.length > MAX_RESULT_LINES ? lines.slice(0, MAX_RESULT_LINES).join("\n") : s;
  const out = byLines.length > MAX_RESULT_BYTES ? byLines.slice(0, MAX_RESULT_BYTES) : byLines;
  return `${out}\n... [output truncated by pi-ld]`;
}

function kill(child: { pid?: number; kill(signal?: NodeJS.Signals): boolean }, signal: NodeJS.Signals): void {
  try {
    if (child.pid && process.platform !== "win32") {
      process.kill(-child.pid, signal);
      return;
    }
  } catch {
    // Fall through to killing child directly.
  }
  try {
    child.kill(signal);
  } catch {
    // Process may have exited already.
  }
}

/** Run ldcli with an argv array. Never use a shell or inherit stdin. */
export function runLdcli(args: string[], cwd: string, opts: LdRunOptions = {}): Promise<LdRunResult> {
  const absoluteCwd = resolve(cwd);
  return new Promise((resolveResult) => {
    let child: ChildProcessByStdio<null, Readable, Readable>;
    try {
      child = spawn("ldcli", args, {
        cwd: absoluteCwd,
        env: {
          ...process.env,
          // Never allow a command to open a pager or prompt through the shell.
          PAGER: "cat",
          GIT_PAGER: "cat",
          LESS: "FRX",
          BROWSER: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
    } catch (error) {
      resolveResult({
        args,
        cwd: absoluteCwd,
        exitCode: -1,
        stdout: "",
        stderr: "",
        timedOut: false,
        spawnError: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let killed = false;
    let settled = false;
    const stop = () => {
      if (killed) return;
      killed = true;
      kill(child, "SIGTERM");
      setTimeout(() => kill(child, "SIGKILL"), 1_500).unref?.();
    };
    const timeout = setTimeout(stop, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    timeout.unref?.();
    opts.signal?.addEventListener("abort", stop, { once: true });

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_CAPTURE_BYTES) stdout = stdout.slice(0, MAX_CAPTURE_BYTES);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > MAX_CAPTURE_BYTES) stderr = stderr.slice(0, MAX_CAPTURE_BYTES);
    });

    const finish = (exitCode: number, spawnError?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      opts.signal?.removeEventListener("abort", stop);
      resolveResult({
        args,
        cwd: absoluteCwd,
        exitCode,
        stdout: stdout.slice(0, MAX_CAPTURE_BYTES),
        stderr: truncate(stderr),
        timedOut: killed,
        ...(spawnError ? { spawnError } : {}),
      });
    };
    child.once("error", (error) => finish(-1, error.message));
    child.once("close", (code) => finish(code ?? -1));
  });
}

const SECRET_KEY_RE = /^(?:apiKey|mobileKey|accessToken|access-token|token|secret|sdkKey|clientSideId)$/i;
const SECRET_VALUE_RE = /\b(?:sdk|mob|api)-[A-Za-z0-9-]{16,}\b/g;

/** Recursively remove credentials from LaunchDarkly responses before model output. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "string") return value.replace(SECRET_VALUE_RE, "<redacted>");
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, SECRET_KEY_RE.test(key) ? "<redacted>" : redactSecrets(child)]),
  );
}

function redactText(text: string): string {
  return text
    .replace(/("(?:apiKey|mobileKey|accessToken|access-token|token|secret|sdkKey)"\s*:\s*")[^"]*"/gi, '$1<redacted>"')
    .replace(SECRET_VALUE_RE, "<redacted>");
}

export function renderCommand(args: readonly string[], cwd: string, result: LdRunResult): string {
  const lines = [`$ ldcli ${shellJoin(args)}`, `# cwd=${cwd} exit=${result.exitCode}${result.timedOut ? " (aborted/timed out)" : ""}`];
  if (result.spawnError) lines.push(`--- spawn error ---\n${result.spawnError}`);
  if (result.stdout.trim()) lines.push(`--- stdout ---\n${truncate(redactText(result.stdout)).trimEnd()}`);
  if (result.stderr.trim()) lines.push(`--- stderr ---\n${redactText(result.stderr).trimEnd()}`);
  if (result.spawnError?.includes("ENOENT")) lines.push("--- hint ---\nldcli not found on PATH. Install it, e.g. `brew install launchdarkly/tap/ldcli`.");
  if (/\b401\b|unauthorized/i.test(result.stdout + result.stderr)) lines.push("--- hint ---\nldcli is not authenticated. Run `ldcli login` in a terminal.");
  if (/\b405\b|approval/i.test(result.stdout + result.stderr)) lines.push("--- hint ---\nEnvironment may require an approval request; make the change through LaunchDarkly approvals.");
  return lines.join("\n");
}

export function requireSuccess(result: LdRunResult, label: string): void {
  if (result.exitCode !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`[${label}] ldcli failed\n${renderCommand(result.args, result.cwd, result)}`);
  }
}

export function parseJsonOutput(result: LdRunResult, label: string): unknown {
  requireSuccess(result, label);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`[${label}] ldcli returned invalid JSON\n${renderCommand(result.args, result.cwd, result)}`);
  }
}

export function toolResult(label: string, result: LdRunResult, data: unknown, extra: Record<string, unknown> = {}) {
  const serialized = JSON.stringify(redactSecrets(data), null, 2);
  const text = serialized.length > MAX_RESULT_BYTES
    ? `${serialized.slice(0, MAX_RESULT_BYTES)}\n... [JSON output truncated by pi-ld; narrow query with env/filter/limit]`
    : serialized;
  return {
    content: [{ type: "text" as const, text }],
    details: { label, command: result.args, cwd: result.cwd, ...extra },
  };
}
