import { registerEvent } from "../register-event";
import { assertTrustedEpicSender } from "../epic/assert-trusted-sender";
import {
  getOrbitConfig,
  performOrbitAccount,
} from "../../services/orbit-account";
import { HydraApi, WindowManager } from "@main/services";
import type {
  OrbitAccountInput,
  OrbitAccountResult,
} from "../../../types/orbit-account.types";
import { AxiosError } from "axios";

let pending = false;
registerEvent("getOrbitAccountStatus", (event) => {
  assertTrustedEpicSender(event, true);
  return { configured: !!getOrbitConfig() };
});
registerEvent(
  "submitOrbitAccount",
  async (event, input: OrbitAccountInput): Promise<OrbitAccountResult> => {
    assertTrustedEpicSender(event, true);
    if (pending) return { ok: false, error: "auth" };
    pending = true;
    const generation = HydraApi.getAccountGeneration();
    try {
      if (!getOrbitConfig()) return { ok: false, error: "not-configured" };
      if (
        input?.action === "update-email" ||
        input?.action === "update-password"
      )
        await HydraApi.refreshToken();
      const result = await performOrbitAccount(input);
      if (generation !== HydraApi.getAccountGeneration())
        return { ok: false, error: "auth" };
      if (result.session) {
        await HydraApi.handleOrbitAuth(result.session);
        return { ok: true, status: "signed-in" };
      }
      WindowManager.sendToAppWindows("on-account-updated");
      return { ok: true, status: result.status ?? "updated" };
    } catch (error) {
      const known = [
        "not-configured",
        "invalid-input",
        "secure-storage",
      ] as const;
      const code = known.find(
        (value) => error instanceof Error && error.message === value
      );
      return {
        ok: false,
        error:
          code ??
          (error instanceof AxiosError && !error.response ? "network" : "auth"),
      };
    } finally {
      pending = false;
    }
  }
);
