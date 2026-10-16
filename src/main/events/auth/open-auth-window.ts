import { registerEvent } from "../register-event";
import { AuthPage } from "@shared";
import { assertTrustedEpicSender } from "../epic/assert-trusted-sender";

const openAuthWindow = async (
  _event: Electron.IpcMainInvokeEvent,
  page: AuthPage
) => {
  assertTrustedEpicSender(_event, true);
  if (!Object.values(AuthPage).includes(page))
    throw new Error("Invalid account page");
  _event.sender.send("on-orbit-auth-request", page);
};

registerEvent("openAuthWindow", openAuthWindow);
