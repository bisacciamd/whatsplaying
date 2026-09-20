// @ts-ignore
import XMLParser from "react-xml-parser";
import { BaseMediaPlayerServer, PlexConnection, PlexResource, PlexSonosResource, PlexUser } from "./server.interface";
import { MediaPlayer } from "./media-player.type";
import { getClientIdentifier } from "./utils/clientIdentifier";

const getHeaders = (token: string) => ({
  "X-Plex-Version": "1.0",
  "X-Plex-Product": "What's Playing",
  "X-Plex-Client-Identifier": getClientIdentifier(),
  "X-Plex-Device": "Web",
  "X-Plex-Platform": "Web",
  "X-Plex-Platform-Version": "1.0",
  "X-Plex-Provides": "player",
  "X-Plex-Device-Name": "What's Playing",
  "X-Plex-Token": token,
  "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  Accept: "application/json",
});

/**
 * Picks the best connection for a resource: prefer a direct local one, then any
 * non-relay connection, falling back to the first. Blindly taking connections[0]
 * (the old behaviour) picked whatever Plex happened to list first — often a relay
 * or WAN address that fails on the home LAN (upstream issue #13).
 */
function selectConnection(connections: PlexConnection[]): PlexConnection {
  return connections.find((c) => c.local && !c.relay) ?? connections.find((c) => !c.relay) ?? connections[0];
}

export async function getUser(token: string): Promise<PlexUser> {
  const response = await fetch("https://plex.tv/api/v2/user", {
    headers: getHeaders(token),
    method: "GET",
  });
  if (response.status === 401) {
    // TODO: refresh token
  }
  return response.json();
}

/**
 * Builds a synthetic "player" that points at the Plex server itself. The album
 * library only needs the server (URI + token), not a real client — so this lets
 * the showcase run 24/7 as a screensaver even when no Plexamp/client/Sonos is
 * awake. It must NOT be used for playback (there's no client to play on).
 */
export async function getServerPlayer(token: string): Promise<MediaPlayer | undefined> {
  const response = await fetch(`https://plex.tv/api/v2/resources`, {
    headers: getHeaders(token),
    method: "GET",
  });
  if (response.status === 401) {
    throw new Error("The Plex token is invalid! Please update it in the settings. You are going to be redirected", {
      cause: "token",
    });
  }
  const resources = await response.json();
  const server = getServerInfo(resources);
  if (!server) {
    return undefined;
  }
  return {
    name: "What's Playing",
    product: "What's Playing",
    productVersion: "1.0",
    clientIdentifier: getClientIdentifier(),
    protocol: server.protocol,
    address: server.address,
    port: server.port,
    uri: server.uri,
    token: token,
    server: server,
    state: "unknown",
    shuffle: "0",
    repeat: "0",
    volume_level: 0,
    is_volume_muted: false,
    duration: 0,
    time: 0,
    isServer: true,
  };
}

/**
 * Function that gets all the media players available in the network.
 * It fetches the resources from the plex.tv API and filters the clients and sonos resources.
 * @returns An array of media players sorted by name and state.
 */
export async function getMediaPlayers(token: string): Promise<MediaPlayer[]> {
  try {
    const response = await fetch(`https://plex.tv/api/v2/resources`, {
      headers: getHeaders(token),
      method: "GET",
    });
    const resources = await response.json();
    if (response.status === 401) {
      throw new Error("The Plex token is invalid! Please update it in the settings. You are going to be redirected", {
        cause: "token",
      });
    }
    const server = getServerInfo(resources);
    if (!server) {
      throw new Error("We couldn't find a server in your local network :(");
    }
    const clients = await getClients(resources, server, token);
    const sonos = await getSonosResource(server, token);

    return (
      [...clients, ...sonos]
        // sorts by name
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  } catch (error: any) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An error occurred while fetching the media players", error);
  }
}

/**
 * Function that gets the sonos resources from the plex.tv API.
 * @returns An array of sonos media players.
 * @param server
 */
async function getSonosResource(server: BaseMediaPlayerServer, token: string): Promise<MediaPlayer[]> {
  try {
    const response = await fetch(`https://sonos.plex.tv/resources`, {
      headers: getHeaders(token),
      method: "GET",
    });
    const data = await response.text();

    const json = new XMLParser().parseFromString(data, "application/xml");
    return json.children.map(({ attributes }: { attributes: PlexSonosResource }) => ({
      name: attributes.title,
      product: attributes.product,
      productVersion: attributes.platformVersion,
      clientIdentifier: attributes.machineIdentifier,
      protocol: attributes.protocol,
      address: attributes.lanIP,
      uri: "https://sonos.plex.tv",
      token: token,
      server: server,
      state: "unknown",
      media_duration: 0,
      media_position: 0,
      shuffle: "0",
      repeat: "0",
      volume_level: 0,
      is_volume_muted: false,
    }));
  } catch {
    console.log("No Sonos devices found, skipping...");
    return [];
  }
}

/**
 * Function that gets the server info from the resources.
 * @returns The server info to be used in the media players.
 * @param resources
 */
function getServerInfo(resources: PlexResource[]): BaseMediaPlayerServer | undefined {
  const server = resources.find((resource) => resource.provides === "server");
  if (!server) {
    return undefined;
  }
  const connection = selectConnection(server.connections);
  return {
    client_identifier: server.clientIdentifier,
    protocol: connection.protocol,
    address: connection.address,
    port: connection.port,
    uri: connection.uri,
  };
}

/**
 * Function that gets the clients from the resources, filtering out the clients that are not available.
 * @returns An array of media players.
 */
async function getClients(
  resources: PlexResource[],
  server: BaseMediaPlayerServer,
  token: string,
): Promise<MediaPlayer[]> {
  // should find all the resources that are not the server, returning an array
  const clients = resources.filter((resource) => resource.provides.match("client"));

  // Probe every client in parallel and keep only the reachable ones. The old
  // code iterated while splicing the same array in a .catch(), which skipped the
  // element after every unreachable one (leaving ghost devices in the carousel)
  // and ran the 5s timeouts sequentially.
  const probed = await Promise.all(
    clients.map(async (client) => {
      const connection = selectConnection(client.connections);
      try {
        await fetchWithTimeout(`${connection.uri}/resources`, {
          headers: getHeaders(token),
          method: "GET",
        });
        return { client, connection };
      } catch {
        return null;
      }
    }),
  );

  return probed
    .filter((entry): entry is { client: PlexResource; connection: PlexConnection } => entry !== null)
    .map(({ client, connection }) => ({
      name: client.name,
      product: client.product,
      productVersion: client.platformVersion,
      clientIdentifier: client.clientIdentifier,
      protocol: connection.protocol,
      address: connection.address,
      port: connection.port,
      uri: connection.uri,
      token: token,
      server: server,
      state: "unknown",
      media_duration: 0,
      media_position: 0,
      shuffle: "0",
      repeat: "0",
      volume_level: 0,
      is_volume_muted: false,
      duration: 0,
      time: 0,
    }));
}

function fetchWithTimeout(url: string, options: RequestInit, timeout = 5000): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Set up the timeout
    const timer = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, timeout);

    // Fetch the resource
    fetch(url, options)
      .then((response) => {
        // Clear the timeout
        clearTimeout(timer);

        // Resolve the fetch promise
        resolve(response);
      })
      .catch((error) => {
        // Clear the timeout
        clearTimeout(timer);

        // Reject the fetch promise
        reject(error);
      });
  });
}
