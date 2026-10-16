import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ConsoleAccount,
  ConsoleAchievement,
  ConsoleProvider,
} from "../../../types/console-accounts.types";
import type { ConsoleSession } from "./providers";
import { ConsoleAccountError } from "./normalization";

export interface ConsoleStoredAccount extends ConsoleAccount {
  session?: ConsoleSession;
  details: Record<
    string,
    { scannedAt: string; achievements: ConsoleAchievement[] }
  >;
}
interface ConsoleStore {
  version: 1;
  active?: string;
  accounts: Record<string, ConsoleStoredAccount>;
}
const filename = (provider: ConsoleProvider) =>
  path.join(
    app.getPath("userData"),
    "console-accounts",
    `${provider}.encrypted`
  );
export function assertConsoleEncryption() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new ConsoleAccountError("secure-storage");
}
export async function readConsoleStore(
  provider: ConsoleProvider
): Promise<ConsoleStore> {
  let data: Buffer;
  try {
    data = await fs.readFile(filename(provider));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, accounts: {} };
    throw error;
  }
  assertConsoleEncryption();
  try {
    const store = JSON.parse(safeStorage.decryptString(data)) as ConsoleStore;
    if (
      store.version !== 1 ||
      !store.accounts ||
      typeof store.accounts !== "object"
    )
      throw new Error();
    return store;
  } catch {
    throw new ConsoleAccountError("secure-storage");
  }
}
export async function writeConsoleStore(
  provider: ConsoleProvider,
  store: ConsoleStore
) {
  assertConsoleEncryption();
  const target = filename(provider);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temp = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, safeStorage.encryptString(JSON.stringify(store)), {
    mode: 0o600,
  });
  await fs.rename(temp, target);
}
export function publicConsoleAccount(
  account: ConsoleStoredAccount | undefined,
  provider: ConsoleProvider,
  configured: boolean
): ConsoleAccount {
  return {
    provider,
    configured,
    connected: !!account?.session,
    accountId: account?.accountId,
    displayName: account?.displayName,
    lastSyncedAt: account?.lastSyncedAt,
    titles: account?.titles ?? [],
  };
}
