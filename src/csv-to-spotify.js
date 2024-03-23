import { compareTracks, getVariable } from "./util.js";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import * as spotify from "./spotify.js";

const csvPath = await getVariable("--csv", "LIBRARY_CSV", "Library CSV Path");
const spotifyClientId = await getVariable(
  "--spotify-client-id",
  "SPOTIFY_CLIENT_ID",
  "Spotify Client ID"
);
const spotifyClientSecret = await getVariable(
  "--spotify-client-secret",
  "SPOTIFY_CLIENT_SECRET",
  "Spotify Client Secret",
  false,
  true
);
const playlistId = await getVariable(
  "--playlist-id",
  "PLAYLIST_ID",
  "Playlist ID (all items in playlist will be replaced!)"
);

if (!playlistId) {
  console.error("Playlist ID must be provided");
  process.exit(1);
}

await spotify.userLogin(spotifyClientId, spotifyClientSecret);

console.log("Logged in as " + (await spotify.getUsername()));

const tracks = parse(readFileSync(csvPath).toString("utf8"), { columns: true });

const spotifyUrls = tracks
  .sort(compareTracks)
  .reduce(
    (uris, track) =>
      track.spotifySong.startsWith("https://open.spotify.com/track/")
        ? uris.concat(track.spotifySong)
        : uris,
    []
  );

console.log(
  `Found ${spotifyUrls.length} songs from CSV file to add to playlist`
);

const playlistName = await spotify.getPaylistName(playlistId);

for (let offset = 0; offset < spotifyUrls.length; offset += 100) {
  const items = spotifyUrls.slice(offset, offset + 100);
  const shouldReplace = offset === 0;

  console.log(
    `Adding next ${items.length} songs to playlist "${playlistName}"...`
  );

  await spotify.addToPlaylist(playlistId, items, shouldReplace);
}

console.log("Playlist updated");
