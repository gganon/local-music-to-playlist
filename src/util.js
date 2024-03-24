import dotenv from "dotenv";
import { read } from "read";

dotenv.config();

// remove stuff from track meta that could confuse spotify/youtube like the "feat." part in the song title or album name
// also lower cases and trims
export function normalizeName(name) {
  return name
    ?.replace(/[\(\[]f(ea)?t[^\)\]]*[\)\]]/, "")
    ?.replace(/[\(\[\)\]]/g, "")
    ?.toLowerCase()
    ?.trim();
}

export async function getVariable(
  inlineName,
  envName,
  displayName,
  multiple = false,
  secret = false,
  required = true
) {
  let values = [];

  if (process.argv.indexOf(inlineName) > -1) {
    process.argv.forEach((arg, idx) => {
      if (arg === inlineName) {
        values.push(process.argv[idx + 1]);
      }
    });
  } else if (process.env[envName]) {
    values = multiple
      ? process.env[envName].split(",")
      : [process.env[envName]];
  } else if (required) {
    const input = await read({ prompt: displayName + ": ", silent: secret });
    secret && console.log("\n"); // sometimes `read()` won't go to the next line when `silent` is true which may make the user feel like it didn't real the input when it actually did
    values = multiple ? input.split(",") : [input];
  }

  if (!multiple) {
    return values[0];
  }

  if (multiple) {
    return values;
  }

  return null;
}

export function queryParams(params) {
  return Object.keys(params)
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join("&");
}

export function compareTracks(track1, track2) {
  if (track1.artist > track2.artist) {
    return 1;
  }

  if (track1.artist < track2.artist) {
    return -1;
  }

  if (track1.album > track2.album) {
    return 1;
  }

  if (track1.album < track2.album) {
    return -1;
  }

  return 0;
}
