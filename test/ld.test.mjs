import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { loadTool, mockCommands } from "./helpers.mjs";

const flags = await loadTool("../src/tools/read.ts", "registerFlagsList");
const toggle = await loadTool("../src/tools/mutate.ts", "registerFlagToggle");
const update = await loadTool("../src/tools/mutate.ts", "registerFlagUpdate");
const cwd = resolve(".");
const ctx = { cwd };

test("flag list uses fixed JSON output and safe argv", async (t) => {
  const calls = mockCommands(t, ({ args }) => {
    assert.equal(args[0], "flags");
    assert.equal(args[1], "list");
    assert.ok(args.includes("--project=my-project"));
    assert.ok(args.includes("--env=production"));
    assert.ok(args.includes("--output=json"));
    assert.ok(args.includes("--analytics-opt-out"));
    return { stdout: JSON.stringify({ items: [{ key: "checkout" }] }) };
  });
  const result = await flags.execute("id", { project: "my-project", env: "production", limit: 10 }, undefined, undefined, ctx);
  assert.deepEqual(JSON.parse(result.content[0].text), { items: [{ key: "checkout" }] });
  assert.equal(calls.length, 1);
});

test("mutations require confirmation unless dry-run", async (t) => {
  const calls = mockCommands(t, () => ({ stdout: "{}" }));
  await assert.rejects(
    toggle.execute("id", { project: "p", flag: "f", environment: "production", on: true }, undefined, undefined, ctx),
    /confirm:true/,
  );
  assert.equal(calls.length, 0);
});

test("toggle dry-run invokes correct ldcli command", async (t) => {
  const calls = mockCommands(t, ({ args }) => {
    assert.deepEqual(args.slice(0, 2), ["flags", "toggle-on"]);
    assert.ok(args.includes("--dry-run"));
    return { stdout: JSON.stringify({ preview: true }) };
  });
  const result = await toggle.execute("id", {
    project: "p",
    flag: "f",
    environment: "production",
    on: true,
    dryRun: true,
  }, undefined, undefined, ctx);
  assert.deepEqual(JSON.parse(result.content[0].text), { preview: true });
  assert.equal(calls.length, 1);
});

test("update rejects invalid JSON before spawning ldcli", async (t) => {
  const calls = mockCommands(t, () => ({ stdout: "{}" }));
  await assert.rejects(
    update.execute("id", { project: "p", flag: "f", data: "not-json", dryRun: true }, undefined, undefined, ctx),
    /valid JSON/,
  );
  assert.equal(calls.length, 0);
});

test("flag keys cannot inject options", async (t) => {
  const calls = mockCommands(t, () => ({ stdout: "{}" }));
  await assert.rejects(
    flags.execute("id", { project: "--help" }, undefined, undefined, ctx),
    /invalid characters/,
  );
  assert.equal(calls.length, 0);
});
