import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import dotenv from "dotenv";
import * as spotify from "./spotify.js";
import { stringify as csvStringify } from "csv-stringify/sync";
import { parse as csvParse } from "csv-parse/sync";
import { getTrackMetadata, listFiles } from "./file.js";
import { getVariable } from "./util.js";

dotenv.config();

const paths = await getVariable("--path", "PATH", "Library Path(s)", true);
const outFilePath = await getVariable(
  "--csv-out",
  "CSV_OUT",
  "Output CSV Path"
);
const spotifyClientId = await getVariable(
  "--spotify-client-id",
  "SPOTIFY_CLIENT_ID",
  "Spotify Client ID:"
);
const spotifyClientSecret = await getVariable(
  "--spotify-client-secret",
  "SPOTIFY_CLIENT_SECRET",
  "Spotify Client Secret:",
  false,
  true
);

if (paths.length < 1) {
  console.error("At least one library path is required");
  process.exit(1);
}

if (!outFilePath) {
  console.error(
    "CSV out path must be a path to a .csv file (if it doesn't exit, it will be created)"
  );
  process.exit(1);
}

if (!outFilePath.endsWith(".csv")) {
  console.error("CSV out path must end with .csv");
  process.exit(1);
}

spotify.initSdk(spotifyClientId, spotifyClientSecret);

const tracks = [];
const existingTracks = {
  get(title, artist, album) {
    return this[`${title || ""},${artist || ""},${album || ""}`];
  },
  set(title, artist, album, track) {
    this[`${title || ""},${artist || ""},${album || ""}`] = track;
  },
};

try {
  const outfile = csvParse(readFileSync(outFilePath), { columns: true });
  outfile.forEach((track) => {
    existingTracks.set(track.title, track.artist, track.album, track);
  });
} catch (e) {
  // ignore
}

const files = listFiles(paths).sort();

for (const file of files) {
  const data = await getTrackMetadata(file);

  if (!data) {
    continue;
  }

  const title = data.common.title;
  const artist = data.common.artist;
  const album = data.common.album;

  if (existingTracks.get(title, artist, album)) {
    console.log(`[SKIP] ${file}: Already exists in ${outFilePath}`);
    tracks.push(existingTracks.get(title, artist, album));
    continue;
  }

  const track = {
    filename: basename(file),
    title: data.common.title,
    artist: data.common.artist,
    album: data.common.album,
    ...(await spotify.findSong(
      data.common.title,
      data.common.artist,
      data.common.album
    )),
  };

  console.log(
    `${track.filename}: ${track.artist} - ${track.title}, ${
      track.spotifySong || "(no matching Spotify track found)"
    }`
  );

  tracks.push(track);
}

writeFileSync(outFilePath, csvStringify(tracks, { header: true }));
