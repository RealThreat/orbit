import type {
  ConsoleAchievement,
  ConsoleErrorCode,
  ConsoleTitle,
} from "../../../types/console-accounts.types";

export class ConsoleAccountError extends Error {
  constructor(public readonly code: ConsoleErrorCode) {
    super(code);
  }
}
export const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConsoleAccountError("invalid-data");
  return value as Record<string, unknown>;
};
export const rows = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new ConsoleAccountError("invalid-data");
  return value;
};
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
export const count = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};
const required = (value: unknown): string => {
  const result =
    text(value) ||
    (typeof value === "number" && Number.isFinite(value) ? String(value) : "");
  if (!result) throw new ConsoleAccountError("invalid-data");
  return result;
};
export const imageUrl = (value: unknown): string | undefined => {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const date = (value: unknown): string | undefined => {
  const result = text(value);
  return result && Number.isFinite(Date.parse(result)) && Date.parse(result) > 0
    ? new Date(result).toISOString()
    : undefined;
};
const trophyCount = (value: unknown) => {
  const counts = record(value);
  return ["bronze", "silver", "gold", "platinum"].reduce(
    (total, type) => total + count(counts[type]),
    0
  );
};
export const psnTitle = (value: unknown): ConsoleTitle => {
  const item = record(value);
  const remoteId = required(item.npCommunicationId);
  if (item.npServiceName !== "trophy" && item.npServiceName !== "trophy2")
    throw new ConsoleAccountError("invalid-data");
  const service = item.npServiceName === "trophy2" ? "trophy2" : "trophy";
  return {
    id: `psn:${service}:${remoteId}`,
    provider: "psn",
    remoteId,
    psnService: service,
    title: required(item.trophyTitleName),
    platforms: required(item.trophyTitlePlatform)
      .split(",")
      .map((value) => value.trim()),
    iconUrl: imageUrl(item.trophyTitleIconUrl),
    earned: trophyCount(item.earnedTrophies),
    total: trophyCount(item.definedTrophies),
    lastUpdatedAt: date(item.lastUpdatedDateTime),
  };
};
export const xboxTitle = (value: unknown, contract: 1 | 2): ConsoleTitle => {
  const item = record(value);
  const remoteId = required(item.titleId);
  return {
    id: `xbox:${contract}:${remoteId}`,
    provider: "xbox",
    remoteId,
    xboxContract: contract,
    title: required(item.name),
    platforms:
      contract === 1
        ? ["Xbox 360"]
        : [text(item.platform) || "Xbox One / Series X|S"],
    earned: count(
      contract === 1 ? item.currentAchievements : item.earnedAchievements
    ),
    total: contract === 1 ? count(item.totalAchievements) : null,
    gamerscore: count(item.currentGamerscore),
    maxGamerscore: count(
      contract === 1 ? item.totalGamerscore : item.maxGamerscore
    ),
    lastUpdatedAt: date(contract === 1 ? item.lastPlayed : item.lastUnlock),
  };
};
export const psnAchievements = (
  metadata: unknown[],
  earnedItems: unknown[]
): ConsoleAchievement[] => {
  const earned = new Map(
    earnedItems.map((value) => {
      const item = record(value);
      return [required(item.trophyId), item];
    })
  );
  return metadata.map((value) => {
    const item = record(value);
    const id = required(item.trophyId);
    const progress = earned.get(id);
    const trophyType = text(item.trophyType);
    return {
      id,
      name: text(item.trophyName),
      description: text(item.trophyDetail),
      iconUrl: imageUrl(item.trophyIconUrl),
      earned: progress?.earned === true,
      earnedAt:
        progress?.earned === true ? date(progress.earnedDateTime) : undefined,
      hidden: item.trophyHidden === true,
      trophyType: ["bronze", "silver", "gold", "platinum"].includes(trophyType)
        ? (trophyType as ConsoleAchievement["trophyType"])
        : undefined,
    };
  });
};
export const xboxAchievement = (
  value: unknown,
  contract: 1 | 2
): ConsoleAchievement => {
  const item = record(value);
  const earned =
    contract === 1
      ? item.unlocked === true && item.isRevoked !== true
      : item.progressState === "Achieved" && item.isRevoked !== true;
  const progression = item.progression ? record(item.progression) : {};
  const reward = Array.isArray(item.rewards)
    ? item.rewards.map(record).find((value) => value.type === "Gamerscore")
    : undefined;
  const media = Array.isArray(item.mediaAssets)
    ? item.mediaAssets.map(record).find((value) => value.type === "Icon")
    : undefined;
  return {
    id: required(item.id),
    name: text(item.name),
    description:
      text(earned ? item.description : item.lockedDescription) ||
      text(item.description),
    earned,
    earnedAt: earned
      ? date(contract === 1 ? item.timeUnlocked : progression.timeUnlocked)
      : undefined,
    hidden: item.isSecret === true,
    gamerscore: count(contract === 1 ? item.gamerscore : reward?.value),
    iconUrl: imageUrl(media?.url),
  };
};

/** Fail closed on repeated pagination tokens or failures; callers commit only complete scans. */
export async function collectConsolePages<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; next?: string }>
): Promise<T[]> {
  const output: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const result = await fetchPage(cursor);
    output.push(...result.items);
    if (!result.next) return output;
    if (seen.has(result.next)) throw new ConsoleAccountError("invalid-data");
    seen.add(result.next);
    cursor = result.next;
  }
  throw new ConsoleAccountError("invalid-data");
}
