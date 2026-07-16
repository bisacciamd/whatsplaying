import React, { useEffect, useMemo, useState } from "react";
import { Box, Container, Grid, IconButton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ArrowBack, PlayArrow } from "@mui/icons-material";
import { Carousel } from "react-responsive-carousel";
import { AlbumCover } from "../components/AlbumCover";
import { useLocation } from "wouter";
import { useLibraryStore, useMediaPlayerStore, useUserStore } from "../store/store";
import { Spinner } from "../components/Spinner";

type LibraryMode = "albums" | "playlists";

const MusicLibrary: React.FC = () => {
  const { library, getLibrary, playlists, getPlaylists, playAlbum, playPlaylist } = useLibraryStore((state) => state);
  const {
    configuration: { plexToken, intervalBetweenAlbums },
  } = useUserStore((state) => state);
  const { selectedMediaPlayer } = useMediaPlayerStore((state) => state);
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<LibraryMode>("albums");

  // Flatten every music library, not just the first one (each is already
  // randomly sorted and capped server-side).
  const albums = useMemo(() => library.flatMap((item) => item.Metadata ?? []), [library]);

  useEffect(() => {
    if (!selectedMediaPlayer || !plexToken) {
      return;
    }
    if (!library?.length) {
      getLibrary(selectedMediaPlayer);
    }
  }, [library, getLibrary, selectedMediaPlayer, plexToken]);

  useEffect(() => {
    if (mode === "playlists" && selectedMediaPlayer && plexToken && !playlists.length) {
      getPlaylists(selectedMediaPlayer);
    }
  }, [mode, playlists.length, getPlaylists, selectedMediaPlayer, plexToken]);

  // Redirect out of render, not during it (the old code called setLocation while
  // rendering, which React warns about and can loop).
  useEffect(() => {
    if (!selectedMediaPlayer) {
      setLocation("/");
    }
  }, [selectedMediaPlayer, setLocation]);

  const handlePlayAlbum = (ratingKey: string) => {
    if (!selectedMediaPlayer) return;
    playAlbum(selectedMediaPlayer, ratingKey);
    setLocation("/");
  };

  const handlePlayPlaylist = (ratingKey: string) => {
    if (!selectedMediaPlayer) return;
    playPlaylist(selectedMediaPlayer, ratingKey);
    setLocation("/");
  };

  if (!selectedMediaPlayer) {
    return <Spinner open />;
  }

  const showAlbumsSpinner = mode === "albums" && !albums.length;
  const showPlaylistsSpinner = mode === "playlists" && !playlists.length;

  return (
    <Box sx={{ backgroundColor: "black", minHeight: "100vh" }}>
      <Grid
        container
        justifyContent="space-between"
        alignItems="center"
        sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, padding: "8px 16px" }}
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
          centerMode
          autoPlay
          infiniteLoop
          swipeable
          showStatus={false}
          interval={intervalBetweenAlbums * 1000}
        >
          {albums.map((album) => (
            <Container key={album.key}>
              <AlbumCover mediaUrl={album.thumb} />
              <Grid container className="legend" justifyContent="space-between" alignItems="center">
                <IconButton onClick={() => handlePlayAlbum(album.ratingKey)} aria-label={`play ${album.title}`}>
                  <PlayArrow color="secondary" fontSize="large" />
                </IconButton>
                <Box>
                  <Typography variant="h5" color="white">
                    {album.title}
                  </Typography>
                  <Typography variant="subtitle1" color="white">
                    {album.parentTitle}
                  </Typography>
                </Box>
                <div /> {/* Empty div for spacing */}
              </Grid>
            </Container>
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
