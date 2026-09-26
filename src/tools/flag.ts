import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { assertSafeKey, flagEq, pushOpt } from "../lib/argv";
import { parseJsonOutput, runLdcli, toolResult } from "../lib/exec";

const FlagParams = Type.Object({
  project: Type.String({ description: "LaunchDarkly project key." }),
  flag: Type.String({ description: "Feature flag key." }),
  env: Type.Optional(Type.String({ description: "Only return this environment's configuration." })),
  expand: Type.Optional(Type.String({ description: "Comma-separated ldcli expansion, such as `evaluation`." })),
});

type FlagParamsValue = {
  project: string;
  flag: string;
  env?: string;
  expand?: string;
};

function flagReadArgs(command: string, params: FlagParamsValue): { args: string[]; project: string; flag: string; env?: string } {
  const project = assertSafeKey(params.project, "project");
  const flag = assertSafeKey(params.flag, "flag");
  const env = params.env === undefined ? undefined : assertSafeKey(params.env, "env");
  const args = [
    "flags",
    command,
    flagEq("--project", project),
    flagEq("--flag", flag),
    "--output=json",
    "--analytics-opt-out",
  ];
  pushOpt(args, "--env", env);
  pushOpt(args, "--expand", params.expand);
  return { args, project, flag, env };
}

export function registerFlagGet(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_flag_get",
    label: "LaunchDarkly: get flag",
    description: "Get one feature flag and its targeting configuration through `ldcli`. Read-only. Use env to limit output to one environment.",
    promptSnippet: "launchdarkly_flag_get: inspect one feature flag",
    parameters: FlagParams,
    async execute(_id, params: FlagParamsValue, signal, _onUpdate, ctx) {
      const input = flagReadArgs("get", params);
      const result = await runLdcli(input.args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_flag_get");
      return toolResult("launchdarkly_flag_get", result, data, input);
    },
  });
}

export function registerFlagStatus(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_flag_status",
    label: "LaunchDarkly: flag status",
    description: "Get a feature flag's status across environments through `ldcli`. Read-only.",
    promptSnippet: "launchdarkly_flag_status: inspect flag status across environments",
    parameters: Type.Object({
      project: Type.String({ description: "LaunchDarkly project key." }),
      flag: Type.String({ description: "Feature flag key." }),
      env: Type.Optional(Type.String({ description: "Optional environment key filter." })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const project = assertSafeKey(params.project, "project");
      const flag = assertSafeKey(params.flag, "flag");
      const env = params.env === undefined ? undefined : assertSafeKey(params.env, "env");
      const args = [
        "flags",
        "get-status-across-environments",
        flagEq("--project", project),
        flagEq("--flag", flag),
        "--output=json",
        "--analytics-opt-out",
      ];
      pushOpt(args, "--env", env);
      const result = await runLdcli(args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_flag_status");
      return toolResult("launchdarkly_flag_status", result, data, { project, flag, env });
    },
  });
}
