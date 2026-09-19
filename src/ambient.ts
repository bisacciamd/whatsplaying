/**
 * "Ambient" mode is for a passive display (e.g. a TV screensaver): the app boots
 * straight into the album showcase, never shows interactive chrome, and returns
 * to Now Playing on its own when music starts. Enabled by loading the app with
 * `?ambient=1` (the Android TV screensaver points its WebView at that URL).
 */
export const isAmbient = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has("ambient");
  } catch {
    return false;
  }
};
