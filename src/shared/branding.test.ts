import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-ignore Node's test runner resolves the TypeScript source extension.
import { isAppDeepLink, isRunDeepLink } from "./branding.ts";

describe("Orbit deep links and Hydra compatibility", () => {
  it("accepts Orbit links and existing Hydra links without accepting unrelated schemes", () => {
    for (const scheme of ["orbitlauncher", "hydralauncher"]) {
      assert.equal(
        isAppDeepLink(`${scheme}://run?shop=steam&objectId=123`),
        true
      );
      assert.equal(
        isRunDeepLink(`${scheme}://run?shop=steam&objectId=123`),
        true
      );
      assert.equal(
        isAppDeepLink(`${scheme}://install-theme?theme=example`),
        true
      );
    }
    for (const value of [
      "https://run",
      "file://run",
      "orbitlauncher-evil://run",
      "not a URL",
    ]) {
      assert.equal(isAppDeepLink(value), false);
      assert.equal(isRunDeepLink(value), false);
    }
  });

  it("does not treat other routes as a game launch that suppresses the main window", () => {
    for (const scheme of ["orbitlauncher", "hydralauncher"]) {
      for (const route of [
        "running",
        "run-evil",
        "auth",
        "profile",
        "steam-connected",
        "install-source",
      ]) {
        assert.equal(isRunDeepLink(`${scheme}://${route}`), false);
      }
    }
    assert.equal(isRunDeepLink(undefined), false);
  });
});
