/** Public data only. Identity, social content, feature flags and mutations belong to Orbit. */
export function apiDestination(
  method: string,
  path: string
): "hydra-public" | "orbit" {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\#\r\n]/.test(path))
    throw new Error("Invalid API path");
  const pathname = path.split("?")[0];
  if (/%|(?:^|\/)\.{1,2}(?:\/|$)/.test(pathname))
    throw new Error("Invalid API path");
  const verb = method.toUpperCase();
  if (
    verb === "GET" &&
    (/^\/catalogue(?:\/|$)/.test(pathname) ||
      /^\/games\/[a-z]+\/[a-zA-Z0-9_.:-]+(?:\/(?:assets|stats|achievements|protondb|download-sources))?$/.test(
        pathname
      ) ||
      pathname === "/decky/release")
  )
    return "hydra-public";
  if (
    verb === "POST" &&
    [
      "/catalogue/search",
      "/games/shop-details",
      "/download-sources",
      "/download-sources/sync",
      "/hosters/availability",
    ].includes(pathname)
  )
    return "hydra-public";
  return "orbit";
}

export function orbitProjectConfig(
  url: string | undefined,
  key: string | undefined
) {
  if (!url || !key) return null;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(".supabase.co") ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Invalid Orbit Supabase URL");
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a public Supabase key");
  // Legacy anon keys are JWTs; never accept a service-role key in a desktop build.
  if (key.split(".").length === 3) {
    try {
      const claims = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      if (claims.role !== "anon") throw new Error();
    } catch {
      throw new Error("Use a public Supabase key");
    }
  } else if (!key.startsWith("sb_publishable_"))
    throw new Error("Use a public Supabase key");
  return {
    url: parsed.origin,
    key,
    api: `${parsed.origin}/functions/v1/orbit-api`,
  };
}
