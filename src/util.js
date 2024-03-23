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
  secret = false
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
  } else {
    const input = await read({ prompt: displayName + ": ", silent: secret });
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
