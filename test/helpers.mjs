import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import { after, mock } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
let active;

const mockedSpawn = mock.method(childProcess, "spawn", (command, args, options) => {
  assert.equal(command, "ldcli");
  assert.equal(options.stdio[0], "ignore");
  assert.equal(options.env.PAGER, "cat");
  assert.equal(options.env.BROWSER, "true");
  assert.ok(active, "No command scenario installed");
  const call = { command, args: [...args], cwd: options.cwd };
  active.calls.push(call);
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: () => true,
  });
  Promise.resolve().then(() => active.handler(call)).then(
    ({ stdout = "", stderr = "", code = 0 } = {}) => {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit("close", code);
    },
    (error) => child.emit("error", error),
  );
  return child;
});
syncBuiltinESMExports();

after(() => {
  mockedSpawn.mock.restore();
  syncBuiltinESMExports();
});

export async function loadTool(module, name) {
  const exports = await jiti.import(module);
  let tool;
  exports[name]({ registerTool: (definition) => { tool = definition; } });
  assert.ok(tool);
  return tool;
}

export function mockCommands(t, handler) {
  assert.equal(active, undefined);
  const calls = [];
  active = { calls, handler };
  t.after(() => { active = undefined; });
  return calls;
}
