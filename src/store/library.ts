import { Library, LibraryItem, Playlist } from "./library.interface";
import { mediaPlayerHeaders } from "./utils/getHeaders";
import { MediaPlayer } from "./media-player.type";

// Cap how many albums we pull (and therefore how many <img> the carousel mounts)
// per music section. Without this, a large library fetched every album and
// mounted thousands of DOM nodes, hanging the Album Library (upstream issue #12).
const MAX_ALBUMS_PER_LIBRARY = 250;

const buildThumb = (player: MediaPlayer, thumbUrl: string | undefined): string => {
  const thumbSize = "width=1080&height=1080";
  const thumbParameters = `url=${thumbUrl}&quality=90&format=jpeg&X-Plex-Token=${player.token}`;
  // Build against the server URI. The old code produced a scheme-less
  // "address:port/..." string; `new URL()` in <AlbumCover> then threw and blanked
  // the whole Album Library to a black screen (upstream issue #12).
  return `${player.server.uri}/photo/:/transcode?${thumbSize}&${thumbParameters}`;
};

export const getLibrary = async (player: MediaPlayer, librariesToHide: string[]): Promise<LibraryItem[]> => {
  const response = await fetch(`${player.server.uri}/library/sections/`, {
    headers: mediaPlayerHeaders(player),
  });

  const library: Library = await response.json();
  // Filter hidden libraries *before* fetching their albums, not after.
  const musicLibraries = library.MediaContainer.Directory.filter(
    (directory) => directory.type === "artist" && !librariesToHide?.includes(directory.title.trim().toLowerCase()),
  );
  return getAlbums(player, musicLibraries);
};

const getAlbums = async (
  player: MediaPlayer,
  library: Library["MediaContainer"]["Directory"],
): Promise<LibraryItem[]> => {
  const containers = await Promise.all(
    library.map(async (libraryItem) => {
      const params = new URLSearchParams({
        type: "9",
        excludeFields: "summary",
        excludeElements: "Media,Director,Country",
        sort: "random",
        includeFields: "thumbBlurHash",
        "X-Plex-Container-Start": "0",
        "X-Plex-Container-Size": String(MAX_ALBUMS_PER_LIBRARY),
      });
      const response = await fetch(`${player.server.uri}/library/sections/${libraryItem.key}/all?${params.toString()}`, {
        headers: mediaPlayerHeaders(player),
      });
      const container = await response.json();
      const musicLibrary: LibraryItem = container.MediaContainer;
      const metadata = (musicLibrary.Metadata ?? []).map((album) => ({
        ...album,
        thumb: buildThumb(player, album?.thumb),
      }));
      return { ...musicLibrary, Metadata: metadata } as LibraryItem;
    }),
  );
  return containers;
};

/**
 * Fetches the audio playlists from the server.
 */
export const getPlaylists = async (player: MediaPlayer): Promise<Playlist[]> => {
  const response = await fetch(`${player.server.uri}/playlists?playlistType=audio`, {
    headers: mediaPlayerHeaders(player),
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  const playlists: Playlist[] = data.MediaContainer?.Metadata ?? [];
  return playlists.map((playlist) => ({
    ...playlist,
    thumb: playlist.composite ? buildThumb(player, playlist.composite) : playlist.thumb,
  }));
};
