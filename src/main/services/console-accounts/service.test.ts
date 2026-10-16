import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import ts from "typescript";
// @ts-ignore Node ESM source import.
import * as normalization from "./normalization.ts";

const requireModule = createRequire(import.meta.url);
function fixture() {
  const title = {
    id: "psn:trophy:one",
    provider: "psn",
    remoteId: "one",
    title: "Original",
    platforms: ["PS3"],
    earned: 1,
    total: 10,
  };
  let stored = {
    version: 1,
    active: "1",
    accounts: {
      "1": {
        provider: "psn",
        connected: true,
        configured: true,
        accountId: "1",
        displayName: "First",
        titles: [title],
        details: {},
        lastSyncedAt: "2026-01-01",
        session: {
          provider: "psn",
          accountId: "1",
          accessToken: "SECRET",
          refreshToken: "REFRESH",
        },
      },
    },
  };
  let scan: () => Promise<unknown[]> = async () => [title];
  let gate: Promise<void> | undefined;
  const writes: unknown[] = [];
  const stubs: Record<string, unknown> = {
    "./normalization": normalization,
    "./xbox-auth": {
      xboxClientId: () => "client",
      authorizeXbox: async () => "code",
    },
    "./providers": {
      refreshConsoleSession: async (session: object) => ({
        ...session,
        refreshToken: "ROTATED",
      }),
      scanConsoleTitles: async () => {
        if (gate) await gate;
        return scan();
      },
      connectPsn: async () => ({
        provider: "psn",
        accountId: "2",
        displayName: "Second",
        accessToken: "SECRET2",
      }),
    },
    "./store": {
      assertConsoleEncryption: () => {},
      readConsoleStore: async () => structuredClone(stored),
      writeConsoleStore: async (_provider: string, value: typeof stored) => {
        stored = structuredClone(value);
        writes.push(structuredClone(value));
      },
      publicConsoleAccount: (
        account: Record<string, unknown> | undefined,
        provider: string,
        configured: boolean
      ) => ({
        provider,
        configured,
        connected: !!account?.session,
        accountId: account?.accountId,
        titles: account?.titles ?? [],
        lastSyncedAt: account?.lastSyncedAt,
      }),
    },
  };
  const filename = path.resolve("src/main/services/console-accounts/index.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = {
    exports: {} as typeof import("./index"),
  };
  new Function("require", "module", "exports", output)(
    (name: string) => stubs[name] ?? requireModule(name),
    module,
    module.exports
  );
  return {
    api: module.exports,
    stored: () => stored,
    writes,
    setScan: (action: typeof scan) => {
      scan = action;
    },
    setGate: (value: Promise<void>) => {
      gate = value;
    },
  };
}

describe("console account lifecycle", () => {
  it("keeps the successful snapshot on scan failure while saving rotated credentials", async () => {
    const f = fixture();
    f.setScan(async () => {
      throw new Error("provider down");
    });
    await assert.rejects(f.api.syncConsoleAccount("psn", "1"));
    assert.equal(f.stored().accounts["1"].titles[0].title, "Original");
    assert.equal(f.stored().accounts["1"].lastSyncedAt, "2026-01-01");
    assert.equal(f.stored().accounts["1"].session.refreshToken, "ROTATED");
  });
  it("keeps earlier account snapshots when switching accounts", async () => {
    const f = fixture();
    await f.api.connectPlayStation("token");
    assert.equal(f.stored().active, "2");
    assert.equal(f.stored().accounts["1"].titles.length, 1);
    await assert.rejects(
      f.api.syncConsoleAccount("psn", "1"),
      /account-changed/
    );
  });
  it("does not run two operations on the same provider at once", async () => {
    const f = fixture();
    let release!: () => void;
    f.setGate(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );
    const first = f.api.syncConsoleAccount("psn", "1");
    await assert.rejects(f.api.disconnectConsoleAccount("psn", "1"), /busy/);
    release();
    await first;
  });
  it("returns safe error codes without leaking HTTP errors or credentials", async () => {
    const f = fixture();
    const result = await f.api.consoleResult(async () => {
      throw new Error("access_token=SECRET");
    });
    assert.deepEqual(result, { ok: false, error: "network" });
    assert(
      !JSON.stringify(await f.api.getConsoleAccounts()).includes("SECRET")
    );
  });
  it("disconnects without deleting the saved trophy snapshot", async () => {
    const f = fixture();
    await f.api.disconnectConsoleAccount("psn", "1");
    assert.equal(f.stored().accounts["1"].session, undefined);
    assert.equal(f.stored().accounts["1"].titles.length, 1);
  });
});
