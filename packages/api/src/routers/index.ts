import type { RouterClient } from "@orpc/server";
import { db } from "@my-better-t-app/db";
import { pageViews, guestbookEntries } from "@my-better-t-app/db/schema/portfolio";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

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

  const data = await response.json();
  if (data.access_token) {
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

  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
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

      const recentData = await recentRes.json();
      const track = recentData.items?.[0]?.track;
      if (!track) return { isPlaying: false as const };

      return {
        isPlaying: false as const,
        title: track.name as string,
        artist: (track.artists as Array<{ name: string }>)
          .map((a) => a.name)
          .join(", "),
        albumArt: (track.album?.images?.[2]?.url ||
          track.album?.images?.[0]?.url) as string | undefined,
        songUrl: track.external_urls?.spotify as string | undefined,
      };
    }

    const data = await response.json();
    if (!data.item) return { isPlaying: false as const };

    return {
      isPlaying: data.is_playing as boolean,
      title: data.item.name as string,
      artist: (data.item.artists as Array<{ name: string }>)
        .map((a) => a.name)
        .join(", "),
      albumArt: (data.item.album?.images?.[2]?.url ||
        data.item.album?.images?.[0]?.url) as string | undefined,
      songUrl: data.item.external_urls?.spotify as string | undefined,
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
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
