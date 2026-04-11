#!/usr/bin/env bun
/**
 * One-time script to get a Spotify refresh token.
 *
 * Usage:
 *   1. In your Spotify app dashboard, add this redirect URI:
 *        http://127.0.0.1:3939/callback
 *   2. Run: bun run apps/server/scripts/get-spotify-token.ts
 *   3. Your browser will open — log in and approve
 *   4. The refresh token will print to the terminal
 *   5. Paste it into SPOTIFY_REFRESH_TOKEN in apps/server/.env
 */

import { serve } from "bun";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:3939/callback";
const SCOPES = ["user-read-currently-playing", "user-read-recently-played"].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in apps/server/.env");
  process.exit(1);
}

const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  response_type: "code",
  client_id: CLIENT_ID,
  scope: SCOPES,
  redirect_uri: REDIRECT_URI,
}).toString()}`;

console.log("\n🎵 Spotify token fetcher\n");
console.log("Starting local server at http://127.0.0.1:3939");
console.log("\nOpening browser to authorize...\n");
console.log("If the browser doesn't open automatically, visit this URL:");
console.log(`\n${authUrl}\n`);

// Open browser
const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
Bun.spawn([opener, authUrl]).exited;

const server = serve({
  port: 3939,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname !== "/callback") {
      return new Response("Not Found", { status: 404 });
    }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("❌ Authorization error:", error);
      setTimeout(() => process.exit(1), 500);
      return new Response(`<h1>Error: ${error}</h1>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code) {
      return new Response("<h1>No code received</h1>", {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.refresh_token) {
      console.log("\n✅ Success!\n");
      console.log("Your refresh token:\n");
      console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);
      console.log("Add this to apps/server/.env\n");

      setTimeout(() => process.exit(0), 500);

      return new Response(
        `<html>
          <head><title>Success</title><style>
            body { font-family: -apple-system, sans-serif; background: #faf8f5; color: #2a2520; padding: 60px 20px; text-align: center; }
            h1 { font-size: 28px; margin-bottom: 12px; }
            p { color: #7a7570; }
            code { background: #eee8e0; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-top: 12px; }
          </style></head>
          <body>
            <h1>✅ Spotify connected</h1>
            <p>You can close this tab — check your terminal for the refresh token.</p>
          </body>
        </html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    console.error("❌ Token exchange failed:", data);
    setTimeout(() => process.exit(1), 500);
    return new Response(`<h1>Error: ${data.error_description || "unknown"}</h1>`, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Listening on ${server.url}`);
