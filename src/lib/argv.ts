/**
 * Argv hardening for ldcli (cobra/pflag).
 *
 * Every caller-supplied value is emitted as a single `--flag=value` token so a
 * value that starts with `-` is bound literally and can never be reparsed as a
 * separate option. Keys (project / flag / env / segment) are additionally
 * validated to a conservative character set.
 */

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:\-]*$/;
const MAX_KEY_LEN = 256;

export function assertSafeKey(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (value.length > MAX_KEY_LEN) {
    throw new Error(`${label} is too long (max ${MAX_KEY_LEN} chars).`);
  }
  if (!KEY_RE.test(value)) {
    throw new Error(
      `${label} has invalid characters (got ${JSON.stringify(value)}). ` +
        `Allowed: letters, digits, '.', '_', ':', '-' and it must not start with '-'.`,
    );
  }
  return value;
}

/** Option name used by ld_read passthrough params. */
const OPTION_NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Options callers may never set: auth, endpoint, output shape, request body. */
export const FORBIDDEN_OPTIONS = new Set([
  "access-token",
  "base-uri",
  "output",
  "o",
  "json",
  "data",
  "d",
  "help",
  "h",
  "analytics-opt-out",
  "dry-run",
]);

export function assertSafeOptionName(name: string): string {
  if (!OPTION_NAME_RE.test(name)) {
    throw new Error(`Invalid option name ${JSON.stringify(name)}. Use lowercase kebab-case without leading dashes.`);
  }
  if (FORBIDDEN_OPTIONS.has(name)) {
    throw new Error(`Option --${name} is managed by pi-ld and cannot be passed.`);
  }
  return name;
}

export function flagEq(flag: string, value: string | number | boolean): string {
  if (!/^--[a-z][a-z0-9-]*$/.test(flag)) {
    throw new Error(`flagEq: bad flag ${flag}`);
  }
  const s = String(value);
  if (/\0/.test(s)) {
    throw new Error(`Value for ${flag} must not contain NUL.`);
  }
  return `${flag}=${s}`;
}

/** Push `--flag=value` only when value is defined and non-empty. */
export function pushOpt(args: string[], flag: string, value: string | number | boolean | undefined): void {
  if (value === undefined || value === "") return;
  args.push(flagEq(flag, value));
}

export function shellQuote(arg: string): string {
  if (arg.length === 0) return "''";
  if (/^[A-Za-z0-9_=:,.@\/+\-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function shellJoin(args: readonly string[]): string {
  return args.map(shellQuote).join(" ");
}
