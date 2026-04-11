import { useEffect, useState } from "react";

export function PageViews({ serverUrl }: { serverUrl: string }) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    async function recordView() {
      try {
        const res = await fetch(`${serverUrl}/rpc/pageView`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        const count = data?.json?.views ?? data?.views;
        if (typeof count === "number") setViews(count);
      } catch {
        // Silently fail
      }
    }

    recordView();
  }, [serverUrl]);

  if (views === null || typeof views !== "number") return null;

  return (
    <span className="text-xs text-muted-foreground/40 tabular-nums">
      {views.toLocaleString()} visit{views !== 1 ? "s" : ""}
    </span>
  );
}
