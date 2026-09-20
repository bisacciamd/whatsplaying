import { CSSProperties, FunctionComponent, useMemo } from "react";

interface IAlbumProps {
  mediaUrl: string | undefined;
  /** Apply the slow Ken-Burns drift (used for the current showcase slide). */
  drift?: boolean;
  /** Drift cycle length; matched to the showcase interval so it feels intentional. */
  driftDurationMs?: number;
}

// Ask Plex for a transcode sized to the actual device pixels (capped at 4K) so
// the cover is sharp on a high-DPI TV instead of a 1080px image upscaled 2x.
const targetPx = (): number => {
  const h = window.innerHeight || 1080;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(2160, Math.round(h * dpr));
};

export const AlbumCover: FunctionComponent<IAlbumProps> = ({ mediaUrl, drift, driftDurationMs }) => {
  const getMediaUrl = (url: string) => {
    try {
      const u = new URL(url);
      const px = targetPx().toString();
      u.searchParams.set("width", px);
      u.searchParams.set("height", px);
      return u.toString();
    } catch {
      // A malformed URL should just show a broken image, never crash the render.
      return url;
    }
  };

  // Randomised per-cover drift direction so no two covers age the panel identically.
  const driftVars = useMemo<CSSProperties>(() => {
    const dx = (Math.random() * 2 - 1) * 1.5; // -1.5%..+1.5%
    const dy = (Math.random() * 2 - 1) * 1.5;
    return {
      ["--wp-drift-x" as string]: `${dx}%`,
      ["--wp-drift-y" as string]: `${dy}%`,
      ["--wp-drift-dur" as string]: `${driftDurationMs ?? 30000}ms`,
    } as CSSProperties;
  }, [driftDurationMs]);

  if (!mediaUrl) {
    return null;
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img
        className={drift ? "wp-cover-drift" : undefined}
        style={{ objectFit: "contain", maxHeight: "100vh", maxWidth: "100vw", ...(drift ? driftVars : {}) }}
        src={getMediaUrl(mediaUrl)}
        alt="album cover"
      />
    </div>
  );
};
