import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-ignore Node ESM source import.
import {
  psnTitle,
  xboxTitle,
  psnAchievements,
  xboxAchievement,
  collectConsolePages,
} from "./normalization.ts";

describe("console achievement normalization", () => {
  it("keeps PS3/PS4 and PS5 trophy sets with the same remote ID distinct", () => {
    const raw = {
      npCommunicationId: "NPWR12345_00",
      trophyTitleName: "Example",
      trophyTitlePlatform: "PS4,PSVITA",
      earnedTrophies: { bronze: 5, silver: 1 },
      definedTrophies: { bronze: 10, silver: 2, gold: 1, platinum: 1 },
    };
    const legacy = psnTitle({ ...raw, npServiceName: "trophy" });
    const ps5 = psnTitle({
      ...raw,
      trophyTitlePlatform: "PS5",
      npServiceName: "trophy2",
    });
    assert.notEqual(legacy.id, ps5.id);
    assert.deepEqual(legacy.platforms, ["PS4", "PSVITA"]);
    assert.equal(legacy.earned, 6);
    assert.equal(legacy.total, 14);
    assert.throws(() => psnTitle({ ...raw, npServiceName: "unknown" }));
  });
  it("joins PSN metadata to earned state by trophy ID rather than array position", () => {
    const result = psnAchievements(
      [
        { trophyId: 0, trophyName: "First", trophyType: "bronze" },
        {
          trophyId: 1,
          trophyName: "Secret",
          trophyHidden: true,
          trophyType: "gold",
        },
      ],
      [
        { trophyId: 1, earned: false },
        { trophyId: 0, earned: true, earnedDateTime: "2026-10-01T12:00:00Z" },
      ]
    );
    assert.equal(result[0].earned, true);
    assert.equal(result[0].earnedAt, "2026-10-01T12:00:00.000Z");
    assert.equal(result[1].hidden, true);
    assert.equal(result[1].earned, false);
  });
  it("keeps Xbox 360/modern IDs distinct and does not invent modern trophy totals", () => {
    const legacy = xboxTitle(
      {
        titleId: 10,
        name: "Example",
        currentAchievements: 4,
        totalAchievements: 20,
        currentGamerscore: 100,
        totalGamerscore: 1000,
      },
      1
    );
    const modern = xboxTitle(
      {
        titleId: 10,
        name: "Example",
        earnedAchievements: 4,
        currentGamerscore: 100,
        maxGamerscore: 1000,
      },
      2
    );
    assert.notEqual(legacy.id, modern.id);
    assert.equal(legacy.total, 20);
    assert.equal(modern.total, null);
  });
  it("handles revoked achievements and ignores sentinel unlock dates", () => {
    const legacy = xboxAchievement(
      {
        id: 0,
        name: "Old",
        unlocked: true,
        gamerscore: 20,
        timeUnlocked: "0001-01-01T00:00:00Z",
      },
      1
    );
    assert.equal(legacy.earned, true);
    assert.equal(legacy.earnedAt, undefined);
    const modern = xboxAchievement(
      {
        id: "1",
        name: "New",
        progressState: "Achieved",
        isRevoked: true,
        rewards: [{ type: "Gamerscore", value: "50" }],
      },
      2
    );
    assert.equal(modern.earned, false);
    assert.equal(modern.gamerscore, 50);
  });
  it("does not allow remote icon fields to load scripts or local files", () => {
    for (const url of [
      "javascript:alert(1)",
      "file:///private",
      "http://example.com/icon.png",
    ]) {
      assert.equal(
        psnTitle({
          npCommunicationId: "id",
          npServiceName: "trophy",
          trophyTitleName: "Test",
          trophyTitlePlatform: "PS3",
          earnedTrophies: {},
          definedTrophies: {},
          trophyTitleIconUrl: url,
        }).iconUrl,
        undefined
      );
    }
  });
});

describe("complete console scans", () => {
  it("follows pagination and returns all pages", async () => {
    const cursors: (string | undefined)[] = [];
    const result = await collectConsolePages(async (cursor) => {
      cursors.push(cursor);
      return cursor ? { items: [2] } : { items: [1], next: "next" };
    });
    assert.deepEqual(result, [1, 2]);
    assert.deepEqual(cursors, [undefined, "next"]);
  });
  it("rejects repeated continuation tokens instead of looping forever", async () => {
    await assert.rejects(
      collectConsolePages(async () => ({ items: [1], next: "same" })),
      /invalid-data/
    );
  });
  it("does not return partial results when a later page fails", async () => {
    await assert.rejects(
      collectConsolePages(async (cursor) => {
        if (cursor) throw new Error("unavailable");
        return { items: [1], next: "next" };
      }),
      /unavailable/
    );
  });
});
