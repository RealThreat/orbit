import { registerEvent } from "../register-event";
import { assertTrustedEpicSender } from "../epic/assert-trusted-sender";
import {
  consoleResult,
  validateConsoleProvider,
  getConsoleAccounts,
  connectPlayStation,
  connectXbox,
  syncConsoleAccount,
  disconnectConsoleAccount,
  getConsoleAchievements,
} from "../../services/console-accounts";
import { ConsoleAccountError } from "../../services/console-accounts/normalization";

const identifier = (value: unknown) => {
  if (typeof value !== "string" || !value.length || value.length > 256)
    throw new ConsoleAccountError("invalid-data");
  return value;
};
registerEvent("getConsoleAccounts", (event) =>
  consoleResult(async () => {
    assertTrustedEpicSender(event);
    return getConsoleAccounts();
  })
);
registerEvent("connectPlayStation", (event, npsso: unknown) =>
  consoleResult(async () => {
    assertTrustedEpicSender(event);
    return connectPlayStation(identifier(npsso));
  }, "auth")
);
registerEvent("connectXbox", (event) =>
  consoleResult(async () => {
    assertTrustedEpicSender(event);
    return connectXbox();
  }, "auth")
);
registerEvent(
  "syncConsoleAccount",
  (event, provider: unknown, accountId: unknown) =>
    consoleResult(async () => {
      assertTrustedEpicSender(event);
      return syncConsoleAccount(
        validateConsoleProvider(provider),
        identifier(accountId)
      );
    })
);
registerEvent(
  "disconnectConsoleAccount",
  (event, provider: unknown, accountId: unknown) =>
    consoleResult(async () => {
      assertTrustedEpicSender(event);
      return disconnectConsoleAccount(
        validateConsoleProvider(provider),
        identifier(accountId)
      );
    })
);
registerEvent(
  "getConsoleAchievements",
  (event, provider: unknown, accountId: unknown, titleId: unknown) =>
    consoleResult(async () => {
      assertTrustedEpicSender(event);
      return getConsoleAchievements(
        validateConsoleProvider(provider),
        identifier(accountId),
        identifier(titleId)
      );
    })
);
