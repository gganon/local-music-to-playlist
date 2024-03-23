import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import * as mm from "music-metadata";
import { stderr } from "node:process";
import dotenv from "dotenv";
import { read } from "read";
import * as spotify from "./spotify.js";
import { stringify as csvStringify } from "csv-stringify/sync";
import { parse as csvParse } from "csv-parse/sync";

dotenv.config();

const paths = getArg("--path", true);
const outFilePath = getArg("--out");
const spotifyClientId =
  process.env.SPOTIFY_CLIENT_ID ||
  (await read({ prompt: "Spotify Client ID: " }));
const spotifyClientSecret =
  process.env.SPOTIFY_CLIENT_SECRET ||
  (await read({ prompt: "Spotify Client Secret: ", silent: true }));

if (paths.length < 1) {
  console.error("At least one --path argument is requried");
}

if (!outFilePath) {
  console.error(
    "--out parameter is required! Must be a path to a .csv file (if it doesn't exit, it will be created)"
  );
  process.exit(1);
}

if (!outFilePath.endsWith(".csv")) {
  console.error("--out path must end with .csv");
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

  const meta = {
    filename: basename(file),
    title: data.common.title,
    artist: data.common.artist,
    album: data.common.album,
    ...(await findSpotifySong(
      data.common.title,
      data.common.artist,
      data.common.album
    )),
  };

  console.log(
    `${meta.filename}: ${meta.artist} - ${meta.title}, ${
      meta.spotifySong || "(no matching Spotify track found)"
    }`
  );

  tracks.push(meta);
}

writeFileSync(outFilePath, csvStringify(tracks, { header: true }));

async function findSpotifySong(title, artist, album) {
  const songs = await Promise.all([
    spotify.findSong(
      normalizeName(title),
      normalizeName(artist),
      normalizeName(album)
    ),
    spotify.findSong(normalizeName(title), normalizeName(artist)),
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

function normalizeName(name) {
  return name
    ?.replace(/[\(\[]f(ea)?t[^\)\]]*[\)\]]/, "")
    ?.replace(/[\(\[\)\]]/g, "")
    ?.toLowerCase()
    ?.trim();
}

function renderSpotifySearchResult(song) {
  return song
    ? `${song.artist[0]} - ${song.name} (${song.album}) => ${song.url}`
    : "";
}

async function getTrackMetadata(file) {
  try {
    return await mm.parseFile(file);
  } catch (e) {
    stderr.write(`[SKIP] ${file}: ${e.message}\n`);
    return null;
  }
}

function listFiles(dirs) {
  const items = dirs.flatMap((dir) => ls(dir));
  const files = [];

  for (const file of items) {
    if (statSync(file).isDirectory()) {
      ls(file).forEach((file) => items.push(file));
      continue;
    }

    files.push(file);
  }

  return files;
}

function ls(dir) {
  return readdirSync(dir).map((file) => resolve(dir, file));
}

function getArg(name, multiple = false) {
  const values = [];

  process.argv.forEach((arg, idx) => {
    if (arg === name) {
      values.push(process.argv[idx + 1]);
    }
  });

  if (!multiple) {
    return values[0];
  }

  if (multiple) {
    return values;
  }

  return null;
}
