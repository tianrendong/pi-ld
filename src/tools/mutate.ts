import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { assertSafeKey, flagEq, pushOpt } from "../lib/argv";
import { parseJsonOutput, runLdcli, toolResult } from "../lib/exec";

function requireMutationConfirmation(confirm: boolean | undefined, dryRun: boolean | undefined, operation: string): void {
  if (!dryRun && confirm !== true) {
    throw new Error(
      `Refused: ${operation} changes LaunchDarkly state. Pass confirm:true to apply it, or use dryRun:true to preview it.`,
    );
  }
}

const ToggleParams = Type.Object({
  project: Type.String({ description: "LaunchDarkly project key." }),
  flag: Type.String({ description: "Feature flag key." }),
  environment: Type.String({ description: "Environment key to change." }),
  on: Type.Boolean({ description: "Whether targeting should be on." }),
  dryRun: Type.Optional(Type.Boolean({ description: "Validate and preview without persisting the change." })),
  confirm: Type.Optional(Type.Boolean({ description: "Required true before applying a remote change." })),
});

export function registerFlagToggle(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_flag_toggle",
    label: "LaunchDarkly: toggle flag",
    description:
      "Turn a feature flag on or off in one environment through `ldcli`. Remote mutation is blocked unless confirm:true; use dryRun:true to preview without applying.",
    promptSnippet: "launchdarkly_flag_toggle: safely turn flag on or off",
    promptGuidelines: [
      "Inspect the flag with launchdarkly_flag_get before changing it.",
      "For a remote change, state project, flag, environment, desired state, and confirmation before passing confirm:true.",
    ],
    parameters: ToggleParams,
    async execute(_id, params, signal, _onUpdate, ctx) {
      requireMutationConfirmation(params.confirm, params.dryRun, "launchdarkly_flag_toggle");
      const project = assertSafeKey(params.project, "project");
      const flag = assertSafeKey(params.flag, "flag");
      const environment = assertSafeKey(params.environment, "environment");
      const args = [
        "flags",
        params.on ? "toggle-on" : "toggle-off",
        flagEq("--project", project),
        flagEq("--flag", flag),
        flagEq("--environment", environment),
        "--output=json",
        "--analytics-opt-out",
      ];
      if (params.dryRun) args.push("--dry-run");
      const result = await runLdcli(args, ctx.cwd, { signal });
      const data = parseJsonOutput(result, "launchdarkly_flag_toggle");
      return toolResult("launchdarkly_flag_toggle", result, data, {
        project,
        flag,
        environment,
        on: params.on,
        dryRun: params.dryRun === true,
      });
    },
  });
}

const UpdateParams = Type.Object({
  project: Type.String({ description: "LaunchDarkly project key." }),
  flag: Type.String({ description: "Feature flag key." }),
  data: Type.String({
    description:
      "JSON semantic patch, JSON Patch array, or JSON Merge Patch object accepted by ldcli. Example semantic patch: {\"environmentKey\":\"production\",\"instructions\":[{\"kind\":\"turnFlagOn\"}]}.",
  }),
  semanticPatch: Type.Optional(Type.Boolean({ description: "Send data as a LaunchDarkly semantic patch." })),
  dryRun: Type.Optional(Type.Boolean({ description: "Validate and preview without persisting the change." })),
  confirm: Type.Optional(Type.Boolean({ description: "Required true before applying a remote change." })),
});

export function registerFlagUpdate(pi: ExtensionAPI) {
  pi.registerTool({
    name: "launchdarkly_flag_update",
    label: "LaunchDarkly: update flag",
    description:
      "Apply a JSON semantic patch, JSON Patch, or JSON Merge Patch to a feature flag through `ldcli`. Remote mutation is blocked unless confirm:true; use dryRun:true to preview without applying.",
    promptSnippet: "launchdarkly_flag_update: safely patch feature flag",
    promptGuidelines: [
      "Inspect the flag with launchdarkly_flag_get first; use IDs and environment keys from its response.",
      "Prefer dryRun:true before applying any patch. Pass confirm:true only after intended project, flag, environment, and patch are explicit.",
    ],
    parameters: UpdateParams,
    async execute(_id, params, signal, _onUpdate, ctx) {
      requireMutationConfirmation(params.confirm, params.dryRun, "launchdarkly_flag_update");
      const project = assertSafeKey(params.project, "project");
      const flag = assertSafeKey(params.flag, "flag");
      if (params.data.length > 1_000_000) throw new Error("data is too large (max 1,000,000 characters).");
      let data: string;
      try {
        JSON.parse(params.data);
        data = params.data;
      } catch {
        throw new Error("data must be valid JSON.");
      }
      const args = [
        "flags",
        "update",
        flagEq("--project", project),
        flagEq("--flag", flag),
        flagEq("--data", data),
        "--output=json",
        "--analytics-opt-out",
      ];
      if (params.semanticPatch) args.push("--semantic-patch");
      if (params.dryRun) pushOpt(args, "--dry-run", "true");
      const result = await runLdcli(args, ctx.cwd, { signal });
      const output = parseJsonOutput(result, "launchdarkly_flag_update");
      return toolResult("launchdarkly_flag_update", result, output, {
        project,
        flag,
        semanticPatch: params.semanticPatch === true,
        dryRun: params.dryRun === true,
      });
    },
  });
}
