import assert from "node:assert/strict";
import test from "node:test";
import { apiDestination, orbitProjectConfig } from "./orbit-api-policy.js";

test("public metadata and independent source utilities stay on Hydra without identity", () => {
  for (const path of [
    "/catalogue/featured",
    "/catalogue/search/suggestions?query=Halo",
    "/games/steam/10/assets",
    "/games/epic/abc/achievements",
    "/games/launchbox/abc-123",
    "/games/steam/10/download-sources",
    "/decky/release",
  ])
    assert.equal(apiDestination("GET", path), "hydra-public");
  for (const path of [
    "/catalogue/search",
    "/games/shop-details",
    "/download-sources",
    "/download-sources/sync",
    "/hosters/availability",
  ])
    assert.equal(apiDestination("POST", path), "hydra-public");
});
test("identity, social data, flags and all account mutations stay on Orbit", () => {
  for (const path of [
    "/auth/refresh",
    "/profile/me",
    "/profile/games",
    "/users/A",
    "/notifications",
    "/features",
    "/games/steam/10/reviews",
    "/games/steam/10/download",
    "/download-sources/changes",
  ])
    for (const method of ["GET", "POST", "PATCH", "DELETE"])
      assert.equal(apiDestination(method, path), "orbit");
  assert.equal(apiDestination("DELETE", "/catalogue/search"), "orbit");
});
test("API paths cannot escape routing through absolute URLs or normalization", () => {
  for (const path of [
    "https://evil.test/profile",
    "//evil.test/catalogue",
    "/catalogue/../profile",
    "/catalogue/%2e%2e/profile",
    "/catalogue\\profile",
    "/catalogue#profile",
    "/catalogue\r\n/profile",
  ])
    assert.throws(() => apiDestination("GET", path));
});
test("Orbit requires its own configured secure project and a public key", () => {
  assert.equal(orbitProjectConfig("", ""), null);
  assert.equal(
    orbitProjectConfig("https://my-orbit.supabase.co", "sb_publishable_test")
      ?.api,
    "https://my-orbit.supabase.co/functions/v1/orbit-api"
  );
  for (const url of [
    "http://my-orbit.supabase.co",
    "https://supabase.co.evil.test",
    "https://user:pass@my-orbit.supabase.co",
    "https://my-orbit.supabase.co/path",
  ])
    assert.throws(() => orbitProjectConfig(url, "sb_publishable_test"));
  for (const key of [
    "sb_secret_canary",
    "password",
    `x.${btoa(JSON.stringify({ role: "service_role" }))}.x`,
  ])
    assert.throws(() =>
      orbitProjectConfig("https://my-orbit.supabase.co", key)
    );
});
