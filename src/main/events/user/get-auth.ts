import { HydraApi } from "@main/services";

import { registerEvent } from "../register-event";

const getAuth = async (_event: Electron.IpcMainInvokeEvent) =>
  HydraApi.isLoggedIn()
    ? {
        accessToken: "",
        refreshToken: "",
        workwondersJwt: "",
        tokenExpirationTimestamp: 0,
      }
    : null;

registerEvent("getAuth", getAuth);
