import { useEffect, useState } from "react";

export function PageViews({ serverUrl }: { serverUrl: string }) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function recordView() {
      try {
        const res = await fetch(`${serverUrl}/rpc/pageView`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) return;
        const data = await res.json();
        // oRPC wraps responses as { json: ... }
        const count = data?.json?.views ?? data?.views;
        if (!cancelled && typeof count === "number" && Number.isFinite(count)) {
          setViews(count);
        }
      } catch {
        // Silently fail
      }
    }

    recordView();
    return () => {
      cancelled = true;
    };
  }, [serverUrl]);

  // `views == null` catches both null *and* undefined (double-equal to null)
  if (views == null || !Number.isFinite(views)) return null;

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {views.toLocaleString()} visit{views !== 1 ? "s" : ""}
    </span>
  );
}
