import { useEffect, useRef, useState } from "react";

const TAPE = ["var(--pastel-butter)", "var(--pastel-blush)", "var(--pastel-sky)", "var(--pastel-sage)", "var(--pastel-lavender)"];

interface GalleryImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  index: number;
  size?: "big" | "wide" | "tall";
  caption?: string;
}

/**
 * A masonry image that fades in independently:
 *   1. Waits for the image bytes to decode
 *   2. Waits for it to cross the viewport (IntersectionObserver)
 *   3. Applies a tiny index-based stagger so neighbours don't fire
 *      at exactly the same frame when the user scrolls in quickly
 */
export function GalleryImage({ src, alt, width, height, index, size, caption }: GalleryImageProps) {
  const [flipped, setFlipped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cached images may already be complete by the time the <img> mounts —
  // onLoad won't fire for those, so seed the loaded state from `complete`.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const visible = inView && loaded;
  // Gentle cascade that resets every 5 items so the last image never
  // waits 600 ms. With 5 items per wave x 60 ms, the max stagger is 240 ms.
  const stagger = (index % 5) * 60;

  return (
    <div
      ref={ref}
      className={`group relative cursor-pointer [perspective:900px]${size ? ` span-${size}` : ""}`}
      onClick={() => setFlipped((f) => !f)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${stagger}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${stagger}ms`,
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      <div className={`polaroid-inner h-full w-full ${flipped ? "is-flipped" : ""}`}>
        <div className="polaroid-face overflow-hidden rounded-lg bg-muted/30">
          <span
            aria-hidden="true"
            className="tape"
            style={{ background: TAPE[index % TAPE.length], rotate: `${index % 2 ? 4 : -5}deg` }}
          />
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] group-hover:rotate-[0.6deg]"
          />
        </div>
        <div className="polaroid-face polaroid-back flex flex-col items-center justify-center rounded-lg border border-border p-4 text-center">
          <p className="font-hand text-2xl leading-tight text-foreground/85">{caption ?? "a good day"}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">#{String(index + 1).padStart(2, "0")} · tap to flip</p>
        </div>
      </div>
    </div>
  );
}
