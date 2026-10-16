import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createOrbitHandler } from "../supabase/functions/orbit-api/handler.mjs";
test("health accepts the shortened path forwarded by the hosted Edge gateway", async () => {
  const handler = createOrbitHandler({
    url: "https://orbit.supabase.co",
    publicKey: "anon-test",
    fetcher: async () => {
      throw new Error("Health must not fetch user data");
    },
  });
  for (const prefix of ["/orbit-api", "/functions/v1/orbit-api"]) {
    const result = await handler(
      new Request(`https://orbit.supabase.co${prefix}/health`)
    );
    assert.equal(result.status, 200);
    assert.equal((await result.json()).service, "orbit");
  }
});

test("email return page stays on Orbit and clears fragments without external scripts", async () => {
  const handler = createOrbitHandler({
    url: "https://orbit.supabase.co",
    publicKey: "anon-test",
    fetcher: async () => {
      throw new Error("No network expected");
    },
  });
  const response = await handler(
    new Request("https://orbit.supabase.co/orbit-api/auth-complete")
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  const script = /<script>(.*?)<\/script>/.exec(html)[1];
  const hash = createHash("sha256").update(script).digest("base64");
  assert.ok(
    response.headers.get("Content-Security-Policy").includes(`'sha256-${hash}'`)
  );
  assert.ok(script.includes("history.replaceState"));
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.ok(!html.includes("src="));
});
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "alex@example.test",
};
function fixture() {
  const calls = [];
  const handler = createOrbitHandler({
    url: "https://orbit.supabase.co",
    publicKey: "anon-test",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/user")) return Response.json(user);
      if (url.includes("/orbit_profiles"))
        return Response.json([
          {
            id: user.id,
            display_name: "Alex",
            bio: "",
            profile_visibility: "PRIVATE",
          },
        ]);
      if (url.includes("/rpc/"))
        return Response.json([
          {
            id: "game-id",
            shop: "steam",
            object_id: "10",
            payload: { title: "Demo" },
            created_at: "2026-10-16",
          },
        ]);
      return Response.json([]);
    },
  });
  const request = (path, method = "GET", data, token = "user-token") =>
    handler(
      new Request("https://orbit.supabase.co/functions/v1/orbit-api" + path, {
        method,
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      })
    );
  return { calls, request };
}
test("no private database access without verified authentication", async () => {
  const f = fixture();
  assert.equal(
    (await f.request("/profile/me", "GET", undefined, null)).status,
    401
  );
  assert.equal(f.calls.length, 0);
});

test("an Auth 403 is normalized to an expired session without touching the database", async () => {
  let calls = 0;
  const handler = createOrbitHandler({
    url: "https://orbit.supabase.co",
    publicKey: "anon-test",
    fetcher: async () => {
      calls++;
      return Response.json({ message: "invalid token" }, { status: 403 });
    },
  });
  const response = await handler(
    new Request("https://orbit.supabase.co/orbit-api/profile/me", {
      headers: { Authorization: "Bearer invalid" },
    })
  );
  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});
test("profile is projected for Orbit and never returns a credential or subscription grant", async () => {
  const f = fixture();
  const response = await f.request("/profile/me");
  const data = await response.json();
  assert.equal(data.id, user.id);
  assert.equal(data.displayName, "Alex");
  assert.equal(data.subscription, null);
  assert.equal(data.workwondersJwt, "");
  assert.ok(
    f.calls.every((call) => call.url.startsWith("https://orbit.supabase.co/"))
  );
  assert.ok(
    f.calls.every(
      (call) => call.init.headers.Authorization === "Bearer user-token"
    )
  );
});
test("game batches use atomic user-scoped RPC and ignore client-selected ownership", async () => {
  const f = fixture();
  const response = await f.request("/profile/games/batch", "POST", [
    { shop: "steam", objectId: "10", owner_id: "victim", id: "fake" },
  ]);
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0].id, "game-id");
  assert.ok(f.calls[1].url.endsWith("/rest/v1/rpc/orbit_merge_games"));
});
test("invalid batches and oversized bodies do not reach the database", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.request("/profile/games/batch", "POST", [
        { shop: "invalid", objectId: "10" },
      ])
    ).status,
    400
  );
  assert.equal(f.calls.length, 1);
  assert.equal(
    (await f.request("/profile", "PATCH", { bio: "x".repeat(300000) })).status,
    413
  );
  assert.equal(f.calls.length, 2);
});
test("library pagination is bounded and owner-scoped", async () => {
  const f = fixture();
  await f.request("/profile/games?take=5000&skip=-5");
  assert.ok(f.calls[1].url.includes("owner_id=eq." + user.id));
  assert.ok(f.calls[1].url.includes("limit=100"));
  assert.ok(f.calls[1].url.includes("offset=0"));
});

test("new games and playtime deltas use the existing client contracts", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.request("/profile/games", "POST", {
        shop: "steam",
        objectId: "10",
        title: "Demo",
      })
    ).status,
    200
  );
  assert.equal(
    (
      await f.request("/profile/games/steam/10", "PUT", {
        playTimeDeltaInSeconds: 12,
        lastTimePlayed: "2026-10-16T20:00:00Z",
      })
    ).status,
    200
  );
  assert.ok(f.calls.at(-1).url.endsWith("/rpc/orbit_add_playtime"));
  assert.equal(JSON.parse(f.calls.at(-1).init.body).delta_seconds, 12);
  assert.equal(
    (
      await f.request("/profile/games/steam/10", "PUT", {
        playTimeDeltaInSeconds: -5,
        lastTimePlayed: "2026-10-16",
      })
    ).status,
    400
  );
});
test("unsupported cloud/social routes fail explicitly with no Hydra fallback", async () => {
  const f = fixture();
  const response = await f.request("/profile/friend-requests");
  assert.equal(response.status, 501);
  assert.equal((await response.json()).code, "orbit-service-pending");
  assert.equal(f.calls.length, 1);
});
test("upstream failure details and credentials never reach the renderer", async () => {
  const handler = createOrbitHandler({
    url: "https://orbit.supabase.co",
    publicKey: "anon-test",
    fetcher: async () => {
      throw new Error("secret-canary");
    },
  });
  const response = await handler(
    new Request("https://orbit.supabase.co/profile/me", {
      headers: { Authorization: "Bearer secret-token" },
    })
  );
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("secret"));
});
