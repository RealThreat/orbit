import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  linkedProgressEntries,
  parseProgressLinks,
  consoleProgressEntries,
  pcProgressEntry,
  type PlatformProgressEntry,
} from "./progress-model.js";

const row = (
  id: string,
  earned: number,
  total: number | null
): PlatformProgressEntry => ({
  id,
  title: "Same title",
  platform: id,
  earned,
  total,
});
describe("per-platform progress", () => {
  it("does not merge identical titles without a confirmed association", () => {
    const entries = [row("steam", 10, 50), row("ps5", 35, 40)];
    assert.deepEqual(
      linkedProgressEntries("steam", entries, []).map((entry) => entry.id),
      ["steam"]
    );
  });
  it("resolves associations from either platform without adding achievement counts", () => {
    const entries = [
      row("steam", 10, 50),
      row("ps5", 35, 40),
      row("xbox", 2, null),
    ];
    const result = linkedProgressEntries("ps5", entries, [
      ["steam", "ps5"],
      ["steam", "xbox"],
    ]);
    assert.equal(result.length, 3);
    assert.equal(result.find((entry) => entry.id === "steam")?.earned, 10);
    assert.equal(result.find((entry) => entry.id === "ps5")?.total, 40);
    assert.equal(result.find((entry) => entry.id === "xbox")?.total, null);
  });
  it("does not bridge progress through a missing or switched account", () => {
    const entries = [row("steam", 1, 10), row("ps5-new-account", 2, 10)];
    assert.deepEqual(
      linkedProgressEntries("steam", entries, [
        ["steam", "ps5-old-account"],
        ["ps5-old-account", "ps5-new-account"],
      ]).map((entry) => entry.id),
      ["steam"]
    );
  });
  it("handles cycles once per platform", () => {
    assert.equal(
      linkedProgressEntries(
        "a",
        [row("a", 1, 10), row("b", 2, 10)],
        [
          ["a", "b"],
          ["b", "a"],
        ]
      ).length,
      2
    );
  });
  it("rejects malformed stored links rather than silently replacing them", () => {
    assert.deepEqual(parseProgressLinks(null), []);
    assert.deepEqual(parseProgressLinks('{"version":1,"links":[["a","b"]]}'), [
      ["a", "b"],
    ]);
    for (const raw of [
      '{"version":2,"links":[]}',
      '{"version":1,"links":[["a",3]]}',
      "broken",
    ])
      assert.throws(() => parseProgressLinks(raw));
  });
  it("keeps console accounts separate and shows unavailable PC counters as unknown", () => {
    const entries = consoleProgressEntries([
      {
        provider: "psn",
        configured: true,
        connected: true,
        accountId: "one",
        titles: [
          {
            id: "psn:trophy2:1",
            provider: "psn",
            remoteId: "1",
            title: "Game",
            platforms: ["PS5"],
            earned: 1,
            total: 2,
          },
        ],
      },
      {
        provider: "psn",
        configured: true,
        connected: false,
        accountId: "two",
        titles: [
          {
            id: "psn:trophy2:1",
            provider: "psn",
            remoteId: "1",
            title: "Game",
            platforms: ["PS5"],
            earned: 2,
            total: 2,
          },
        ],
      },
    ]);
    assert.notEqual(entries[0].id, entries[1].id);
    assert.equal(entries[1].snapshot, true);
    assert.equal(
      pcProgressEntry({ shop: "steam", objectId: "1", title: "Game" }).earned,
      null
    );
  });
});
