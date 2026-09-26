import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerEnvironmentsList, registerFlagsList, registerProjectsList, registerSegmentsList } from "./tools/read";
import { registerFlagGet, registerFlagStatus } from "./tools/flag";
import { registerFlagToggle, registerFlagUpdate } from "./tools/mutate";

/**
 * pi-ld — LaunchDarkly tools backed by the official `ldcli` executable.
 *
 * Read workflow: projects → environments → flags list → flag get/status.
 * Change workflow: flag get → dry-run toggle/update → confirmed change.
 *
 * This extension never receives or prints access tokens. Authentication stays
 * in ldcli's own config/environment and all subprocesses use argv arrays.
 */
export default function (pi: ExtensionAPI) {
  registerProjectsList(pi);
  registerEnvironmentsList(pi);
  registerSegmentsList(pi);
  registerFlagsList(pi);
  registerFlagGet(pi);
  registerFlagStatus(pi);
  registerFlagToggle(pi);
  registerFlagUpdate(pi);
}
