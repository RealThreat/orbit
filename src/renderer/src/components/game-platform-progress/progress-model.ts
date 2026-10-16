import type { ConsoleAccount, GameShop, LibraryGame } from "@types";

export interface PlatformProgressEntry {
  id: string;
  title: string;
  platform: string;
  earned: number | null;
  total: number | null;
  lastSyncedAt?: string;
  snapshot?: boolean;
  accountId?: string;
}
export type ProgressLink = [string, string];
export const pcProgressId = (shop: GameShop, objectId: string) =>
  `pc:${shop}:${objectId}`;
export const consoleProgressId = (
  provider: string,
  accountId: string,
  titleId: string
) => `console:${provider}:${accountId}:${titleId}`;
const knownCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;

export function pcProgressEntry(
  game: Pick<
    LibraryGame,
    | "shop"
    | "objectId"
    | "title"
    | "achievementCount"
    | "unlockedAchievementCount"
    | "platform"
  >
): PlatformProgressEntry {
  const labels = {
    steam: "Steam",
    epic: "Epic Games",
    custom: "Orbit",
    launchbox: "LaunchBox",
  };
  return {
    id: pcProgressId(game.shop, game.objectId),
    title: game.title,
    platform: game.platform
      ? `${labels[game.shop]} · ${game.platform}`
      : labels[game.shop],
    earned: knownCount(game.unlockedAchievementCount),
    total: knownCount(game.achievementCount),
  };
}
export function consoleProgressEntries(
  accounts: ConsoleAccount[]
): PlatformProgressEntry[] {
  return accounts.flatMap((account) =>
    account.accountId
      ? account.titles.map((title) => ({
          id: consoleProgressId(account.provider, account.accountId!, title.id),
          title: title.title,
          platform: `${account.provider === "psn" ? "PlayStation" : "Xbox"} · ${title.platforms.join(" / ")}`,
          earned: knownCount(title.earned),
          total: knownCount(title.total),
          lastSyncedAt: account.lastSyncedAt,
          snapshot: !account.connected,
          accountId: account.accountId,
        }))
      : []
  );
}
/** Only confirmed/user-created links join versions. Missing account nodes cannot bridge groups. */
export function linkedProgressEntries(
  anchor: string,
  entries: PlatformProgressEntry[],
  links: ProgressLink[]
): PlatformProgressEntry[] {
  const available = new Map(entries.map((entry) => [entry.id, entry]));
  const found = new Set<string>([anchor]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [left, right] of links) {
      if (!available.has(left) || !available.has(right)) continue;
      if (found.has(left) && !found.has(right)) {
        found.add(right);
        changed = true;
      }
      if (found.has(right) && !found.has(left)) {
        found.add(left);
        changed = true;
      }
    }
  }
  return [...found].flatMap((id) =>
    available.has(id) ? [available.get(id)!] : []
  );
}
export function parseProgressLinks(raw: string | null): ProgressLink[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { version?: unknown; links?: unknown };
  if (parsed?.version !== 1 || !Array.isArray(parsed.links))
    throw new Error("invalid-progress-links");
  return parsed.links.map((pair: unknown) => {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      pair.some(
        (id) => typeof id !== "string" || !id.length || id.length > 1024
      )
    )
      throw new Error("invalid-progress-links");
    return [pair[0], pair[1]] as ProgressLink;
  });
}
