import { useEffect, useRef, useState } from "react";

interface GalleryImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  index: number;
  size?: "big" | "wide" | "tall";
}

/**
 * A masonry image that fades in independently:
 *   1. Waits for the image bytes to decode
 *   2. Waits for it to cross the viewport (IntersectionObserver)
 *   3. Applies a tiny index-based stagger so neighbours don't fire
 *      at exactly the same frame when the user scrolls in quickly
 */
export function GalleryImage({ src, alt, width, height, index, size }: GalleryImageProps) {
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
      className={`overflow-hidden rounded-lg bg-muted/30${size ? ` span-${size}` : ""}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${stagger}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${stagger}ms`,
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
      />
    </div>
  );
}
