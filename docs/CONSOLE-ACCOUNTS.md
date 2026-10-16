# Online console trophies (experimental)

Orbit includes a separate **Console trophies** screen under the sidebar and
Settings → Integrations. It reads the signed-in user's games and achievement
data from PSN/Xbox services. It does not unlock trophies, modify console data,
replace existing PC achievements, or upload these records to Hydra.

## Current coverage

- PS3/PS4 (legacy `trophy` service) and PS5 (`trophy2`): game summaries,
  trophy grades, completion counts, earned state and unlock dates.
- Xbox 360: achievement contract v1; Xbox One/Series X|S: contract v2.
  Modern results can identify a title broadly as Xbox One; Orbit cannot infer
  which physical console earned an achievement when the service does not say.
  Modern title totals remain unknown until the detailed achievement list is read.
- Only data already synchronized to the networks can be retrieved. Private,
  unavailable and unsupported service data may not be readable.
- List scans are manual. Trophy details are fetched when a game is opened,
  cached locally, and refreshed after a new scan or cache expiry.

These are community integrations, not official Sony/Microsoft integrations.
The code has been tested with fixtures and mocked providers, not with live
accounts. Live account and clean-machine tests are required before advertising
support or distributing this feature as stable.

## PlayStation connection

The UI links to the official PlayStation sign-in website and Sony's
`https://ca.account.sony.com/api/v1/ssocookie` page. In the same external browser,
the account owner copies the `npsso` value into Orbit's password-style field.
The application exchanges it for access/refresh tokens. **NPSSO is a credential
equivalent to account access: never send it in chat, a bug report, source code
or logs.** Orbit does not persist NPSSO and does not ask for a Sony password.
When the refresh token expires, reconnect through the same flow.

Reference: [psn-api authentication](https://psn-api.achievements.app/authentication/authenticating-manually)
and [trophy endpoints](https://psn-api.achievements.app/api-docs/user-trophies).

## Xbox application registration still required

No Microsoft application was registered during implementation. No borrowed
Microsoft application/client ID is included. Until Orbit's own public client
ID is configured, the UI explicitly shows Xbox sign-in as unconfigured.

The owner must register **Orbit Launcher** in a Microsoft account/tenant they
control, select support for personal Microsoft accounts, and configure it as a
desktop/public client with redirect URI:

```text
https://login.live.com/oauth20_desktop.srf
```

Check that Microsoft accepts the intended Xbox scopes for this registration:
`XboxLive.signin XboxLive.offline_access`. App registration alone does not
guarantee Xbox API access or permission for public distribution. Resolve any
partner/approval requirements with Microsoft rather than bypassing them.

Set the **public application/client ID**, not a secret:

```dotenv
MAIN_VITE_XBOX_CLIENT_ID=<Orbit's Microsoft application ID>
```

Set the same GitHub Actions repository variable for native CI builds; the build
and release workflows pass it to Electron Vite. Rebuild after configuration.
Never embed a Microsoft client secret in a desktop app.

Orbit opens a sandboxed, isolated Microsoft sign-in window, checks the exact
callback origin/path and a per-attempt OAuth state, exchanges the code for Xbox
tokens and refreshes them when required. Passwords/2FA are handled on Microsoft's
page. Cancelling the window cancels sign-in.

References: [Microsoft app registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app),
[XboxReplay's custom-app documentation](https://github.com/XboxReplay/xboxlive-auth/blob/master/docs/02-Custom_Azure_Application.md),
[OpenXbox achievement contracts](https://github.com/OpenXbox/xbox-webapi-python/blob/master/xbox/webapi/api/provider/achievements/__init__.py).

## Storage and failure behavior

Records live under `<Orbit userData>/console-accounts/`, separately from the
existing Hydra/PC achievement stores. Sessions and cached account data are
encrypted with Electron `safeStorage`. Connection fails closed if encryption
is unavailable, including Linux's `basic_text` fallback. No tokens or SDK/HTTP
error contents are returned through the preload API.

Operations are serialized per provider. Account IDs are checked on every
mutation/detail request; a stale renderer cannot act on a replacement account.
A failed or incomplete list scan does not replace the last successful snapshot.
Rotated refresh credentials are saved even if the subsequent scan fails.
Switching accounts retains earlier encrypted records; disconnecting removes
the active account's stored session while retaining its last scan. These actions
do not revoke the provider-side authorization; users can revoke access at the
provider separately. Historical account records are not automatically deleted.

Provider-prefixed game IDs keep PSN/Xbox/PC identities distinct. PSN metadata
and earned state are joined by trophy ID; locked secret descriptions remain
hidden in the UI. Repeated pagination cursors and unrecognized payloads fail
the scan instead of reporting partial results as complete.

## Third-party notices

`psn-api` (MIT) and `@xboxreplay/xboxlive-auth` (Apache-2.0) are added without
removing dependencies. Their license texts are copied to
`resources/console-integrations/` and included in packaged resources.
