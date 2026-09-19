import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Grid, IconButton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ArrowBack, PlayArrow } from "@mui/icons-material";
import { Carousel } from "react-responsive-carousel";
import { AlbumCover } from "../components/AlbumCover";
import { useLocation } from "wouter";
import { useLibraryStore, useMediaPlayerStore, useUserStore } from "../store/store";
import { Spinner } from "../components/Spinner";
import { isAmbient } from "../ambient";

type LibraryMode = "albums" | "playlists";

// Cap how many covers the showcase cycles through. Plenty of variety for a
// screensaver while bounding how many images the TV WebView can hold at once.
const MAX_SHOWCASE = 100;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MusicLibrary: React.FC = () => {
  const ambient = isAmbient();
  const { library, getLibrary, playlists, getPlaylists, playAlbum, playPlaylist } = useLibraryStore((state) => state);
  const {
    configuration: { plexToken, intervalBetweenAlbums },
  } = useUserStore((state) => state);
  const { selectedMediaPlayer, mediaPlayers, getMediaPlayers, update } = useMediaPlayerStore((state) => state);
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<LibraryMode>("albums");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Source the library/playback from the selected player, or the first available
  // one — so the showcase works even when nothing has been "selected" yet (the
  // ambient/screensaver boot path, which used to bounce back to "/").
  const sourcePlayer = selectedMediaPlayer ?? mediaPlayers[0];

  const albums = useMemo(() => {
    const all = library.flatMap((item) => item.Metadata ?? []);
    return shuffle(all).slice(0, MAX_SHOWCASE);
  }, [library]);

  useEffect(() => {
    if (!sourcePlayer && plexToken && !mediaPlayers.length) {
      getMediaPlayers();
    }
  }, [sourcePlayer, plexToken, mediaPlayers.length, getMediaPlayers]);

  useEffect(() => {
    if (sourcePlayer && plexToken && !library?.length) {
      getLibrary(sourcePlayer);
    }
  }, [sourcePlayer, plexToken, library, getLibrary]);

  useEffect(() => {
    if (mode === "playlists" && sourcePlayer && plexToken && !playlists.length) {
      getPlaylists(sourcePlayer);
    }
  }, [mode, playlists.length, getPlaylists, sourcePlayer, plexToken]);

  // Screensaver behaviour: while the gallery is showing, poll the players and
  // jump back to Now Playing as soon as any device starts playing.
  useEffect(() => {
    if (mode !== "albums" || !plexToken) return;
    const id = setInterval(async () => {
      if (isInteracting) return;
      const players = useMediaPlayerStore.getState().mediaPlayers;
      for (const p of players) {
        await update(p);
      }
      if (useMediaPlayerStore.getState().mediaPlayers.some((p) => p.state === "playing")) {
        setLocation("/");
      }
    }, 8000);
    return () => clearInterval(id);
  }, [mode, plexToken, isInteracting, update, setLocation]);

  const handleInteraction = () => {
    if (ambient) return; // passive display never shows chrome
    setIsInteracting(true);
    clearTimeout(interactTimeout.current);
    interactTimeout.current = setTimeout(() => setIsInteracting(false), 5000);
  };
  const chromeVisible = !ambient && isInteracting;

  const handlePlayAlbum = (ratingKey: string) => {
    if (!sourcePlayer) return;
    playAlbum(sourcePlayer, ratingKey);
    setLocation("/");
  };

  const handlePlayPlaylist = (ratingKey: string) => {
    if (!sourcePlayer) return;
    playPlaylist(sourcePlayer, ratingKey);
    setLocation("/");
  };

  if (!sourcePlayer) {
    return <Spinner open />;
  }

  const showAlbumsSpinner = mode === "albums" && !albums.length;
  const showPlaylistsSpinner = mode === "playlists" && !playlists.length;

  // Only mount the image for the current cover and its immediate neighbours
  // (wrap-aware) so the WebView decodes ~3 images, not all 100.
  const near = (idx: number) => {
    const d = Math.abs(idx - currentIndex);
    return Math.min(d, albums.length - d) <= 1;
  };

  return (
    <Box
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      sx={{ backgroundColor: "black", minHeight: "100vh", overflow: "hidden" }}
    >
      <Grid
        container
        justifyContent="space-between"
        alignItems="center"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          padding: "8px 16px",
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? "auto" : "none",
          transition: "opacity 0.4s ease",
        }}
      >
        <IconButton onClick={() => setLocation("/")} aria-label="back to players">
          <ArrowBack color="secondary" fontSize="large" />
        </IconButton>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next: LibraryMode | null) => next && setMode(next)}
          color="primary"
        >
          <ToggleButton value="albums">Albums</ToggleButton>
          <ToggleButton value="playlists">Playlists</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ width: 48 }} />
      </Grid>

      {showAlbumsSpinner || showPlaylistsSpinner ? (
        <Spinner open />
      ) : mode === "albums" ? (
        <Carousel
          showThumbs={false}
          showIndicators={false}
          showStatus={false}
          animationHandler="fade"
          swipeable={false}
          stopOnHover={false}
          transitionTime={2000}
          autoPlay
          infiniteLoop
          interval={intervalBetweenAlbums * 1000}
          onChange={(i) => setCurrentIndex(i)}
        >
          {albums.map((album, idx) => (
            <Box key={album.key} sx={{ position: "relative", height: "100vh" }}>
              <AlbumCover
                mediaUrl={near(idx) ? album.thumb : undefined}
                drift={idx === currentIndex}
                driftDurationMs={intervalBetweenAlbums * 1000}
              />
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  pt: 12,
                  pb: { xs: 4, md: 6 },
                  px: 4,
                  background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                {chromeVisible && (
                  <IconButton
                    onClick={() => handlePlayAlbum(album.ratingKey)}
                    aria-label={`play ${album.title}`}
                    sx={{ pointerEvents: "auto", mb: 1 }}
                  >
                    <PlayArrow color="primary" sx={{ fontSize: 56 }} />
                  </IconButton>
                )}
                <Typography
                  variant="h2"
                  sx={{
                    color: "#fff",
                    fontWeight: 600,
                    textShadow: "0 2px 16px rgba(0,0,0,0.7)",
                    maxWidth: "92vw",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {album.title}
                </Typography>
                <Typography variant="h5" sx={{ color: "rgba(255,255,255,0.82)", textShadow: "0 1px 10px rgba(0,0,0,0.7)" }}>
                  {[album.parentTitle, album.year, album.Genre?.[0]?.tag].filter(Boolean).join("  ·  ")}
                </Typography>
              </Box>
            </Box>
          ))}
        </Carousel>
      ) : (
        <Grid container spacing={2} sx={{ padding: "72px 16px 16px" }}>
          {playlists.map((playlist) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={playlist.ratingKey}>
              <Box
                onClick={() => handlePlayPlaylist(playlist.ratingKey)}
                role="button"
                aria-label={`play ${playlist.title}`}
                sx={{
                  cursor: "pointer",
                  position: "relative",
                  borderRadius: 1,
                  overflow: "hidden",
                  "&:hover .play-overlay": { opacity: 1 },
                }}
              >
                <img
                  src={playlist.thumb}
                  alt={playlist.title}
                  style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                />
                <Box
                  className="play-overlay"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.4)",
                    opacity: 0,
                    transition: "opacity 0.2s",
                  }}
                >
                  <PlayArrow sx={{ color: "white", fontSize: 48 }} />
                </Box>
              </Box>
              <Typography variant="body2" color="white" noWrap title={playlist.title}>
                {playlist.title}
              </Typography>
              <Typography variant="caption" color="grey.500">
                {playlist.leafCount} tracks
              </Typography>
            </Grid>
          ))}
          {!playlists.length && (
            <Grid item xs={12}>
              <Typography variant="body1" color="white" sx={{ textAlign: "center", marginTop: "10%" }}>
                No audio playlists found.
              </Typography>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default MusicLibrary;
