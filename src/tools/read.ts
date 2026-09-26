import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { assertSafeKey, flagEq, pushOpt } from "../lib/argv";
import { parseJsonOutput, runLdcli, toolResult } from "../lib/exec";

const ListParams = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, description: "Maximum number of resources to return." })),
  offset: Type.Optional(Type.Integer({ minimum: 0, description: "Pagination offset." })),
  filter: Type.Optional(Type.String({ description: "ldcli filter expression." })),
  sort: Type.Optional(Type.String({ description: "ldcli sort expression." })),
});

type ListParamsValue = {
  limit?: number;
  offset?: number;
  filter?: string;
  sort?: string;
};

function listArgs(command: string[], params: ListParamsValue): string[] {
  const args = [...command, "--output=json", "--analytics-opt-out"];
  pushOpt(args, "--limit", params.limit);
  pushOpt(args, "--offset", params.offset);
  pushOpt(args, "--filter", params.filter);
  pushOpt(args, "--sort", params.sort);
  return args;
}

export function registerProjectsList(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_projects_list",
    label: "LaunchDarkly: list projects",
    description: "List LaunchDarkly projects through `ldcli`. Read-only. Use project keys returned here with other LaunchDarkly tools.",
    promptSnippet: "launchdarkly_projects_list: list LaunchDarkly projects",
    parameters: ListParams,
    async execute(_id, params, signal, _onUpdate, ctx) {
      const args = listArgs(["projects", "list"], params);
      const result = await runLdcli(args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_projects_list");
      return toolResult("launchdarkly_projects_list", result, data);
    },
  });
}

const ProjectParams = Type.Object({
  project: Type.String({ description: "LaunchDarkly project key." }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  filter: Type.Optional(Type.String({ description: "ldcli filter expression." })),
  sort: Type.Optional(Type.String({ description: "ldcli sort expression." })),
});

export function registerEnvironmentsList(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_environments_list",
    label: "LaunchDarkly: list environments",
    description: "List environments in a LaunchDarkly project through `ldcli`. Read-only.",
    promptSnippet: "launchdarkly_environments_list: list environments for project",
    parameters: ProjectParams,
    async execute(_id, params, signal, _onUpdate, ctx) {
      const project = assertSafeKey(params.project, "project");
      const args = listArgs(["environments", "list", flagEq("--project", project)], params);
      const result = await runLdcli(args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_environments_list");
      return toolResult("launchdarkly_environments_list", result, data, { project });
    },
  });
}

export function registerSegmentsList(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_segments_list",
    label: "LaunchDarkly: list segments",
    description: "List segments in a LaunchDarkly project through `ldcli`. Read-only.",
    promptSnippet: "launchdarkly_segments_list: list segments for project",
    parameters: ProjectParams,
    async execute(_id, params, signal, _onUpdate, ctx) {
      const project = assertSafeKey(params.project, "project");
      const args = listArgs(["segments", "list", flagEq("--project", project)], params);
      const result = await runLdcli(args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_segments_list");
      return toolResult("launchdarkly_segments_list", result, data, { project });
    },
  });
}

const FlagsListParams = Type.Object({
  project: Type.String({ description: "LaunchDarkly project key." }),
  env: Type.Optional(Type.String({ description: "Only return flag configuration for this environment key." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  filter: Type.Optional(Type.String({ description: "ldcli flag filter expression, for example `query:checkout,state:live`." })),
  sort: Type.Optional(Type.String({ description: "ldcli sort expression." })),
  tag: Type.Optional(Type.String({ description: "Return flags with this tag." })),
  summary: Type.Optional(Type.Boolean({ description: "Set false to include full targeting rules when env is supplied." })),
});

type FlagsListValue = {
  project: string;
  env?: string;
  limit?: number;
  offset?: number;
  filter?: string;
  sort?: string;
  tag?: string;
  summary?: boolean;
};

export function registerFlagsList(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_flags_list",
    label: "LaunchDarkly: list flags",
    description: "List feature flags in a LaunchDarkly project through `ldcli`. Read-only. Use env when configuration for one environment is needed.",
    promptSnippet: "launchdarkly_flags_list: list feature flags",
    parameters: FlagsListParams,
    async execute(_id, params: FlagsListValue, signal, _onUpdate, ctx) {
      const project = assertSafeKey(params.project, "project");
      const args = ["flags", "list", flagEq("--project", project), "--output=json", "--analytics-opt-out"];
      pushOpt(args, "--env", params.env ? assertSafeKey(params.env, "env") : undefined);
      pushOpt(args, "--limit", params.limit);
      pushOpt(args, "--offset", params.offset);
      pushOpt(args, "--filter", params.filter);
      pushOpt(args, "--sort", params.sort);
      pushOpt(args, "--tag", params.tag);
      if (params.summary !== undefined) pushOpt(args, "--summary", params.summary ? "1" : "0");
      const result = await runLdcli(args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_flags_list");
      return toolResult("launchdarkly_flags_list", result, data, { project, env: params.env });
    },
  });
}
