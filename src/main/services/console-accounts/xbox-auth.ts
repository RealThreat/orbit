import { BrowserWindow } from "electron";
import { randomBytes } from "node:crypto";
import { live } from "@xboxreplay/xboxlive-auth";
import { ConsoleAccountError } from "./normalization";
import { XBOX_REDIRECT, XBOX_SCOPE } from "./providers";
import { readXboxOAuthCallback } from "./oauth-callback";

export const xboxClientId = () =>
  (import.meta.env.MAIN_VITE_XBOX_CLIENT_ID || "").trim();

export async function authorizeXbox(clientId: string): Promise<string> {
  if (!clientId) throw new ConsoleAccountError("not-configured");
  const state = randomBytes(32).toString("hex");
  const authorize = new URL(
    live.getAuthorizeUrl(clientId, XBOX_SCOPE, "code", XBOX_REDIRECT)
  );
  authorize.searchParams.set("state", state);
  const window = new BrowserWindow({
    width: 560,
    height: 760,
    title: "Orbit — Xbox",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: `orbit-xbox-${state}`,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(undefined, "cancelled"), 5 * 60_000);
    const finish = (
      code?: string,
      error: "auth" | "cancelled" | "network" = "auth"
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!window.isDestroyed()) window.close();
      if (code) resolve(code);
      else reject(new ConsoleAccountError(error));
    };
    const navigate = (event: Electron.Event, target: string) => {
      try {
        const url = new URL(target);
        const callback = new URL(XBOX_REDIRECT);
        if (
          url.origin === callback.origin &&
          url.pathname === callback.pathname
        ) {
          event.preventDefault();
          return finish(
            readXboxOAuthCallback(target, state, XBOX_REDIRECT) || undefined
          );
        }
        const allowed = [
          "login.live.com",
          "account.live.com",
          "login.microsoftonline.com",
          "login.microsoft.com",
        ];
        if (url.protocol !== "https:" || !allowed.includes(url.hostname)) {
          event.preventDefault();
          finish();
        }
      } catch {
        event.preventDefault();
        finish();
      }
    };
    window.webContents.on("will-navigate", navigate);
    window.webContents.on("will-redirect", navigate);
    window.on("closed", () => finish(undefined, "cancelled"));
    void window
      .loadURL(authorize.href)
      .catch(() => finish(undefined, "network"));
  });
}
