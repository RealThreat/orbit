import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import ts from "typescript";
// @ts-ignore Node ESM source import.
import * as normalization from "./normalization.ts";

const requireModule = createRequire(import.meta.url);
function fixture(platform: string, available: boolean, backend: string) {
  const stubs: Record<string, unknown> = {
    electron: {
      app: { getPath: () => "/profile" },
      safeStorage: {
        isEncryptionAvailable: () => available,
        getSelectedStorageBackend: () => backend,
      },
    },
    "./normalization": normalization,
  };
  const output = ts.transpileModule(
    fs.readFileSync(
      path.resolve("src/main/services/console-accounts/store.ts"),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  const module = {
    exports: {} as {
      assertConsoleEncryption: () => void;
      publicConsoleAccount: (
        account: object,
        provider: string,
        configured: boolean
      ) => object;
    },
  };
  new Function("require", "module", "exports", "process", output)(
    (name: string) => stubs[name] ?? requireModule(name),
    module,
    module.exports,
    { platform }
  );
  return module.exports;
}
describe("console credential storage boundary", () => {
  it("rejects unavailable encryption and the Linux basic_text fallback", () => {
    assert.throws(
      () => fixture("win32", false, "").assertConsoleEncryption(),
      /secure-storage/
    );
    assert.throws(
      () => fixture("linux", true, "basic_text").assertConsoleEncryption(),
      /secure-storage/
    );
    assert.doesNotThrow(() =>
      fixture("linux", true, "gnome_libsecret").assertConsoleEncryption()
    );
  });
  it("projects only public account data across the preload boundary", () => {
    const result = fixture("win32", true, "").publicConsoleAccount(
      {
        accountId: "123",
        displayName: "Player",
        session: {
          accessToken: "ACCESS_SECRET",
          refreshToken: "REFRESH_SECRET",
        },
        details: { cached: "PRIVATE_CACHE" },
        titles: [],
        lastSyncedAt: "2026-10-01",
      },
      "psn",
      true
    );
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.equal(JSON.stringify(result).includes("PRIVATE_CACHE"), false);
    assert.equal((result as { connected: boolean }).connected, true);
  });
});
