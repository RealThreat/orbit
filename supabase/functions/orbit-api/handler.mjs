const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const profile = (row, user) => ({
  id: user.id,
  username: user.id,
  email: user.email ?? null,
  displayName: row.display_name,
  bio: row.bio,
  profileVisibility: row.profile_visibility,
  profileImageUrl: null,
  backgroundImageUrl: null,
  souvenirsVisibility: "PRIVATE",
  allowCloudGifts: false,
  workwondersJwt: "",
  subscription: null,
  karma: 0,
  quirks: { backupsPerGameLimit: 0 },
});
const game = (row) => ({
  ...row.payload,
  id: row.id,
  shop: row.shop,
  objectId: row.object_id,
  createdAt: row.created_at,
  achievementCount: row.payload.achievementCount ?? 0,
  unlockedAchievementCount: row.payload.unlockedAchievementCount ?? 0,
  hasManuallyUpdatedPlaytime: row.payload.hasManuallyUpdatedPlaytime ?? false,
});

/** No upstream fallback. RLS uses the verified user's token, never a service-role key. */
export function createOrbitHandler({ url, publicKey, fetcher = fetch }) {
  return async (request) => {
    try {
      const incoming = new URL(request.url);
      const path =
        incoming.pathname.replace(/^\/functions\/v1\/orbit-api/, "") || "/";
      const method = request.method;
      if (method === "GET" && path === "/health")
        return json({
          service: "orbit",
          accounts: true,
          library: true,
          social: false,
          cloud: false,
        });
      const authorization = request.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ") || authorization.length > 16384)
        return json({ message: "Orbit sign-in required" }, 401);
      const headers = {
        apikey: publicKey,
        Authorization: authorization,
        "Content-Type": "application/json",
      };
      const call = async (endpoint, init = {}) => {
        const result = await fetcher(`${url}${endpoint}`, {
          ...init,
          headers: { ...headers, ...init.headers },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!result.ok)
          throw Object.assign(new Error("Orbit service request failed"), {
            status: result.status,
          });
        return result.status === 204 ? null : result.json();
      };
      // Verify server-side; decoding a JWT is not authentication.
      const user = await call("/auth/v1/user");
      if (typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id))
        return json({ message: "Invalid Orbit session" }, 401);
      const body = async () => {
        const text = await request.text();
        if (new TextEncoder().encode(text).length > 262144)
          throw Object.assign(new Error(), { status: 413 });
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          throw Object.assign(new Error(), { status: 400 });
        }
      };
      const ownProfile = async () => {
        const rows = await call(
          `/rest/v1/orbit_profiles?id=eq.${user.id}&select=*`
        );
        if (!rows[0]) throw Object.assign(new Error(), { status: 409 });
        return profile(rows[0], user);
      };
      if (method === "GET" && path === "/profile/me")
        return json(await ownProfile());
      if (method === "PATCH" && path === "/profile") {
        const data = await body();
        const patch = {};
        if (data.displayName !== undefined) {
          if (
            typeof data.displayName !== "string" ||
            !data.displayName.trim() ||
            data.displayName.length > 40
          )
            return json({ message: "Invalid display name" }, 400);
          patch.display_name = data.displayName.trim();
        }
        if (data.bio !== undefined) {
          if (typeof data.bio !== "string" || data.bio.length > 1000)
            return json({ message: "Invalid bio" }, 400);
          patch.bio = data.bio;
        }
        if (data.profileVisibility !== undefined) {
          if (
            !["PUBLIC", "FRIENDS", "PRIVATE"].includes(data.profileVisibility)
          )
            return json({ message: "Invalid visibility" }, 400);
          patch.profile_visibility = data.profileVisibility;
        }
        const unsupported = Object.keys(data).filter(
          (key) => !["displayName", "bio", "profileVisibility"].includes(key)
        );
        if (unsupported.length)
          return json(
            {
              message: "This profile field still needs an Orbit implementation",
              code: "orbit-service-pending",
            },
            501
          );
        await call(`/rest/v1/orbit_profiles?id=eq.${user.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
          headers: { Prefer: "return=minimal" },
        });
        return json(await ownProfile());
      }
      const merge = async (games) => {
        if (
          !Array.isArray(games) ||
          games.length > 100 ||
          games.some(
            (item) =>
              !item ||
              !["steam", "epic", "launchbox", "custom"].includes(item.shop) ||
              typeof item.objectId !== "string" ||
              !item.objectId ||
              item.objectId.length > 256
          )
        )
          throw Object.assign(new Error(), { status: 400 });
        return (
          await call("/rest/v1/rpc/orbit_merge_games", {
            method: "POST",
            body: JSON.stringify({ games }),
          })
        ).map(game);
      };
      if (method === "POST" && path === "/profile/games/batch")
        return json(await merge(await body()));
      if (method === "POST" && path === "/profile/games") {
        const [result] = await merge([await body()]);
        return json(result);
      }
      const identity =
        /^\/profile\/games\/(steam|epic|launchbox|custom)\/([^/]+)$/.exec(path);
      if (identity && ["GET", "PUT"].includes(method)) {
        const [, shop, encodedId] = identity;
        const objectId = decodeURIComponent(encodedId);
        if (!objectId || objectId.length > 256)
          return json({ message: "Invalid game" }, 400);
        if (method === "GET") {
          const quoted = JSON.stringify(objectId);
          const rows = await call(
            `/rest/v1/orbit_games?owner_id=eq.${user.id}&shop=eq.${shop}&object_id=eq.${encodeURIComponent(quoted)}&select=*`
          );
          return rows[0]
            ? json(game(rows[0]))
            : json({ message: "Game not found" }, 404);
        }
        const data = await body();
        if (
          !Number.isFinite(data.playTimeDeltaInSeconds) ||
          data.playTimeDeltaInSeconds < 0 ||
          data.playTimeDeltaInSeconds > 1e9 ||
          typeof data.lastTimePlayed !== "string" ||
          !Number.isFinite(Date.parse(data.lastTimePlayed))
        )
          return json({ message: "Invalid playtime" }, 400);
        const rows = await call("/rest/v1/rpc/orbit_add_playtime", {
          method: "POST",
          body: JSON.stringify({
            game_shop: shop,
            game_object_id: objectId,
            delta_seconds: Math.trunc(data.playTimeDeltaInSeconds),
            last_played: data.lastTimePlayed,
          }),
        });
        return rows[0]
          ? json(game(rows[0]))
          : json({ message: "Game not found" }, 404);
      }
      const removal = /^\/profile\/games\/([0-9a-f-]{36})$/i.exec(path);
      if (method === "DELETE" && removal) {
        await call(
          `/rest/v1/orbit_games?owner_id=eq.${user.id}&id=eq.${removal[1]}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } }
        );
        return new Response(null, { status: 204 });
      }
      if (
        method === "GET" &&
        ["/profile/games", "/profile/games/hidden"].includes(path)
      ) {
        const skip = Math.max(
          0,
          Math.min(100000, Number(incoming.searchParams.get("skip")) || 0)
        );
        const take = Math.max(
          1,
          Math.min(100, Number(incoming.searchParams.get("take")) || 100)
        );
        let filter = `owner_id=eq.${user.id}&select=*&order=created_at.asc,id.asc&offset=${Math.trunc(skip)}&limit=${Math.trunc(take)}`;
        const shop = incoming.searchParams.get("shop");
        if (shop && !["steam", "epic", "launchbox", "custom"].includes(shop))
          return json({ message: "Invalid shop" }, 400);
        filter += shop ? `&shop=eq.${shop}` : "&shop=neq.launchbox";
        filter += path.endsWith("/hidden")
          ? "&payload->>isConcealed=eq.true"
          : "&or=(payload->>isConcealed.is.null,payload->>isConcealed.neq.true)";
        return json((await call(`/rest/v1/orbit_games?${filter}`)).map(game));
      }
      const action =
        /^\/profile\/games\/(steam|epic|launchbox|custom)\/([^/]+)\/(favorite|unfavorite|pin|unpin|playtime)$/.exec(
          path
        );
      if (method === "PUT" && action) {
        const [, shop, objectId, kind] = action;
        const data = await body();
        let patch;
        if (kind === "playtime") {
          if (
            !Number.isFinite(data.playTimeInSeconds) ||
            data.playTimeInSeconds < 0 ||
            data.playTimeInSeconds > 1e12
          )
            return json({ message: "Invalid playtime" }, 400);
          patch = {
            playTimeInMilliseconds: Math.trunc(data.playTimeInSeconds * 1000),
            hasManuallyUpdatedPlaytime: true,
          };
        } else
          patch = kind.includes("favorite")
            ? { isFavorite: kind === "favorite" }
            : { isPinned: kind === "pin" };
        const [result] = await merge([
          { shop, objectId: decodeURIComponent(objectId), ...patch },
        ]);
        return json(result);
      }
      // Explicit pending response instead of fabricated social/cloud data or Hydra credentials.
      return json(
        {
          message: "This service still needs its Orbit implementation",
          code: "orbit-service-pending",
        },
        501
      );
    } catch (error) {
      const status = [400, 401, 403, 409, 413, 429].includes(error.status)
        ? error.status
        : 503;
      return json(
        {
          message:
            status === 401
              ? "Orbit sign-in required"
              : "Orbit service unavailable",
        },
        status
      );
    }
  };
}
