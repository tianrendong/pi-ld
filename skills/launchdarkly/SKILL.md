---
name: launchdarkly
description: Inspect and safely manage LaunchDarkly projects, environments, feature flags, and segments through pi-ld tools backed by the ldcli CLI. Use when a task involves LaunchDarkly flag state, targeting, rollouts, or flag changes.
compatibility: Requires authenticated `ldcli` on PATH. Run `ldcli login` or configure its access token before using tools.
---

# LaunchDarkly operations

Use pi-ld tools instead of constructing ad-hoc LaunchDarkly API calls.

## Read workflow

1. Use `launchdarkly_projects_list` if project key is unknown.
2. Use `launchdarkly_environments_list` to resolve environment keys.
3. Use `launchdarkly_flags_list` to find flags. Narrow with `env`, `filter`, `tag`, or `limit`.
4. Use `launchdarkly_flag_get` before discussing or changing targeting. Use `launchdarkly_flag_status` for cross-environment status.

Always distinguish project key, flag key, and environment key. Names are not necessarily keys.

## Change workflow

1. Inspect current state with `launchdarkly_flag_get`.
2. Explain intended project, flag, environment, operation, and expected result.
3. Preview with `launchdarkly_flag_toggle({dryRun:true})` or `launchdarkly_flag_update({dryRun:true})`.
4. Apply only when user explicitly authorized the exact change, passing `confirm:true`.
5. Read the flag again and report resulting state.

`launchdarkly_flag_update` accepts JSON semantic patches, JSON Patch arrays, and JSON Merge Patch objects as `data`. Use semantic patches for common operations such as `turnFlagOn`, `turnFlagOff`, and targeting instructions. Retrieve variation, rule, and clause IDs from `launchdarkly_flag_get`; never invent IDs.

## Safety

- Read tools are `launchdarkly_projects_list`, `launchdarkly_environments_list`, `launchdarkly_segments_list`, `launchdarkly_flags_list`, `launchdarkly_flag_get`, and `launchdarkly_flag_status`.
- Mutation tools are `launchdarkly_flag_toggle` and `launchdarkly_flag_update`.
- `confirm:true` is required for non-dry-run mutation. Do not use it to infer consent.
- Never expose or print access tokens. Authentication belongs to `ldcli`.
- Use smallest useful query: specify `env`, filter, and limit to avoid dumping large flag payloads.
