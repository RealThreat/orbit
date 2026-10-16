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

The lime Orbit badge derives from the supplied interface reference. Source files:
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
and accept `hydralauncher://` while the existing authentication services return
legacy callbacks. This legacy association is shared with Hydra: the last app to
register it can become the OS handler. Full protocol coexistence requires a
separate authentication/compatibility decision; it is not claimed here.

Hydra API/auth/checkout/cloud/Decky integrations, service-specific logos,
account wording, URLs and upstream dependency identities are retained. Changing
Orbit's public identity does not make those services Orbit-owned.

## Before public distribution

Test native startup, installer and uninstall behavior, protocol registration,
account callbacks and updates on clean machines. Confirm that release workflows
have the required build configuration; inherited automation is retained and has
not been converted into a new public release pipeline. Code signing and actual
Windows/macOS/Linux installer testing are separate release tasks.
