import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-account-"));
  const id = "orbit" + randomUUID();
  const values = new Map();
  const requests: any[] = [];
  const state = { values, requests, secure: true, reply: {} as any };
  Reflect.set(globalThis, id, state);
  const stub: Record<string, string> = {
    electron: `export const safeStorage = { isEncryptionAvailable:()=>state.secure, getSelectedStorageBackend:()=> 'keyring', encryptString:value=>Buffer.from('encrypted:'+value), decryptString:value=>value.toString().slice(10) };`,
    axios: `export default {request:async config=>{state.requests.push(config);return {data:state.reply}}};`,
    "@main/level": `export const db = {getMany:async keys=>keys.map(key=>state.values.get(key)),put:async(key,value)=>state.values.set(key,value),del:async key=>state.values.delete(key)};`,
  };
  const target = path.join(root, "service.mjs");
  await build({
    entryPoints: ["src/main/services/orbit-account.ts"],
    outfile: target,
    bundle: true,
    platform: "node",
    format: "esm",
    define: {
      "import.meta.env.MAIN_VITE_ORBIT_SUPABASE_URL": JSON.stringify(
        "https://orbit-test.supabase.co"
      ),
      "import.meta.env.MAIN_VITE_ORBIT_SUPABASE_KEY": JSON.stringify(
        "sb_publishable_test"
      ),
    },
    plugins: [
      {
        name: "boundary",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(stub, args.path)
              ? { path: args.path, namespace: "stub" }
              : undefined
          );
          builder.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
            contents:
              `const state=globalThis[${JSON.stringify(id)}];` +
              stub[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  t.after(async () => {
    Reflect.deleteProperty(globalThis, id);
    await fs.rm(root, { recursive: true, force: true });
  });
  return {
    state,
    service: (await import(
      pathToFileURL(target).href
    )) as typeof import("./orbit-account"),
  };
}
test("Orbit encrypted credentials never overwrite or load the legacy Hydra session", async (t) => {
  const { state, service } = await fixture(t);
  state.values.set("auth", { accessToken: "hydra-canary" });
  assert.equal(await service.readOrbitAuth(), undefined);
  await service.writeOrbitAuth({
    accessToken: "orbit-access",
    refreshToken: "orbit-refresh",
    tokenExpirationTimestamp: 99,
    workwondersJwt: "",
  });
  const key = [...state.values.keys()].find((key) =>
    key.startsWith("orbit:auth:")
  );
  assert.ok(key);
  assert.ok(!state.values.get(key).includes("orbit-refresh"));
  assert.equal((await service.readOrbitAuth())?.refreshToken, "orbit-refresh");
  await service.clearOrbitAuth();
  assert.equal(state.values.get("auth").accessToken, "hydra-canary");
});
test("sign-in refuses insecure storage before credentials leave the computer", async (t) => {
  const { state, service } = await fixture(t);
  state.secure = false;
  await assert.rejects(
    service.performOrbitAccount({
      action: "sign-in",
      email: "alex@example.test",
      password: "correct-password",
    }),
    /secure-storage/
  );
  assert.equal(state.requests.length, 0);
});
test("signup waits for confirmation and only sends credentials to the configured Orbit project", async (t) => {
  const { state, service } = await fixture(t);
  assert.deepEqual(
    await service.performOrbitAccount({
      action: "sign-up",
      email: "alex@example.test",
      password: "correct-password",
      displayName: "Alex",
    }),
    { status: "check-email" }
  );
  assert.equal(
    state.requests[0].url,
    "https://orbit-test.supabase.co/auth/v1/signup"
  );
  assert.equal(state.requests[0].maxRedirects, 0);
  assert.equal(state.requests[0].headers.apikey, "sb_publishable_test");
});
test("invalid recovery inputs never reach the service and token fields are validated", async (t) => {
  const { state, service } = await fixture(t);
  await assert.rejects(
    service.performOrbitAccount({
      action: "recover-verify",
      email: "alex@example.test",
      code: "123456",
      password: "short",
    }),
    /invalid-input/
  );
  assert.equal(state.requests.length, 0);
  assert.throws(
    () => service.orbitSession({ access_token: "token", expires_in: 3600 }),
    /auth/
  );
});

test("default email links are verified only with Orbit and never followed to their redirect", async (t) => {
  const { state, service } = await fixture(t);
  state.reply = {
    access_token: "verified-access",
    refresh_token: "verified-refresh",
    expires_in: 3600,
    user: { email: "alex@example.test" },
  };
  const result = await service.performOrbitAccount({
    action: "verify",
    email: "alex@example.test",
    code:
      "https://orbit-test.supabase.co/auth/v1/verify?token=" +
      "a".repeat(64) +
      "&type=signup&redirect_to=https://evil.test",
  });
  assert.equal(result.session?.accessToken, "verified-access");
  assert.equal(state.requests.length, 1);
  assert.equal(
    state.requests[0].url,
    "https://orbit-test.supabase.co/auth/v1/verify"
  );
  assert.deepEqual(state.requests[0].data, {
    type: "signup",
    token_hash: "a".repeat(64),
  });
});
test("foreign verification links and links for another email cannot change a password", async (t) => {
  const { state, service } = await fixture(t);
  for (const code of [
    "https://evil.test/auth/v1/verify?token=" +
      "a".repeat(64) +
      "&type=recovery",
    "https://orbit-test.supabase.co/auth/v1/verify?token=" +
      "a".repeat(64) +
      "&type=signup",
  ])
    await assert.rejects(
      service.performOrbitAccount({
        action: "recover-verify",
        email: "alex@example.test",
        password: "new-password-123",
        code,
      }),
      /invalid-input/
    );
  assert.equal(state.requests.length, 0);
  state.reply = {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
    user: { email: "someone-else@example.test" },
  };
  await assert.rejects(
    service.performOrbitAccount({
      action: "recover-verify",
      email: "alex@example.test",
      password: "new-password-123",
      code:
        "https://orbit-test.supabase.co/auth/v1/verify?token=" +
        "a".repeat(64) +
        "&type=recovery",
    }),
    /auth/
  );
  assert.equal(state.requests.length, 1);
  assert.ok(!state.requests.some((request) => request.method === "PUT"));
});
