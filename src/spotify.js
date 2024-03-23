import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let sdk = SpotifyApi.withClientCredentials("", "");

export function initSdk(clientId, secret) {
  sdk = SpotifyApi.withClientCredentials(clientId, secret, [
    "user-library-modify",
  ]);
}

export async function findSong(songName, artist, album) {
  const q =
    songName +
    (artist ? ` artist:${artist}` : "") +
    (album ? ` album:${album}` : "");

  const batch = 50;
  let results = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    try {
      const { tracks } = await sdk.search(q, ["track"], undefined, batch);
      results = results.concat(
        tracks.items.map((t) => ({
          id: t.id,
          url: t.external_urls.spotify,
          name: t.name,
          artist: t.artists.map((a) => a.name),
          album: t.album.name,
        }))
      );
      offset = offset + batch;
      total = tracks.total;
    } catch (e) {
      if (e.message.includes("rate limit")) {
        console.warn("Rate limited...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw e;
      }
    }
  }

  return results;
}
