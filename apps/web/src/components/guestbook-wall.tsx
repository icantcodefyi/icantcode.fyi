import { getStroke } from "perfect-freehand";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

/**
 * GuestbookWall — sign your name with a cursor, exactly once per Google
 * account. The uniqueness guarantee lives in the DB (unique constraint
 * on `guestbook_signatures.user_id`), not in app code.
 *
 * Four visual states:
 *
 *  1. loading   — session + state in-flight. Quiet placeholder.
 *  2. anon      — no session. Empty canvas + "continue with google" chip.
 *  3. ready     — signed in, hasn't signed yet. Canvas live, sign button.
 *  4. signed    — signed in, already signed. Shows their signature back.
 *
 * Below the canvas: an editorial list of recent signatures (hairline
 * dividers, index + inline SVG + relative time — no card grid). The
 * list is bounded by a fixed max-height with a soft top/bottom fade
 * mask, so the section never grows past ~400px no matter how many
 * guests sign.
 */

type GuestbookState = Awaited<ReturnType<typeof client.getGuestbookState>>;
type SavedSignature = GuestbookState["recent"][number];

type StrokePoint = [number, number, number]; // x, y, pressure
type Stroke = StrokePoint[];

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 140;

/**
 * perfect-freehand options tuned for cursor-drawn signatures in a
 * 480×140 viewBox. See previous commit for per-option rationale; the
 * single biggest visual win is `streamline`, which kills trackpad jitter.
 */
const STROKE_OPTIONS = {
  size: 4.5,
  thinning: 0.6,
  smoothing: 0.55,
  streamline: 0.55,
  simulatePressure: true,
  last: true,
} as const;

function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return "";
  const d: string[] = ["M", points[0][0].toFixed(2), points[0][1].toFixed(2), "Q"];
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    d.push(
      x0.toFixed(2),
      y0.toFixed(2),
      ((x0 + x1) / 2).toFixed(2),
      ((y0 + y1) / 2).toFixed(2)
    );
  }
  d.push("Z");
  return d.join(" ");
}

function strokesToPath(strokes: Stroke[]): string {
  const parts: string[] = [];
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const outline = getStroke(stroke, STROKE_OPTIONS);
    const path = getSvgPathFromStroke(outline);
    if (path) parts.push(path);
  }
  return parts.join(" ");
}

// A filled polygon path (our current format) contains Q and Z. Legacy
// line paths only contain M and L.
function isFilledPath(svgPath: string): boolean {
  return /[QZ]/.test(svgPath);
}

