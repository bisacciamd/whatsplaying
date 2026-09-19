/**
 * "Ambient" mode is for a passive display (e.g. a TV screensaver): the app boots
 * straight into the album showcase, never shows interactive chrome, and returns
 * to Now Playing on its own when music starts. Enabled by loading the app with
 * `?ambient=1` (the Android TV screensaver points its WebView at that URL).
 *
 * The value is captured once, at first read on boot, because client-side
 * navigation (wouter) drops the query string — so we can't re-read it later.
 */
let cached: boolean | null = null;

export const isAmbient = (): boolean => {
  if (cached === null) {
    try {
      cached = new URLSearchParams(window.location.search).has("ambient");
    } catch {
      cached = false;
    }
  }
  return cached;
};
