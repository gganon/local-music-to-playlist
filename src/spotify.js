import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { normalizeName } from "./util.js";

let sdk = SpotifyApi.withClientCredentials("", "");

export function initSdk(clientId, secret) {
  sdk = SpotifyApi.withClientCredentials(clientId, secret, [
    "user-library-modify",
  ]);
}

export async function findSong(title, artist, album) {
  const songs = await Promise.all([
    spotifySearch(
      normalizeName(title),
      normalizeName(artist),
      normalizeName(album)
    ),
    spotifySearch(normalizeName(title), normalizeName(artist)),
  ]).then(([results1, results2]) =>
    results1.length < 1 ? results2 : results1
  );

  const matchedSong = songs.find(
    (song) =>
      normalizeName(song.name) === normalizeName(title) &&
      normalizeName(song.album) === normalizeName(album) &&
      normalizeName(song.artist[0]) === normalizeName(artist)
  );

  const perfectMatch = !!matchedSong;

  return {
    spotifySong: matchedSong?.url || songs[0]?.url || "",
    perfectMatch: JSON.stringify(perfectMatch),
    spotifyResult1: songs[0] ? renderSpotifySearchResult(songs[0]) : "",
    spotifyResult2: songs[1] ? renderSpotifySearchResult(songs[1]) : "",
    spotifyResult3: songs[2] ? renderSpotifySearchResult(songs[2]) : "",
    spotifyResult4: songs[3] ? renderSpotifySearchResult(songs[3]) : "",
    spotifyResult5: songs[4] ? renderSpotifySearchResult(songs[4]) : "",
  };
}

async function spotifySearch(songName, artist, album) {
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

function renderSpotifySearchResult(song) {
  return song
    ? `${song.artist[0]} - ${song.name} (${song.album}) => ${song.url}`
    : "";
}
