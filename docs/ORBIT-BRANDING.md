# Orbit identity

Orbit is an independent fork of Hydra maintained in `RealThreat/orbit`.
It is not an official Hydra release. The original MIT license and copyright
remain in `LICENSE`; upstream dependencies retain their own licenses.

## Application and distribution

- Product/window name: **Orbit**; package: `orbit-launcher`.
- Application ID: `io.github.realthreat.orbit`.
- Windows executable: `Orbit.exe`.
- Installer: `orbit-launcher-<version>-setup.exe`; portable:
  `orbit-launcher-<version>-portable.exe`.
- Update feed: GitHub releases in `RealThreat/orbit`, configured both in
  `electron-builder.yml` and the runtime's shared branding constants.
- The version remains inherited from the fork until a release version is chosen.
  No public release or installer publication is part of this change.

## Assets

The current Orbit badge is a geometric open O with a detached violet corner,
on a dark background. The first planet/ring version is retained under
`resources/orbit/archive-v1/`. Source files:
`resources/orbit/logo.svg` (badge) and
`src/renderer/src/assets/icons/orbit.svg` (monochrome symbol).

Run `npm run brand:assets` to regenerate PNG, Windows ICO, macOS ICNS,
tray icons and the Windows installer sidebar. Generated files live under
`build/orbit/` and `resources/orbit/`. Original Hydra assets are kept in place.
The Big Picture symbol is retained separately under its assets directory.

## Data and compatibility

Orbit uses its own `Orbit` folder under Electron's platform app-data directory.
The existing development override `MAIN_VITE_USER_DATA_PATH` still takes priority.
Hydra profiles are not moved, copied, overwritten or deleted. A previous Hydra
library therefore does not automatically appear in the new Orbit profile.
The internal `hydra-db` name, persistence keys and IPC names remain compatible.

New game shortcuts use `orbitlauncher://run`. Orbit also continues to register
and accept `hydralauncher://` for legacy game-link compatibility. Hydra account
callbacks are refused by the Orbit account client. This legacy association is shared with Hydra: the last app to
register it can become the OS handler. Full protocol coexistence requires a
separate authentication/compatibility decision; it is not claimed here.

Public Hydra catalogue/metadata utilities and Decky release information remain
available without Orbit credentials. Account-facing routes now belong to Orbit;
see `docs/ORBIT-ACCOUNTS.md` for Supabase setup and migration gaps. Service-specific
logos, upstream dependency identities and existing feature implementations are retained.
Changing Orbit's public identity does not make upstream services Orbit-owned.

## Before public distribution

Test native startup, installer and uninstall behavior, protocol registration,
account callbacks and updates on clean machines. Confirm that release workflows
have the required build configuration; inherited automation is retained and has
not been converted into a new public release pipeline. Code signing and actual
Windows/macOS/Linux installer testing are separate release tasks.
