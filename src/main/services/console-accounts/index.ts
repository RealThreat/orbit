import axios from "axios";
import type {
  ConsoleProvider,
  ConsoleResult,
  ConsoleAccount,
} from "../../../types/console-accounts.types";
import { ConsoleAccountError } from "./normalization";
import {
  connectPsn,
  connectXboxCode,
  refreshConsoleSession,
  scanConsoleTitles,
  fetchConsoleAchievements,
  type ConsoleSession,
} from "./providers";
import {
  assertConsoleEncryption,
  readConsoleStore,
  writeConsoleStore,
  publicConsoleAccount,
  type ConsoleStoredAccount,
} from "./store";
import { authorizeXbox, xboxClientId } from "./xbox-auth";

const busy = new Set<ConsoleProvider>();
const configured = (provider: ConsoleProvider) =>
  provider === "psn" || !!xboxClientId();
export const validateConsoleProvider = (value: unknown): ConsoleProvider => {
  if (value !== "psn" && value !== "xbox")
    throw new ConsoleAccountError("invalid-data");
  return value;
};
// Never send SDK/HTTP errors to the renderer: they can contain tokens or request headers.
export async function consoleResult<T>(
  action: () => Promise<T>,
  fallback: "auth" | "network" = "network"
): Promise<ConsoleResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    if (error instanceof ConsoleAccountError)
      return { ok: false, error: error.code };
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 0;
    return {
      ok: false,
      error:
        status === 429
          ? "rate-limit"
          : status === 401 || status === 403
            ? "auth"
            : fallback,
    };
  }
}
async function exclusive<T>(
  provider: ConsoleProvider,
  action: () => Promise<T>
): Promise<T> {
  if (busy.has(provider)) throw new ConsoleAccountError("busy");
  busy.add(provider);
  try {
    return await action();
  } finally {
    busy.delete(provider);
  }
}
export async function getConsoleAccounts(): Promise<ConsoleAccount[]> {
  return Promise.all(
    (["psn", "xbox"] as const).map(async (provider) => {
      const store = await readConsoleStore(provider);
      return publicConsoleAccount(
        store.active ? store.accounts[store.active] : undefined,
        provider,
        configured(provider)
      );
    })
  );
}
async function saveConnection(session: ConsoleSession) {
  if (!/^\d+$/.test(session.accountId)) throw new ConsoleAccountError("auth");
  const store = await readConsoleStore(session.provider);
  const prior = store.accounts[session.accountId];
  const account: ConsoleStoredAccount = {
    provider: session.provider,
    configured: configured(session.provider),
    connected: true,
    accountId: session.accountId,
    displayName: session.displayName,
    session,
    titles: prior?.titles ?? [],
    lastSyncedAt: prior?.lastSyncedAt,
    details: prior?.details ?? {},
  };
  store.accounts[session.accountId] = account;
  store.active = session.accountId;
  await writeConsoleStore(session.provider, store);
  return publicConsoleAccount(
    account,
    session.provider,
    configured(session.provider)
  );
}
export const connectPlayStation = (npsso: string) =>
  exclusive("psn", async () => {
    assertConsoleEncryption();
    return saveConnection(await connectPsn(npsso));
  });
export const connectXbox = () =>
  exclusive("xbox", async () => {
    assertConsoleEncryption();
    const clientId = xboxClientId();
    return saveConnection(
      await connectXboxCode(await authorizeXbox(clientId), clientId)
    );
  });
async function currentAccount(provider: ConsoleProvider, accountId: string) {
  const store = await readConsoleStore(provider);
  if (typeof accountId !== "string" || store.active !== accountId)
    throw new ConsoleAccountError("account-changed");
  const account = store.accounts[accountId];
  if (!account?.session) throw new ConsoleAccountError("not-connected");
  return { store, account };
}
export const syncConsoleAccount = (
  provider: ConsoleProvider,
  accountId: string
) =>
  exclusive(provider, async () => {
    const { store, account } = await currentAccount(provider, accountId);
    account.session = await refreshConsoleSession(account.session!);
    // Persist a rotated refresh token even if a later scan fails. Keep the old snapshot until completion.
    await writeConsoleStore(provider, store);
    const titles = await scanConsoleTitles(account.session);
    account.titles = titles;
    account.lastSyncedAt = new Date().toISOString();
    await writeConsoleStore(provider, store);
    return publicConsoleAccount(account, provider, configured(provider));
  });
export const disconnectConsoleAccount = (
  provider: ConsoleProvider,
  accountId: string
) =>
  exclusive(provider, async () => {
    const { store, account } = await currentAccount(provider, accountId);
    account.session = undefined;
    account.connected = false;
    await writeConsoleStore(provider, store);
    return publicConsoleAccount(account, provider, configured(provider));
  });
export const getConsoleAchievements = (
  provider: ConsoleProvider,
  accountId: string,
  titleId: string
) =>
  exclusive(provider, async () => {
    const store = await readConsoleStore(provider);
    if (store.active !== accountId)
      throw new ConsoleAccountError("account-changed");
    const account = store.accounts[accountId];
    const title = account?.titles.find((title) => title.id === titleId);
    if (!title) throw new ConsoleAccountError("invalid-data");
    const cached = account.details[titleId];
    if (
      cached &&
      (!account.session ||
        (Date.now() - Date.parse(cached.scannedAt) < 5 * 60_000 &&
          Date.parse(cached.scannedAt) >=
            Date.parse(account.lastSyncedAt || "1970-01-01")))
    )
      return cached.achievements;
    if (!account.session) throw new ConsoleAccountError("not-connected");
    account.session = await refreshConsoleSession(account.session);
    await writeConsoleStore(provider, store);
    const achievements = await fetchConsoleAchievements(account.session, title);
    account.details[titleId] = {
      scannedAt: new Date().toISOString(),
      achievements,
    };
    title.total = achievements.length;
    title.earned = achievements.filter(
      (achievement) => achievement.earned
    ).length;
    await writeConsoleStore(provider, store);
    return achievements;
  });
