import { FunctionComponent, ReactNode, useEffect, useState } from "react";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import { Carousel } from "react-responsive-carousel";
import { MediaDisplay } from "../components/MediaDisplay";
import { useMediaPlayerStore, useUserStore } from "../store/store";
import { Spinner } from "../components/Spinner";
import { useLocation } from "wouter";
import { isAmbient } from "../ambient";

/**
 * Carousel component to display the media players.
 * Has arrows to navigate through the media players.
 * Takes the whole available width and height.
 */
export const MediaPlayers: FunctionComponent = () => {
  const { mediaPlayers, getMediaPlayers, selectedMediaPlayer } = useMediaPlayerStore((state) => state);
  const {
    configuration: { plexToken, autoDisplayAlbums },
  } = useUserStore((state) => state);
  const [, setLocation] = useLocation();
  const [showAlbumTimeout, setShowAlbumTimeout] = useState<NodeJS.Timeout | undefined>();
  const ambient = isAmbient();

  useEffect(() => {
    if (!mediaPlayers?.length && plexToken) {
      getMediaPlayers();
    }
  }, [mediaPlayers, getMediaPlayers]);

  // Ambient (TV screensaver): the album gallery is home base. Sit on Now Playing
  // only while something is actually playing; otherwise show the showcase — this
  // also covers the case where there are NO players at all (which used to hang
  // on a spinner forever), since the showcase now loads from the server.
  useEffect(() => {
    if (!ambient) return;
    if (!mediaPlayers.some((p) => p.state === "playing")) {
      setLocation("/albums");
    }
  }, [ambient, mediaPlayers, setLocation]);

  useEffect(() => {
    // Non-ambient: if the selected player has been stopped for a while, fall back
    // to /albums (opt-in via autoDisplayAlbums).
    if (
      !ambient &&
      autoDisplayAlbums &&
      (selectedMediaPlayer?.state === "stopped" || selectedMediaPlayer?.state === "unknown")
    ) {
      setShowAlbumTimeout(
        setTimeout(() => {
          setLocation("/albums");
        }, 30000),
      );
    } else {
      if (showAlbumTimeout) {
        clearTimeout(showAlbumTimeout);
      }
    }

    // clean up on destroy
    return () => {
      if (showAlbumTimeout) {
        clearTimeout(showAlbumTimeout);
      }
    };
  }, [selectedMediaPlayer?.state, ambient, autoDisplayAlbums, setLocation]);

  const customRenderItem = (
    item: any,
    options?:
      | {
          isSelected: boolean;
          isPrevious: boolean;
        }
      | undefined,
  ): ReactNode => <item.type {...item.props} {...options} />;

  if (!mediaPlayers?.length) {
    return <Spinner open />;
  }

  return (
    <Carousel
      showIndicators={false}
      showThumbs={false}
      renderItem={customRenderItem}
      className="presentation-mode"
      swipeable
      showStatus={false}
    >
      {mediaPlayers.map((player) => (
        <MediaDisplay key={player.clientIdentifier} plexamp={player} isSelected={false} />
      ))}
    </Carousel>
  );
};
