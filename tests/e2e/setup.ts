/**
 * E2E global hooks — after each test: delete queued game sessions first, then queued `UserAccount` rows.
 */
import { afterEach } from "vitest";
import { flushScheduledTestGalaxyDeletions, flushScheduledTestUserDeletions } from "./helpers";

afterEach(async () => {
  await flushScheduledTestGalaxyDeletions();
  await flushScheduledTestUserDeletions();
});
