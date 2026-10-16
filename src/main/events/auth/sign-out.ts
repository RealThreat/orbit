import { registerEvent } from "../register-event";
import { HydraApi, SSEClient, WindowManager } from "@main/services";
import { clearGamesPlaytimeState } from "@main/services/game-running-state";

const signOut = async (_event: Electron.IpcMainInvokeEvent) => {
  SSEClient.close();

  await HydraApi.handleSignOut(async () => {
    // Orbit sign-out ends the session, never clears the user's local library.
    clearGamesPlaytimeState();
  });

  /* The friends and chat windows are only meaningful while signed in */
  if (!HydraApi.isLoggedIn()) {
    WindowManager.closeFriendsWindow();
    WindowManager.closeChatWindow();
  }
};

registerEvent("signOut", signOut);
