/**
 * Paints the sakura petal used by the 3D field. The texture is a data map,
 * not final colour, so the shader can recolour it for day and night:
 *   R  base→tip gradient (0 at the stem, 1 at the notched tip)
 *   G  vein mask
 *   B  soft highlight along the petal's ridge
 *   A  silhouette with a feathered edge
 * Two petal variants sit side by side (a full petal and a slimmer one).
 */

const SIZE = 256;

function petalPath(ctx: CanvasRenderingContext2D, cx: number, w: number, h: number, top: number) {
  // Sakura petal: narrow stem at the bottom, broad shoulders, a notch at the tip.
  const base = top + h;
  const notch = top + h * 0.1;
  const lobeY = top + h * 0.015;
  ctx.beginPath();
  ctx.moveTo(cx, base);
  // right flank: stem → shoulder → right lobe
  ctx.bezierCurveTo(cx + w * 0.16, base - h * 0.06, cx + w * 0.5, base - h * 0.38, cx + w * 0.48, top + h * 0.3);
  ctx.bezierCurveTo(cx + w * 0.47, top + h * 0.14, cx + w * 0.34, lobeY, cx + w * 0.2, lobeY);
  // notch
  ctx.bezierCurveTo(cx + w * 0.11, lobeY, cx + w * 0.05, notch - h * 0.03, cx, notch);
  ctx.bezierCurveTo(cx - w * 0.05, notch - h * 0.03, cx - w * 0.11, lobeY, cx - w * 0.2, lobeY);
  // left lobe → shoulder → stem
  ctx.bezierCurveTo(cx - w * 0.34, lobeY, cx - w * 0.47, top + h * 0.14, cx - w * 0.48, top + h * 0.3);
  ctx.bezierCurveTo(cx - w * 0.5, base - h * 0.38, cx - w * 0.16, base - h * 0.06, cx, base);
  ctx.closePath();
}

function paintVariant(ctx: CanvasRenderingContext2D, ox: number, w: number, h: number, seed: number) {
  const cx = ox + SIZE / 2;
  const top = (SIZE - h) / 2;
  const base = top + h;

  ctx.save();
  // Feather the silhouette slightly so edges never alias.
  if ("filter" in ctx) ctx.filter = "blur(1.2px)";

  // Alpha + R gradient (base → tip). Drawn as red channel on black.
  petalPath(ctx, cx, w, h, top);
  const g = ctx.createLinearGradient(cx, base, cx, top);
  g.addColorStop(0, "rgb(0,0,0)");
  g.addColorStop(0.35, "rgb(120,0,0)");
  g.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // Ridge highlight (blue) and veins (green), clipped to the petal.
  ctx.save();
  petalPath(ctx, cx, w * 0.985, h * 0.985, top + h * 0.008);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";

  const ridge = ctx.createRadialGradient(cx - w * 0.08, top + h * 0.45, 2, cx - w * 0.08, top + h * 0.45, w * 0.46);
  ridge.addColorStop(0, "rgba(0,0,200,1)");
  ridge.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = ridge;
  ctx.fillRect(ox, 0, SIZE, SIZE);

  // Veins fan from the stem towards the lobes.
  if ("filter" in ctx) ctx.filter = "blur(0.6px)";
  ctx.lineCap = "round";
  const veins = 7;
  for (let i = 0; i < veins; i++) {
    const t = i / (veins - 1) - 0.5; // -0.5..0.5
    const jitter = Math.sin(seed * 13.1 + i * 2.3) * 0.03;
    const endX = cx + (t + jitter) * w * 0.82;
    const endY = top + h * (0.12 + Math.abs(t) * 0.32);
    const strength = 1 - Math.abs(t) * 1.1;
    ctx.strokeStyle = `rgba(0,${Math.round(90 + 110 * strength)},0,1)`;
    ctx.lineWidth = 1.1 + strength * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, base - h * 0.04);
    ctx.bezierCurveTo(cx + t * w * 0.12, base - h * 0.35, endX - t * w * 0.18, top + h * 0.42, endX, endY);
    ctx.stroke();
    // a short branch on the outer veins
    if (Math.abs(t) > 0.2) {
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(0,70,0,1)";
      ctx.beginPath();
      const bx = cx + t * w * 0.5;
      const by = top + h * 0.5;
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + t * w * 0.2, by - h * 0.12, bx + t * w * 0.34, by - h * 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function paintPetalAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * 2;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintVariant(ctx, 0, SIZE * 0.86, SIZE * 0.9, 1);
  paintVariant(ctx, SIZE, SIZE * 0.66, SIZE * 0.94, 2);
  return canvas;
}
