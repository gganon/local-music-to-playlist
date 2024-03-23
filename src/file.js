import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import mm from "music-metadata";

export async function getTrackMetadata(file) {
  try {
    return await mm.parseFile(file);
  } catch (e) {
    console.error(`[SKIP] ${file}: ${e.message}`);
    return null;
  }
}

export function listFiles(dirs) {
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
