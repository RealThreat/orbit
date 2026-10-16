/** Orbit's public identity. Service names and persisted Hydra keys stay compatible. */
export const APP_NAME = "Orbit";
export const APP_DISPLAY_NAME = "Orbit Launcher";
export const APP_ID = "io.github.realthreat.orbit";
export const APP_PROTOCOL = "orbitlauncher";
export const LEGACY_APP_PROTOCOL = "hydralauncher";
export const APP_RELEASE_OWNER = "RealThreat";
export const APP_RELEASE_REPO = "orbit";
export const APP_REPOSITORY_URL = `https://github.com/${APP_RELEASE_OWNER}/${APP_RELEASE_REPO}`;
export const APP_RELEASES_URL = `${APP_REPOSITORY_URL}/releases`;

export const isAppDeepLink = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return (
      protocol === `${APP_PROTOCOL}:` || protocol === `${LEGACY_APP_PROTOCOL}:`
    );
  } catch {
    return false;
  }
};

export const isRunDeepLink = (value?: string): boolean => {
  if (!value || !isAppDeepLink(value)) return false;
  return new URL(value).hostname === "run";
};
