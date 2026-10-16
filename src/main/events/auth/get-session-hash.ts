import { createHash } from "node:crypto";

import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";

const getSessionHash = async (_event: Electron.IpcMainInvokeEvent) => {
  const context = HydraApi.getAuthContext();
  return context
    ? createHash("sha256")
        .update(
          `${context.environment}:${context.userId}:${context.generation}`
        )
        .digest("hex")
    : null;
};

registerEvent("getSessionHash", getSessionHash);
