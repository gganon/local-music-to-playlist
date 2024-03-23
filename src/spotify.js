import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { normalizeName, queryParams } from "./util.js";
import { createServer } from "node:http";

let sdk = SpotifyApi.withClientCredentials("", "");

export function initSdk(clientId, secret) {
  sdk = SpotifyApi.withClientCredentials(clientId, secret);
}

export async function userLogin(
  clientId,
  clientSecret,
  port = 8080,
  host = "localhost"
) {
  const base = `http://${host}:${port}`;
  const redirectUri = base + "/redirect";

  // create temporary server for OAuth redirection
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, base);

      if (url.pathname == "/login") {
        const url =
          "https://accounts.spotify.com/authorize?" +
          queryParams({
            response_type: "code",
            client_id: clientId,
            scope: "playlist-modify-public playlist-modify-private",
            redirect_uri: redirectUri,
          });

        res.writeHead(302, "Redirecting", {
          location: url,
        });

        res.end("Redirecting you to Spotify for authentication...");

        return;
      }

      if (!url.pathname.endsWith("/redirect")) {
        res.statusCode = 404;
        throw new Error("Not Found");
      }

      if (url.searchParams.has("error")) {
        res.statusCode = 502;
        throw new Error(
          "Failed to recieve an auth code. Spotify returned the following error: " +
            url.searchParams.get("error")
        );
      }

      const code = url.searchParams.get("code");

      if (!url.searchParams.get("code")) {
        res.statusCode = 502;
        throw new Error('Error: Expected to get a "code" from Spotify');
      }

      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        body: queryParams({
          code: code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            new Buffer.from(clientId + ":" + clientSecret).toString("base64"),
        },
      }).then((resp) => resp.json());

      sdk = SpotifyApi.withAccessToken(clientId, response);

      res.end(
        `You've been authenticated. You may close this window and return to the running script.`
      );
    } catch (e) {
      res.end(e.message);
    }

    server.close();
  });

  server.listen(port, host);

  console.log(
    `\n\nOpen this URL in a browser to authenticate with Spotify:\n\n\t${base}/login`
  );

  await Promise.race([
    new Promise((resolve) => server.once("close", resolve)),
    new Promise((_, reject) => server.once("error", reject)),
  ]);
}

export async function getUsername() {
  return (await sdk.currentUser.profile()).display_name;
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

export async function getPaylistName(playlistId) {
  return (await sdk.playlists.getPlaylist(playlistId)).name;
}

export async function addToPlaylist(playlistId, trackUrls, replace = false) {
  const uris = trackUrls.map(trackUrlToUri);

  return replace
    ? sdk.playlists.updatePlaylistItems(playlistId, { uris })
    : sdk.playlists.addItemsToPlaylist(playlistId, uris);
}

function renderSpotifySearchResult(song) {
  return song
    ? `${song.artist[0]} - ${song.name} (${song.album}) => ${song.url}`
    : "";
}

function trackUrlToUri(trackUrl) {
  const url = new URL(trackUrl);
  const id = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  return `spotify:track:${id}`;
}
