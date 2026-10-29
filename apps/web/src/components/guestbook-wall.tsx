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
 * It fills the finale's guestbook band (sections/finale.tsx, a subgrid):
 * the tally (the count and the three latest marks) joins the copy column,
 * the panel (the canvas, then every earlier mark in a bounded, faded
 * list) the right one. The panel is ink glass on the night sky and the
 * strokes are pink-white with a soft glow; styles in sections/finale.css.
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

/** The dotted line a signature sits on. */
function Baseline({ width, height }: { width: number; height: number }) {
  return <line className="gb-base" x1="20" y1={height - 30} x2={width - 20} y2={height - 30} />;
}

/** A saved signature's ink: filled outlines (current format) or legacy lines. */
function Ink({ path }: { path: string }) {
  return <path d={path} className={isFilledPath(path) ? "gb-ink" : "gb-ink-line"} />;
}

/** One saved signature, small, for the tally and the list. */
function Mark({ s, className }: { s: SavedSignature; className: string }) {
  return (
    <svg viewBox={`0 0 ${s.width} ${s.height}`} className={className} preserveAspectRatio="xMinYMid meet" aria-hidden="true">
      <Ink path={s.svgPath} />
    </svg>
  );
}

/**
 * The baseline + text prompt shown inside the canvas when the user
 * isn't drawing (loading / anon states): a dotted baseline with a
 * centred italic line above it.
 */
function CanvasBaseline({
  message,
  subMessage,
}: {
  message: string;
  subMessage?: string;
}) {
  return (
    <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="gb-canvas" aria-hidden="true">
      <Baseline width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <text
        className="gb-prompt"
        x={CANVAS_WIDTH / 2}
        y={CANVAS_HEIGHT / 2 - (subMessage ? 6 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {message}
      </text>
      {subMessage ? (
        <text className="gb-sub" x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2 + 16} textAnchor="middle" dominantBaseline="middle">
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
  return (
    <svg viewBox={`0 0 ${signature.width} ${signature.height}`} className="gb-canvas" role="img" aria-label="Your signature">
      <Baseline width={signature.width} height={signature.height} />
      <Ink path={signature.svgPath} />
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

  // the tally shows the newest three; the panel's list carries on from there
  const latest = recent.slice(0, 3);
  const older = recent.slice(3);

  return (
    <section id="guestbook" className="gb">
      <div className="gb-tally">
        <p className="gb-count">
          <span className="gb-num">{state ? totalCount : "—"}</span>
          <span className="gb-num-label">signed so far</span>
        </p>
        {latest.length > 0 ? (
          <ol className="gb-latest" aria-label="Latest signatures">
            {latest.map((s) => (
              <li key={s.id}>
                <Mark s={s} className="gb-latest-mark" />
                <span className="gb-when">{formatRelative(s.createdAt)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="gb-panel">
        <div className="gb-head">
          <h3 className="gb-title">Guestbook</h3>
          <span className="gb-note">one per guest</span>
        </div>

        {/* ── Canvas card ───────────────────────────────────────── */}
        <div className="gb-card">
          {isLoading ? (
            <CanvasBaseline message="…" />
          ) : isSigned && state?.userSignature ? (
            <CanvasReplay signature={state.userSignature} />
          ) : isAnon ? (
            <CanvasBaseline message="leave your mark here" subMessage="guests only" />
          ) : (
            // isReady — drawable canvas
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              className="gb-canvas gb-canvas-live"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <Baseline width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
              {livePath ? (
                <path d={livePath} className="gb-ink" />
              ) : (
                <text className="gb-prompt" x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2} textAnchor="middle" dominantBaseline="middle">
                  sign here…
                </text>
              )}
            </svg>
          )}

          {/* ── Action row — varies per state ──────────────────── */}
          <div className="gb-actions">
            {isLoading ? (
              <span className="gb-note">loading…</span>
            ) : isAnon ? (
              <>
                <span className="gb-note">sign in to add your signature</span>
                <button type="button" onClick={handleSignIn} className="gb-google">
                  <GoogleG className="gb-google-g" />
                  <span>Continue with Google</span>
                  <span aria-hidden="true" className="gb-google-arr">
                    ↗
                  </span>
                </button>
              </>
            ) : isSigned && state?.userSignature ? (
              <>
                <span className="gb-note">
                  thanks{firstName ? `, ${firstName}` : ""} — signed{" "}
                  <span className="gb-note-strong">{formatRelative(state.userSignature.createdAt)}</span>
                </span>
                <button type="button" onClick={() => void handleSignOut()} className="gb-link">
                  sign out
                </button>
              </>
            ) : (
              // isReady
              <>
                <span className="gb-note">{error ? error : firstName ? `signing as ${firstName}` : "signing in…"}</span>
                <div className="gb-buttons">
                  <button type="button" onClick={clearCanvas} disabled={!hasInk || saving} className="gb-btn-quiet">
                    clear
                  </button>
                  <button type="button" onClick={() => void handleSign()} disabled={!hasInk || saving} className="gb-btn">
                    {saving ? "signing…" : "sign"}
                  </button>
                  <button type="button" onClick={() => void handleSignOut()} className="gb-link">
                    sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Earlier signatures — editorial list, bounded height ──
            Not a card grid. One row per signature, hairline dividers,
            index + inline SVG + relative time. The scroll container is
            faded top and bottom, so the panel never grows past its
            frame and older signatures visibly "extend beyond" it. */}
        {older.length > 0 && (
          <div className="gb-older">
            <div className="gb-older-head">
              <h4 className="gb-label">Earlier marks</h4>
              {totalCount > recent.length ? (
                <span className="gb-note">
                  showing {recent.length} of {totalCount}
                </span>
              ) : null}
            </div>
            <div className="gb-scroll">
              <ol className="gb-list">
                {older.map((s, i) => (
                  // Row index counts down from total, so older rows decrement.
                  <li key={s.id} className="gb-row">
                    <span aria-hidden="true" className="gb-idx">
                      {(totalCount - latest.length - i).toString().padStart(3, "0")}
                    </span>
                    <Mark s={s} className="gb-row-mark" />
                    <span className="gb-when">{formatRelative(s.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
