// @ts-ignore
import XMLParser from "react-xml-parser";
import { Lyrics, MediaPlayer, MetadataFlat, MetadataWithChildren, Queue } from "./media-player.type";
import { mediaPlayerHeaders } from "./utils/getHeaders";

export async function sendPlayBackCommand(mediaPlayer: MediaPlayer, action: string): Promise<void> {
  const response = await fetch(`${mediaPlayer.uri}/player/playback/${action}`, {
    headers: mediaPlayerHeaders(mediaPlayer),
    method: "GET",
  });
  if (!response.ok) {
    console.error("Error sending playback command", response);
    throw new Error(`Error sending playback action: ${action}`);
  }
}

export async function setParameterCommand(mediaPlayer: MediaPlayer, params: string): Promise<void> {
  const response = await fetch(`${mediaPlayer.uri}/player/playback/setParameters?${params}`, {
    headers: mediaPlayerHeaders(mediaPlayer),
    method: "GET",
  });
  if (!response.ok) {
    console.error("Error sending parameter command", response);
    throw new Error(`Error sending parameter command: ${params}`);
  }
}

export async function updateMediaPlayer(mediaPlayer: MediaPlayer, commandId: number): Promise<MediaPlayer> {
  try {
    const baseUrl = `${mediaPlayer.uri}/player/timeline/poll?commandID=${commandId}`;
    const response = await fetch(`${baseUrl}&includeMetadata=1&type=music`, {
      headers: mediaPlayerHeaders(mediaPlayer),
      method: "GET",
    });
    const data = await response.text();
    const json = new XMLParser().parseFromString(data, "application/xml");
    const timeline = json.children.find((child: any) => child.attributes.type === "music");
    mediaPlayer = {
      ...mediaPlayer,
      ...timeline.attributes,
      volume_level: Number(timeline.attributes.volume ?? 0),
      is_volume_muted: timeline.attributes.muted === "1",
      playQueueItemID: Number(timeline.attributes.playQueueItemID ?? 0),
    };

    const queueData = await getPlayQueues(mediaPlayer);
    if (queueData) {
      const currentlyPlaying = queueData.Metadata.find(
        (metadata) => metadata.playQueueItemID === mediaPlayer.playQueueItemID,
      );
      if (!currentlyPlaying) {
        return mediaPlayer;
      }
      const isTidal = currentlyPlaying.attribution === "com.tidal";
      let thumbUrl = isTidal ? currentlyPlaying?.parentThumb : currentlyPlaying?.thumb;
      const thumbSize = "width=1080&height=1080";
      const thumbParameters = `url=${thumbUrl}&quality=90&format=jpeg&X-Plex-Token=${mediaPlayer.token}`;
      // The /photo/:/transcode endpoint lives on the Plex Media Server, so build
      // it from the server URI. The old code used the *client* player's raw
      // address:port over hard-coded https, which failed on many LANs and left
      // the now-playing screen without artwork (upstream issue #13).
      let thumb = isTidal
        ? `https://images.plex.tv/photo/?url=${thumbUrl}`
        : `${mediaPlayer.server.uri}/photo/:/transcode?${thumbSize}&${thumbParameters}`;
      mediaPlayer.metadata = {
        ...flattenMetadata(currentlyPlaying),
        thumb,
      };
      mediaPlayer.queue = queueData;
    }
    return mediaPlayer;
  } catch (e: any) {
    // Don't crash the 1s poll loop, but no longer swallow silently: an
    // unreachable server/player here is exactly why metadata "just doesn't load"
    // with no clue in the console (upstream issue #13).
    console.warn(`Failed to update media player "${mediaPlayer.name}":`, e);
    return mediaPlayer;
  }
}

const flattenMetadata = (metadata: MetadataWithChildren): MetadataFlat => {
  const media = metadata.Media[0];
  const part = media.Part[0];
  const stream = part.Stream.find((stream) => !!stream.key) ?? part.Stream[0];

  return {
    ...metadata,
    Media: {
      ...media,
      Part: {
        ...part,
        Stream: {
          ...stream,
        },
      },
    },
  };
};

const getPlayQueues = async (mediaPlayer: MediaPlayer): Promise<Queue | undefined> => {
  if (!mediaPlayer.containerKey) {
    return undefined;
  }
  // The play queue is served by the Plex Media Server, not the client player.
  const response = await fetch(`${mediaPlayer.server.uri}${mediaPlayer.containerKey}`, {
    headers: mediaPlayerHeaders(mediaPlayer),
    method: "GET",
  });
  if (response.ok) {
    const data = await response.json();
    return data.MediaContainer;
  }
};

export const getLyrics = async (mediaPlayer: MediaPlayer): Promise<Lyrics | undefined> => {
  if (!mediaPlayer.metadata?.Media.Part.Stream?.key) {
    return undefined;
  }
  const baseUrl = `${mediaPlayer.server.uri}${mediaPlayer.metadata?.Media.Part.Stream?.key}`;
  const response = await fetch(baseUrl, {
    headers: mediaPlayerHeaders(mediaPlayer),
    method: "GET",
  });
  if (response.ok) {
    const data = await response.json();
    const lyrics = data.MediaContainer?.Lyrics?.[0];
    // Guard the empty/absent case: `Object.keys(undefined)` used to throw here
    // and escape as an unhandled rejection.
    if (!lyrics || Object.keys(lyrics).length === 0) {
      return undefined;
    }
    return lyrics;
  }
};

/**
 * Creates a play queue on the server for the given album/playlist and starts it
 * on the target player.
 *
 * NOTE: Plex's playMedia protocol varies between players (Plexamp, Plex for
 * clients, Sonos). This follows the documented server-play-queue flow and should
 * be verified against your actual devices.
 *
 * @param player   the client that should start playing
 * @param sourceUri the library uri, e.g. `/library/metadata/{ratingKey}` for an
 *                  album or `/playlists/{id}/items` for a playlist
 * @param commandId monotonically increasing command id for the player subscription
 */
export async function playOnPlayer(player: MediaPlayer, sourceUri: string, commandId: number): Promise<void> {
  const { server } = player;
  const queueUri = `server://${server.client_identifier}/com.plexapp.plugins.library${sourceUri}`;
  const createQueue = new URLSearchParams({
    type: "audio",
    uri: queueUri,
    shuffle: "0",
    repeat: "0",
    continuous: "1",
  });
  const queueResponse = await fetch(`${server.uri}/playQueues?${createQueue.toString()}`, {
    headers: mediaPlayerHeaders(player),
    method: "POST",
  });
  if (!queueResponse.ok) {
    throw new Error(`Could not create play queue (${queueResponse.status})`);
  }
  const queue = await queueResponse.json();
  const playQueueID = queue?.MediaContainer?.playQueueID;
  if (!playQueueID) {
    throw new Error("Server did not return a play queue id");
  }

  const playParams = new URLSearchParams({
    type: "music",
    protocol: server.protocol,
    address: server.address,
    port: String(server.port),
    machineIdentifier: server.client_identifier,
    token: player.token,
    key: sourceUri,
    containerKey: `/playQueues/${playQueueID}`,
    offset: "0",
    commandID: String(commandId),
  });
  const playResponse = await fetch(`${player.uri}/player/playback/playMedia?${playParams.toString()}`, {
    headers: mediaPlayerHeaders(player),
    method: "GET",
  });
  if (!playResponse.ok) {
    throw new Error(`Could not start playback on ${player.name} (${playResponse.status})`);
  }
}
