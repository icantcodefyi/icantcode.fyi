import type { ReactNode } from "react";

import { Contact } from "./contact";

/**
 * The finale: Guestbook, then Contact. `wall` is the guestbook itself, which
 * the page hands in already wrapped as a deferred chunk (it carries the auth
 * and RPC client).
 */
export function Finale({ wall }: { wall: ReactNode }) {
  return (
    <>
      <section className="bg-surface px-[var(--margin)] py-36">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="t-head" data-reveal>
              Leave a mark
            </h2>
            <p className="mt-6 max-w-[36ch]" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
              Draw a signature, a doodle or a tiny cat. One per visitor, and it stays on the wall.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7" data-reveal style={{ "--d": "120ms" } as React.CSSProperties}>
            {wall}
          </div>
        </div>
      </section>

      <Contact />
    </>
  );
}
