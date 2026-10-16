import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-ignore Node ESM source import.
import { readXboxOAuthCallback } from "./oauth-callback.ts";

const redirect = "https://login.live.com/oauth20_desktop.srf";
describe("Xbox OAuth callback", () => {
  it("accepts only the matching callback and state", () => {
    assert.equal(
      readXboxOAuthCallback(
        `${redirect}?state=expected&code=abc`,
        "expected",
        redirect
      ),
      "abc"
    );
    for (const value of [
      `${redirect}?code=abc`,
      `${redirect}?state=wrong&code=abc`,
      `${redirect}?state=expected&error=access_denied`,
      `${redirect}?state=expected`,
    ])
      assert.throws(
        () => readXboxOAuthCallback(value, "expected", redirect),
        /auth/
      );
  });
  it("does not mistake an unrelated or lookalike URL for the callback", () => {
    for (const value of [
      "https://login.live.com.evil.test/oauth20_desktop.srf",
      "http://login.live.com/oauth20_desktop.srf",
      "https://login.live.com/other",
    ])
      assert.equal(
        readXboxOAuthCallback(
          `${value}?state=expected&code=abc`,
          "expected",
          redirect
        ),
        null
      );
  });
});
