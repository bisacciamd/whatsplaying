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
  // In ambient (TV screensaver) mode always fall back to the showcase, and sooner.
  const shouldShowAlbums = ambient || autoDisplayAlbums;
  const idleDelay = ambient ? 8000 : 30000;

  useEffect(() => {
    if (!mediaPlayers?.length && plexToken) {
      getMediaPlayers();
    }
  }, [mediaPlayers, getMediaPlayers]);

  useEffect(() => {
    // if the selected player has been stopped for a while, redirect to /albums
    if (shouldShowAlbums && (selectedMediaPlayer?.state === "stopped" || selectedMediaPlayer?.state === "unknown")) {
      setShowAlbumTimeout(
        setTimeout(() => {
          setLocation("/albums");
        }, idleDelay),
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
  }, [selectedMediaPlayer?.state, shouldShowAlbums, idleDelay, setLocation]);

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
