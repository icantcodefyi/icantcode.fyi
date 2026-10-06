import { useEffect, useState } from "react";

interface NowPlayingData {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  albumArt?: string;
  songUrl?: string;
}

const SpotifyIcon = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="shrink-0 text-muted-foreground/40"
    aria-hidden="true"
  >
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const Equalizer = (
  <span
    className="inline-flex items-end gap-[2px] h-[12px]"
    aria-label="Now playing"
  >
    <span className="inline-block w-[2px] rounded-full bg-pastel-sage animate-[equalizer_0.9s_ease-in-out_infinite]" />
    <span className="inline-block w-[2px] rounded-full bg-pastel-sage animate-[equalizer_0.9s_ease-in-out_0.2s_infinite]" />
    <span className="inline-block w-[2px] rounded-full bg-pastel-sage animate-[equalizer_0.9s_ease-in-out_0.4s_infinite]" />
  </span>
);

export function SpotifyNowPlaying({ serverUrl }: { serverUrl: string }) {
  const [data, setData] = useState<NowPlayingData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNowPlaying() {
      try {
        const res = await fetch(`${serverUrl}/rpc/nowPlaying`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const body = await res.json();
        if (cancelled) return;
        // oRPC wraps responses as { json: ... }
        const payload = body?.json ?? body;
        setData(payload);
      } catch {
        // Silently fail
      }
    }

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serverUrl]);

  if (!data?.title) return null;

  const Wrapper = data.songUrl ? "a" : "div";
  const wrapperProps = data.songUrl
    ? {
        href: data.songUrl,
        target: "_blank" as const,
        rel: "noopener noreferrer",
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="group inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {data.isPlaying ? Equalizer : SpotifyIcon}
      {data.albumArt ? (
        <img
          src={data.albumArt}
          alt=""
          width={18}
          height={18}
          className="shrink-0 rounded-[3px]"
        />
      ) : null}
      <span className="min-w-0 truncate">
        <span className="text-muted-foreground/60">
          {data.isPlaying ? "listening to " : "last played "}
        </span>
        <span className="text-foreground/80 group-hover:text-foreground">
          {data.title}
        </span>
        {data.artist ? (
          <span className="text-muted-foreground/60"> by {data.artist}</span>
        ) : null}
      </span>
    </Wrapper>
  );
}
