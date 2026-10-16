import axios from "axios";
import { live, xnet } from "@xboxreplay/xboxlive-auth";
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromAccountId,
  getUserTrophyProfileSummary,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
} from "psn-api";
import type {
  ConsoleProvider,
  ConsoleTitle,
} from "../../../types/console-accounts.types";
import {
  collectConsolePages,
  ConsoleAccountError,
  psnTitle,
  xboxTitle,
  psnAchievements,
  xboxAchievement,
  record,
  rows,
} from "./normalization";

export interface ConsoleSession {
  provider: ConsoleProvider;
  accountId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userHash?: string;
  clientId?: string;
}
export const XBOX_SCOPE = "XboxLive.signin XboxLive.offline_access";
export const XBOX_REDIRECT = "https://login.live.com/oauth20_desktop.srf";

async function deadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ConsoleAccountError("network")),
          30_000
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export async function connectPsn(npsso: string): Promise<ConsoleSession> {
  if (typeof npsso !== "string" || npsso.length !== 64 || /\s/.test(npsso))
    throw new ConsoleAccountError("auth");
  const code = await deadline(exchangeNpssoForAccessCode(npsso));
  const tokens = await deadline(exchangeAccessCodeForAuthTokens(code));
  const summary = await deadline(getUserTrophyProfileSummary(tokens, "me"));
  const profile = await deadline(
    getProfileFromAccountId(tokens, summary.accountId)
  );
  return {
    provider: "psn",
    accountId: summary.accountId,
    displayName: profile.onlineId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
}
async function xboxTokens(
  accessToken: string,
  refreshToken: string,
  clientId: string
): Promise<ConsoleSession> {
  const user = await deadline(
    xnet.exchangeRpsTicketForUserToken(accessToken, "d")
  );
  const xsts = await deadline(
    xnet.exchangeTokenForXSTSToken(user.Token, {
      XSTSRelyingParty: "http://xboxlive.com",
      optionalDisplayClaims: ["gtg", "xid"],
    })
  );
  const claims = record(xsts.DisplayClaims.xui[0]);
  if (
    typeof claims.xid !== "string" ||
    !/^\d+$/.test(claims.xid) ||
    typeof claims.uhs !== "string"
  )
    throw new ConsoleAccountError("auth");
  return {
    provider: "xbox",
    accountId: claims.xid,
    displayName: typeof claims.gtg === "string" ? claims.gtg : claims.xid,
    accessToken: xsts.Token,
    refreshToken,
    userHash: claims.uhs,
    clientId,
    expiresAt: Date.parse(xsts.NotAfter),
  };
}
export async function connectXboxCode(
  code: string,
  clientId: string
): Promise<ConsoleSession> {
  const tokens = await deadline(
    live.exchangeCodeForAccessToken(code, clientId, XBOX_SCOPE, XBOX_REDIRECT)
  );
  if (!tokens.refresh_token) throw new ConsoleAccountError("auth");
  return xboxTokens(tokens.access_token, tokens.refresh_token, clientId);
}
export async function refreshConsoleSession(
  session: ConsoleSession
): Promise<ConsoleSession> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (session.provider === "psn") {
    const tokens = await deadline(
      exchangeRefreshTokenForAuthTokens(session.refreshToken)
    );
    return {
      ...session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
  }
  if (!session.clientId) throw new ConsoleAccountError("not-configured");
  const tokens = await deadline(
    live.refreshAccessToken(session.refreshToken, session.clientId, XBOX_SCOPE)
  );
  const refreshed = await xboxTokens(
    tokens.access_token,
    tokens.refresh_token || session.refreshToken,
    session.clientId
  );
  if (refreshed.accountId !== session.accountId)
    throw new ConsoleAccountError("account-changed");
  return refreshed;
}
async function xboxGet(
  session: ConsoleSession,
  path: string,
  contract: 1 | 2,
  params: Record<string, string | number> = {}
) {
  return (
    await axios.get<unknown>(
      `https://achievements.xboxlive.com/users/xuid(${session.accountId})/${path}`,
      {
        params,
        timeout: 30_000,
        maxRedirects: 0,
        headers: {
          Authorization: `XBL3.0 x=${session.userHash};${session.accessToken}`,
          "x-xbl-contract-version": String(contract),
          "Accept-Language": "en-US",
        },
      }
    )
  ).data;
}
export async function scanConsoleTitles(
  session: ConsoleSession
): Promise<ConsoleTitle[]> {
  if (session.provider === "psn")
    return collectConsolePages(async (cursor) => {
      const page = await deadline(
        getUserTitles(session, "me", {
          limit: 800,
          offset: Number(cursor ?? 0),
        })
      );
      return {
        items: page.trophyTitles.map(psnTitle),
        next:
          page.nextOffset !== undefined ? String(page.nextOffset) : undefined,
      };
    });
  const titles: ConsoleTitle[] = [];
  // The Xbox 360 and modern achievement APIs have different contracts and IDs.
  for (const contract of [1, 2] as const) {
    titles.push(
      ...(await collectConsolePages(async (cursor) => {
        const page = record(
          await xboxGet(session, "history/titles", contract, {
            maxItems: 100,
            ...(cursor ? { continuationToken: cursor } : {}),
          })
        );
        const paging = page.pagingInfo ? record(page.pagingInfo) : {};
        return {
          items: rows(page.titles).map((value) => xboxTitle(value, contract)),
          next:
            typeof paging.continuationToken === "string"
              ? paging.continuationToken
              : undefined,
        };
      }))
    );
  }
  return [...new Map(titles.map((title) => [title.id, title])).values()];
}
export async function fetchConsoleAchievements(
  session: ConsoleSession,
  title: ConsoleTitle
) {
  if (session.provider === "psn") {
    const options = {
      npServiceName: title.psnService ?? "trophy",
      limit: 800,
    } as const;
    const metadata = await collectConsolePages(async (cursor) => {
      const page = await deadline(
        getTitleTrophies(session, title.remoteId, "all", {
          ...options,
          offset: Number(cursor ?? 0),
        })
      );
      return {
        items: page.trophies,
        next:
          page.nextOffset !== undefined ? String(page.nextOffset) : undefined,
      };
    });
    const earned = await collectConsolePages(async (cursor) => {
      const page = await deadline(
        getUserTrophiesEarnedForTitle(session, "me", title.remoteId, "all", {
          ...options,
          offset: Number(cursor ?? 0),
        })
      );
      return {
        items: page.trophies,
        next:
          page.nextOffset !== undefined ? String(page.nextOffset) : undefined,
      };
    });
    return psnAchievements(metadata, earned);
  }
  const contract = title.xboxContract ?? 2;
  return collectConsolePages(async (cursor) => {
    const page = record(
      await xboxGet(
        session,
        contract === 1 ? "titleachievements" : "achievements",
        contract,
        {
          titleId: title.remoteId,
          maxItems: 100,
          ...(cursor ? { continuationToken: cursor } : {}),
        }
      )
    );
    const paging = page.pagingInfo ? record(page.pagingInfo) : {};
    return {
      items: rows(page.achievements).map((value) =>
        xboxAchievement(value, contract)
      ),
      next:
        typeof paging.continuationToken === "string"
          ? paging.continuationToken
          : undefined,
    };
  });
}
