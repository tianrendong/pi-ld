# pi-ld

Pi extension and optional Agent Skill for LaunchDarkly. Uses official `ldcli` CLI instead of embedding LaunchDarkly API credentials or HTTP logic.

## Requirements

- Pi 0.87 or later
- `ldcli` installed and available on `PATH`
- Authenticated `ldcli` session (`ldcli login`) or configured token

Check setup:

```sh
ldcli --version
ldcli config --list
```

## Install

From local checkout:

```sh
pi install ./pi-ld
```

From npm or git after publishing:

```sh
pi install npm:pi-ld
# or: pi install git:github.com/ORG/pi-ld
```

Package manifest loads extension and skill together. To load extension for one invocation:

```sh
pi -e ./src/index.ts
```

To load optional skill separately:

```sh
pi --skill ./skills/launchdarkly
```

## Tools

Read-only:

- `launchdarkly_projects_list`
- `launchdarkly_environments_list`
- `launchdarkly_segments_list`
- `launchdarkly_flags_list`
- `launchdarkly_flag_get`
- `launchdarkly_flag_status`

Mutating, confirmation-gated:

- `launchdarkly_flag_toggle` — turn flag on/off in one environment
- `launchdarkly_flag_update` — apply semantic patch, JSON Patch, or JSON Merge Patch

Mutating tools reject non-dry-run calls unless `confirm: true`. Prefer `dryRun: true`, then inspect state again after applying.

## Security model

- Commands execute with `spawn("ldcli", argv)`; no shell interpolation.
- Project, flag, and environment keys reject option-like/injected values.
- Output is forced to JSON and analytics opt-out is passed to `ldcli`.
- Access tokens remain in `ldcli` configuration/environment and are never tool parameters.
- Large output is bounded; narrow queries with `env`, `filter`, or `limit`.

## Development

```sh
npm run check
npm test
```

Example read call:

```text
launchdarkly_flags_list({project: "my-project", env: "production", limit: 20})
```

Example safe flag toggle:

```text
launchdarkly_flag_toggle({
  project: "my-project",
  flag: "new-checkout",
  environment: "production",
  on: true,
  dryRun: true
})
```

Then apply only with explicit authorization and `confirm: true`.
