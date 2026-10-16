export type ConsoleProvider = "psn" | "xbox";
export type ConsoleErrorCode =
  | "not-configured"
  | "secure-storage"
  | "not-connected"
  | "busy"
  | "cancelled"
  | "auth"
  | "network"
  | "rate-limit"
  | "invalid-data"
  | "account-changed";
export type ConsoleResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ConsoleErrorCode };
export interface ConsoleAchievement {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  earned: boolean;
  earnedAt?: string;
  hidden: boolean;
  trophyType?: "bronze" | "silver" | "gold" | "platinum";
  gamerscore?: number;
}
export interface ConsoleTitle {
  id: string;
  provider: ConsoleProvider;
  remoteId: string;
  title: string;
  platforms: string[];
  iconUrl?: string;
  earned: number;
  total: number | null;
  gamerscore?: number;
  maxGamerscore?: number;
  lastUpdatedAt?: string;
  psnService?: "trophy" | "trophy2";
  xboxContract?: 1 | 2;
}
export interface ConsoleAccount {
  provider: ConsoleProvider;
  connected: boolean;
  configured: boolean;
  accountId?: string;
  displayName?: string;
  lastSyncedAt?: string;
  titles: ConsoleTitle[];
}
export interface ConsoleAccountsAPI {
  getConsoleAccounts: () => Promise<ConsoleResult<ConsoleAccount[]>>;
  connectPlayStation: (npsso: string) => Promise<ConsoleResult<ConsoleAccount>>;
  connectXbox: () => Promise<ConsoleResult<ConsoleAccount>>;
  syncConsoleAccount: (
    provider: ConsoleProvider,
    accountId: string
  ) => Promise<ConsoleResult<ConsoleAccount>>;
  disconnectConsoleAccount: (
    provider: ConsoleProvider,
    accountId: string
  ) => Promise<ConsoleResult<ConsoleAccount>>;
  getConsoleAchievements: (
    provider: ConsoleProvider,
    accountId: string,
    titleId: string
  ) => Promise<ConsoleResult<ConsoleAchievement[]>>;
}
