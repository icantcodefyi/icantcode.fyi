import type { RouterClient } from "@orpc/server";
import { db } from "@my-better-t-app/db";
import {
  pageViews,
  guestbookEntries,
  guestbookSignatures,
} from "@my-better-t-app/db/schema/portfolio";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

// ── Spotify types ──
interface SpotifyTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyImage {
  url: string;
}

interface SpotifyTrack {
  name: string;
  artists: SpotifyArtist[];
  album?: { images?: SpotifyImage[] };
  external_urls?: { spotify?: string };
}

interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  item?: SpotifyTrack;
}

interface SpotifyRecentlyPlayed {
  items?: Array<{ track: SpotifyTrack }>;
}

// ── Spotify cache ──
let spotifyAccessToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = (await response.json()) as SpotifyTokenResponse;
  if (data.access_token && typeof data.expires_in === "number") {
    spotifyAccessToken = data.access_token;
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return spotifyAccessToken;
  }

  return null;
}

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),

  nowPlaying: publicProcedure.handler(async () => {
    const token = await getSpotifyAccessToken();
    if (!token) {
      return { isPlaying: false as const };
    }

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.status === 204 || response.status > 400) {
      // Try recently played
      const recentRes = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=1",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!recentRes.ok) return { isPlaying: false as const };

      const recentData = (await recentRes.json()) as SpotifyRecentlyPlayed;
      const track = recentData.items?.[0]?.track;
      if (!track) return { isPlaying: false as const };

      return {
        isPlaying: false as const,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        albumArt:
          track.album?.images?.[2]?.url || track.album?.images?.[0]?.url,
        songUrl: track.external_urls?.spotify,
      };
    }

    const data = (await response.json()) as SpotifyCurrentlyPlaying;
    if (!data.item) return { isPlaying: false as const };

    return {
      isPlaying: data.is_playing,
      title: data.item.name,
      artist: data.item.artists.map((a) => a.name).join(", "),
      albumArt:
        data.item.album?.images?.[2]?.url || data.item.album?.images?.[0]?.url,
      songUrl: data.item.external_urls?.spotify,
    };
  }),

  pageView: publicProcedure.handler(async () => {
    const slug = "home";

    // Atomic upsert with increment
    const result = await db
      .insert(pageViews)
      .values({ slug, count: 1 })
      .onConflictDoUpdate({
        target: pageViews.slug,
        set: { count: sql`${pageViews.count} + 1` },
      })
      .returning({ count: pageViews.count });

    return { views: result[0]?.count ?? 0 };
  }),

  getPageViews: publicProcedure.handler(async () => {
    const result = await db
      .select({ count: pageViews.count })
      .from(pageViews)
      .where(eq(pageViews.slug, "home"))
      .limit(1);

    return { views: result[0]?.count ?? 0 };
  }),

  listGuestbook: publicProcedure.handler(async () => {
    const entries = await db
      .select({
        id: guestbookEntries.id,
        name: guestbookEntries.name,
        message: guestbookEntries.message,
        createdAt: guestbookEntries.createdAt,
      })
      .from(guestbookEntries)
      .orderBy(desc(guestbookEntries.createdAt))
      .limit(50);
    return entries;
  }),

  signGuestbook: protectedProcedure
    .input(
      z.object({
        message: z
          .string()
          .min(1, "Message cannot be empty")
          .max(280, "Message too long (max 280 chars)"),
      })
    )
    .handler(async ({ context, input }) => {
      const user = context.session.user;
      const entry = await db
        .insert(guestbookEntries)
        .values({
          name: user.name || "Anonymous",
          email: user.email,
          message: input.message.trim(),
        })
        .returning();
      return entry[0];
    }),

  /* ── Weather in Bengaluru ──────────────────────────────────────────
   *
   * Open-Meteo public API. Returns current temperature and WMO
   * weather code so the client can tint the palette.
   * ────────────────────────────────────────────────────────────────── */
  weather: publicProcedure.handler(async () => {
    const cached = weatherCache;
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value;
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=temperature_2m,weather_code,is_day";
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        current?: {
          temperature_2m?: number;
          weather_code?: number;
          is_day?: number;
        };
      };
      const value = {
        temperatureC: data.current?.temperature_2m ?? null,
        weatherCode: data.current?.weather_code ?? null,
        isDay: data.current?.is_day === 1,
      };
      weatherCache = { value, at: Date.now() };
      return value;
    } catch {
      return {
        temperatureC: null as number | null,
        weatherCode: null as number | null,
        isDay: null as boolean | null,
      };
    }
  }),

  /* ── Handwriting guestbook ────────────────────────────────────────
   *
   * Auth-gated via Google OAuth. One signature per user is enforced
   * by a unique constraint on `guestbook_signatures.user_id`, so the
   * "no spam" guarantee lives at the DB layer — not in app code.
   * ─────────────────────────────────────────────────────────────── */

  /**
   * Returns everything the guestbook UI needs in a single round trip:
   *
   *  • totalCount       — honest count of rows, not a loaded subset
   *  • userHasSigned    — whether the viewer has already signed (null if anon)
   *  • userSignature    — the viewer's own signature (null if not signed / anon)
   *  • recent           — most recent signatures, ordered newest first
   *
   * Everything is public except the two `user-*` fields, which require
   * a session to compute. Anonymous viewers still see the wall.
   */
  getGuestbookState: publicProcedure.handler(async ({ context }) => {
    const userId = context.session?.user?.id ?? null;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guestbookSignatures);

    const recent = await db
      .select({
        id: guestbookSignatures.id,
        svgPath: guestbookSignatures.svgPath,
        width: guestbookSignatures.width,
        height: guestbookSignatures.height,
        createdAt: guestbookSignatures.createdAt,
      })
      .from(guestbookSignatures)
      .orderBy(desc(guestbookSignatures.createdAt))
      .limit(40);

    let userSignature: (typeof recent)[number] | null = null;
    if (userId) {
      const [own] = await db
        .select({
          id: guestbookSignatures.id,
          svgPath: guestbookSignatures.svgPath,
          width: guestbookSignatures.width,
          height: guestbookSignatures.height,
          createdAt: guestbookSignatures.createdAt,
        })
        .from(guestbookSignatures)
        .where(eq(guestbookSignatures.userId, userId))
        .limit(1);
      userSignature = own ?? null;
    }

    return {
      totalCount: countRow?.count ?? 0,
      userHasSigned: userId ? userSignature !== null : null,
      userSignature,
      recent,
    };
  }),

  signGuestbookHandwriting: protectedProcedure
    .input(
      z.object({
        svgPath: z
          .string()
          .min(20, "Signature too short")
          .max(48_000, "Signature too long"),
        width: z.number().int().positive().max(2000),
        height: z.number().int().positive().max(800),
      })
    )
    .handler(async ({ context, input }) => {
      // Minimal shape check — allow plain M/L paths (legacy) and
      // perfect-freehand filled polygon paths (M/L/Q/Z).
      if (!/^[MLQZ\d\s.,\-]+$/.test(input.svgPath)) {
        throw new Error("Invalid signature path");
      }

      const userId = context.session.user.id;

      try {
        const entry = await db
          .insert(guestbookSignatures)
          .values({
            userId,
            svgPath: input.svgPath,
            width: input.width,
            height: input.height,
          })
          .returning();
        return entry[0];
      } catch (err) {
        // Postgres unique-violation for the user_id uniqueness on the
        // signatures table. Any driver surfaces this as code 23505.
        const code = (err as { code?: string })?.code;
        if (code === "23505") {
          throw new Error("You've already signed the guestbook");
        }
        throw err;
      }
    }),
};

// ── Simple server-side caches ──
let weatherCache: { value: { temperatureC: number | null; weatherCode: number | null; isDay: boolean | null }; at: number } | null = null;

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
