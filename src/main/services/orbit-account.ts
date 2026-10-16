import axios from "axios";
import { safeStorage } from "electron";
import { db } from "@main/level";
import type { Auth } from "@types";
import type { OrbitAccountInput } from "../../types/orbit-account.types";
import { orbitProjectConfig } from "../../shared/orbit-api-policy";

export const getOrbitConfig = () =>
  orbitProjectConfig(
    import.meta.env.MAIN_VITE_ORBIT_SUPABASE_URL,
    import.meta.env.MAIN_VITE_ORBIT_SUPABASE_KEY
  );
const authKey = () =>
  `orbit:auth:v1:${getOrbitConfig()?.url ?? "unconfigured"}`;
function encryption() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error("secure-storage");
}
export async function readOrbitAuth(): Promise<Auth | undefined> {
  const [data] = await db.getMany<string, string>([authKey()], {
    valueEncoding: "utf8",
  });
  if (!data) return undefined;
  encryption();
  const auth = JSON.parse(
    safeStorage.decryptString(Buffer.from(data, "base64"))
  );
  if (
    !auth ||
    typeof auth.accessToken !== "string" ||
    typeof auth.refreshToken !== "string" ||
    typeof auth.tokenExpirationTimestamp !== "number" ||
    !Number.isFinite(auth.tokenExpirationTimestamp)
  )
    throw new Error("secure-storage");
  return { ...auth, workwondersJwt: "" };
}
export async function writeOrbitAuth(auth: Auth) {
  encryption();
  await db.put(
    authKey(),
    safeStorage.encryptString(JSON.stringify(auth)).toString("base64"),
    { valueEncoding: "utf8" }
  );
}
export const clearOrbitAuth = () => db.del(authKey());
export async function orbitAuthRequest(
  path: string,
  body?: unknown,
  token?: string,
  method = "POST"
) {
  const config = getOrbitConfig();
  if (!config) throw new Error("not-configured");
  return (
    await axios.request({
      url: `${config.url}/auth/v1${path}`,
      method,
      data: body,
      headers: {
        apikey: config.key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 20_000,
      maxRedirects: 0,
    })
  ).data;
}
export function orbitSession(data: Record<string, unknown>) {
  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.expires_in !== "number" ||
    data.expires_in <= 0
  )
    throw new Error("auth");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    workwondersJwt: "",
  };
}
export async function performOrbitAccount(input: OrbitAccountInput) {
  if (!input || typeof input !== "object") throw new Error("invalid-input");
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = input.password;
  const checkEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error("invalid-input");
  };
  const checkPassword = () => {
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw new Error("invalid-input");
  };
  if (input.action === "sign-in" || input.action === "sign-up") {
    checkEmail();
    if (input.action === "sign-up") checkPassword();
    else if (typeof password !== "string" || !password || password.length > 128)
      throw new Error("invalid-input");
    encryption();
    const data = await orbitAuthRequest(
      input.action === "sign-in" ? "/token?grant_type=password" : "/signup",
      {
        email,
        password,
        ...(input.action === "sign-up"
          ? {
              data: {
                display_name:
                  typeof input.displayName === "string"
                    ? input.displayName.trim().slice(0, 40)
                    : "",
              },
            }
          : {}),
      }
    );
    return data.access_token
      ? { session: orbitSession(data) }
      : { status: "check-email" as const };
  }
  if (input.action === "recover") {
    checkEmail();
    await orbitAuthRequest("/recover", { email });
    return { status: "check-email" as const };
  }
  if (input.action === "verify" || input.action === "recover-verify") {
    checkEmail();
    if (typeof input.code !== "string" || !/^\d{6,10}$/.test(input.code))
      throw new Error("invalid-input");
    if (input.action === "recover-verify") checkPassword();
    encryption();
    const session = orbitSession(
      await orbitAuthRequest("/verify", {
        email,
        token: input.code,
        type: input.action === "verify" ? "signup" : "recovery",
      })
    );
    if (input.action === "recover-verify")
      await orbitAuthRequest("/user", { password }, session.accessToken, "PUT");
    return { session };
  }
  if (input.action === "update-email" || input.action === "update-password") {
    const auth = await readOrbitAuth();
    if (!auth) throw new Error("auth");
    if (input.action === "update-email") checkEmail();
    else checkPassword();
    await orbitAuthRequest(
      "/user",
      input.action === "update-email" ? { email } : { password },
      auth.accessToken,
      "PUT"
    );
    return {
      status:
        input.action === "update-email"
          ? ("check-email" as const)
          : ("updated" as const),
    };
  }
  throw new Error("invalid-input");
}
