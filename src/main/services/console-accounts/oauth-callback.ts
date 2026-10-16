import { ConsoleAccountError } from "./normalization.js";

export function readXboxOAuthCallback(
  target: string,
  state: string,
  redirect: string
): string | null {
  const url = new URL(target);
  const callback = new URL(redirect);
  if (url.origin !== callback.origin || url.pathname !== callback.pathname)
    return null;
  const code = url.searchParams.get("code");
  if (
    url.username ||
    url.password ||
    url.searchParams.get("state") !== state ||
    url.searchParams.has("error") ||
    !code ||
    code.length > 16_384
  )
    throw new ConsoleAccountError("auth");
  return code;
}