/** Human-readable relative time. Short forms to fit the mono label style. */
function formatRelative(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 45_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/**
 * Official multicolor Google "G" mark. Used on the sign-in chip because
 * the pastel chip aesthetic on its own doesn't communicate "Google" —
 * the real mark does the recognition work in ~14px.
 */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * The baseline + text prompt shown inside the canvas when the user
 * isn't drawing (loading / anon / signed-and-thanks states). Matches
 * the original "sign here…" affordance visually — dotted baseline
 * with a centered italic line above it.
 */
function CanvasBaseline({
  message,
  subMessage,
}: {
  message: string;
  subMessage?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      className="block h-[140px] w-full rounded-lg bg-[oklch(0.99_0.005_60)]"
      aria-hidden="true"
    >
      <line
        x1="20"
        y1={CANVAS_HEIGHT - 30}
        x2={CANVAS_WIDTH - 20}
        y2={CANVAS_HEIGHT - 30}
        stroke="oklch(0.85 0.04 60)"
        strokeDasharray="2 4"
        strokeWidth="1"
      />
      <text
        x={CANVAS_WIDTH / 2}
        y={CANVAS_HEIGHT / 2 - (subMessage ? 6 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="oklch(0.55 0.02 60 / 0.55)"
        style={{ fontFamily: "var(--font-display)", fontSize: 18, fontStyle: "italic" }}
      >
        {message}
      </text>
      {subMessage ? (
        <text
          x={CANVAS_WIDTH / 2}
          y={CANVAS_HEIGHT / 2 + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="oklch(0.58 0.015 60 / 0.55)"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {subMessage}
        </text>
      ) : null}
    </svg>
  );
}

/**
 * Renders an already-saved signature full-width on the same dotted
 * baseline as the drawing canvas, so state 4 (signed) visually
 * echoes states 1–3 without a layout jump.
 */
function CanvasReplay({ signature }: { signature: SavedSignature }) {
  const filled = isFilledPath(signature.svgPath);
  return (
    <svg
      viewBox={`0 0 ${signature.width} ${signature.height}`}
      className="block h-[140px] w-full rounded-lg bg-[oklch(0.99_0.005_60)]"
      role="img"
      aria-label="Your signature"
    >
      <line
        x1="20"
        y1={signature.height - 30}
        x2={signature.width - 20}
        y2={signature.height - 30}
        stroke="oklch(0.85 0.04 60)"
        strokeDasharray="2 4"
        strokeWidth="1"
      />
      {filled ? (
        <path d={signature.svgPath} fill="oklch(0.22 0.02 60)" stroke="none" />
      ) : (
        <path
          d={signature.svgPath}
          fill="none"
          stroke="oklch(0.22 0.02 60)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function GuestbookWall() {
  /* ── session + guestbook state ──────────────────────────────── */

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [state, setState] = useState<GuestbookState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);

  const loadState = useCallback(async () => {
    try {
      const data = await client.getGuestbookState();
      setState(data);
    } catch {
      // swallow — the UI has a sensible "still loading" fallback
    } finally {
      setStateLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState, session?.user?.id]);

  /* ── drawing state ─────────────────────────────────────────── */

  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getPoint(e: React.PointerEvent<SVGSVGElement>): StrokePoint {
    const svg = svgRef.current;
    if (!svg) return [0, 0, 0.5];
    const rect = svg.getBoundingClientRect();
    const sx = CANVAS_WIDTH / rect.width;
    const sy = CANVAS_HEIGHT / rect.height;
    return [
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy,
      e.pressure || 0.5,
    ];
  }

  function onDown(e: React.PointerEvent<SVGSVGElement>) {
    drawingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    setStrokes((prev) => [...prev, [getPoint(e)]]);
    setError(null);
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current) return;
    const p = getPoint(e);
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      copy[copy.length - 1] = [...copy[copy.length - 1], p];
      return copy;
    });
  }

  function onUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    setStrokes([]);
    setError(null);
  }

  const livePath = useMemo(() => strokesToPath(strokes), [strokes]);
  const hasInk = strokes.some((s) => s.length > 1);

  /* ── actions ───────────────────────────────────────────────── */

  async function handleSign() {
    if (!hasInk || livePath.length < 20) {
      setError("Draw a longer signature");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await client.signGuestbookHandwriting({
        svgPath: livePath,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      });
      setStrokes([]);
      await loadState();
    } catch (e) {
      const msg = (e as Error)?.message || "Could not save. Please try again";
      setError(msg);
      // Re-fetch in case the failure was "already signed" — we want
      // the UI to flip to the signed state instead of staying on the
      // canvas with a stale error.
      await loadState();
    } finally {
      setSaving(false);
    }
  }

  function handleSignIn() {
    const callbackURL =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}#guestbook`
        : "/#guestbook";
    void authClient.signIn.social({ provider: "google", callbackURL });
  }

  async function handleSignOut() {
    await authClient.signOut();
    setStrokes([]);
    setError(null);
    // Session hook will flip; we still want to refetch public state.
    await loadState();
  }

  /* ── status derivation ─────────────────────────────────────── */

  const isLoading = sessionPending || stateLoading;
  const isAnon = !sessionPending && !session;
  const isSigned = !!session && state?.userHasSigned === true;

  const totalCount = state?.totalCount ?? 0;
  const recent = state?.recent ?? [];
  const firstName = session?.user?.name?.split(" ")[0];

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <section id="guestbook">
      {/* Header — honest count, matches the Projects "{n} shipped" pattern */}
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium text-foreground tracking-tight">
          Guestbook
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 tabular-nums">
          {stateLoading
            ? "—   signed"
            : `${totalCount.toString().padStart(3, "0")} signed`}
        </span>
      </div>

      <p className="mb-3 text-sm text-muted-foreground/80">
        Draw a line, a name, a doodle. It'll live here forever — one per
        guest.
      </p>

      {/* ── Canvas card ───────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-3">
        {isLoading ? (
          <CanvasBaseline message="…" />
        ) : isSigned && state?.userSignature ? (
          <CanvasReplay signature={state.userSignature} />
        ) : isAnon ? (
          <CanvasBaseline
            message="leave your mark here"
            subMessage="guests only"
          />
        ) : (
          // isReady — drawable canvas
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="signature-canvas block h-[140px] w-full cursor-crosshair rounded-lg bg-[oklch(0.99_0.005_60)]"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <line
              x1="20"
              y1={CANVAS_HEIGHT - 30}
              x2={CANVAS_WIDTH - 20}
              y2={CANVAS_HEIGHT - 30}
              stroke="oklch(0.85 0.04 60)"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            {livePath ? (
              <path d={livePath} fill="oklch(0.22 0.02 60)" stroke="none" />
            ) : (
              <text
                x={CANVAS_WIDTH / 2}
                y={CANVAS_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="oklch(0.55 0.02 60 / 0.55)"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontStyle: "italic",
                }}
              >
                sign here…
              </text>
            )}
          </svg>
        )}

        {/* ── Action row — varies per state ──────────────────── */}
        <div className="mt-3 flex min-h-[34px] items-center justify-between gap-3">
          {isLoading ? (
            <span className="text-[11px] text-muted-foreground/50">
              loading…
            </span>
          ) : isAnon ? (
            <>
              <span className="text-[11px] text-muted-foreground/70">
                sign in to add your signature
              </span>
              <button
                type="button"
                onClick={handleSignIn}
                className="group inline-flex -rotate-[0.5deg] items-center gap-2 rounded-[10px] bg-pastel-butter/60 px-3.5 py-2 shadow-[0_1px_0_oklch(0.85_0.01_60),0_8px_16px_-12px_oklch(0.2_0.02_60/0.25)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_1px_0_oklch(0.82_0.01_60),0_14px_22px_-14px_oklch(0.2_0.02_60/0.3)]"
              >
                <GoogleG className="h-[13px] w-[13px]" />
                <span className="font-display text-[14px] font-medium italic leading-none text-foreground/90">
                  continue with google
                </span>
                <span
                  aria-hidden="true"
                  className="ml-0.5 text-[11px] text-foreground/35 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground/75"
                >
                  ↗
                </span>
              </button>
            </>
          ) : isSigned && state?.userSignature ? (
            <>
              <span className="text-[11px] text-muted-foreground/70">
                thanks{firstName ? `, ${firstName}` : ""} — signed{" "}
                <span className="text-foreground/70">
                  {formatRelative(state.userSignature.createdAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="text-[11px] text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                sign out
              </button>
            </>
          ) : (
            // isReady
            <>
              <span className="text-[11px] text-muted-foreground/70">
                {error
                  ? error
                  : firstName
                    ? `signing as ${firstName}`
                    : "signing in…"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearCanvas}
                  disabled={!hasInk || saving}
                  className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  clear
                </button>
                <button
                  type="button"
                  onClick={() => void handleSign()}
                  disabled={!hasInk || saving}
                  className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? "signing…" : "sign"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="text-[11px] text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Recent signatures — editorial list, bounded height ──
          Not a card grid (anti-reference). One row per signature,
          hairline dividers, index + inline SVG + relative time.
          The scroll container is masked with a top/bottom fade so
          the section never grows past ~400px and older signatures
          visibly "extend beyond the frame." */}
      {recent.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
              Recent signatures
            </h3>
            {totalCount > recent.length ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 tabular-nums">
                showing {recent.length} of {totalCount}
              </span>
            ) : null}
          </div>

          <div
            className="-mx-3 overflow-y-auto px-3"
            style={{
              maxHeight: 360,
              maskImage:
                "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 28px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 28px), transparent 100%)",
            }}
          >
            <ol className="list-none divide-y divide-border/60">
              {recent.map((s, i) => {
                const filled = isFilledPath(s.svgPath);
                // Row index counts down from total, so the newest
                // signature is #(totalCount) and older rows decrement.
                const indexLabel = (totalCount - i)
                  .toString()
                  .padStart(3, "0");
                return (
                  <li
                    key={s.id}
                    className="first:border-t first:border-border/60"
                  >
                    <div className="-mx-3 flex items-center gap-5 rounded-lg px-3 py-3 transition-colors duration-300 hover:bg-pastel-lavender/25">
                      <span
                        aria-hidden="true"
                        className="w-7 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60"
                      >
                        {indexLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <svg
                          viewBox={`0 0 ${s.width} ${s.height}`}
                          className="block h-[44px] w-full max-w-[340px]"
                          preserveAspectRatio="xMinYMid meet"
                          aria-hidden="true"
                        >
                          {filled ? (
                            <path
                              d={s.svgPath}
                              fill="oklch(0.3 0.02 60)"
                              stroke="none"
                            />
                          ) : (
                            <path
                              d={s.svgPath}
                              fill="none"
                              stroke="oklch(0.3 0.02 60)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-muted-foreground/60">
                        {formatRelative(s.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
