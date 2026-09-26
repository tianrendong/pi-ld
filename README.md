# pi-ld

Check and change LaunchDarkly feature flags from pi.

- **Ask:** "Is `new-checkout` on in prod?" "Which flags are tagged `payments`?"
- **Change safely:** pi can dry-run a change first. Nothing goes live without explicit confirmation.
- **No new secrets:** uses your existing `ldcli` login. pi never sees tokens.

## Setup

```sh
ldcli login          # https://github.com/launchdarkly/ldcli
pi install npm:pi-ld
```
