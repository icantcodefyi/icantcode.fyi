/**
 * Where an object-fit image lands inside its box (from hero/stage.ts fit()).
 * Use it to pin something to a point in a painting, e.g. a halo on the
 * painted moon: plate px → box px is `r.x + px * r.w / naturalW`.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pure math: a `w`×`h` image in a `bw`×`bh` box, object-position `px`/`py` as 0..1. */
export function fitRect(bw: number, bh: number, w: number, h: number, mode: "cover" | "contain" = "cover", px = 0.5, py = 0.5): Rect {
  const s = mode === "contain" ? Math.min(bw / w, bh / h) : Math.max(bw / w, bh / h);
  const iw = w * s;
  const ih = h * s;
  return { x: (bw - iw) * px, y: (bh - ih) * py, w: iw, h: ih };
}

/**
 * The same, read from an <img>'s computed object-fit / object-position, in
 * the img's own box. Reads layout: call it on resize, never per frame.
 */
export function fitImage(img: HTMLImageElement, w = img.naturalWidth, h = img.naturalHeight): Rect {
  const cs = getComputedStyle(img);
  const [px, py] = cs.objectPosition.split(" ").map((v) => parseFloat(v) / 100);
  return fitRect(img.clientWidth, img.clientHeight, w, h, cs.objectFit === "contain" ? "contain" : "cover", px, py);
}
