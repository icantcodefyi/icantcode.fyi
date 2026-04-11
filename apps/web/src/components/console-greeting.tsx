import { useEffect } from "react";

import { unlock } from "@/lib/achievements";

/**
 * ConsoleGreeting — one-shot styled console.log for anyone who opens
 * devtools. Prints a little ASCII sketch + a wink + a hidden link.
 *
 * Safari/Firefox honor %c, mobile browsers ignore it gracefully. We
 * guard with a window flag so React StrictMode double-invoke doesn't
 * print twice.
 */

const ASCII = `
   /\\_/\\
  ( o.o )     ani's portfolio
   > ^ <      welcome to the inside
  /     \\     you're the kind of visitor i like
 /       \\    help yourself to the secret below
 \\_______/
`;

const HEADING =
  "color: oklch(0.70 0.15 330); font: 700 14px/1.4 'Erode', serif;";
const BODY =
  "color: oklch(0.40 0.02 60); font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;";
const HINT =
  "color: oklch(0.55 0.09 155); font: 600 11px/1.4 ui-monospace, monospace;";
const LINK =
  "color: oklch(0.62 0.15 240); font: 600 12px/1.4 ui-monospace, monospace; text-decoration: underline;";

export function ConsoleGreeting() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window as unknown as { __iccGreeted?: boolean };
    if (flag.__iccGreeted) return;
    flag.__iccGreeted = true;

    /* eslint-disable no-console */
    console.log(`%c${ASCII}`, BODY);
    console.log("%chi, you're snooping.", HEADING);
    console.log(
      "%cthat's a good instinct. press %c` %cto open the terminal, or run %chire me%c in it.",
      BODY,
      HINT,
      BODY,
      HINT,
      BODY,
    );
    console.log(
      "%csecret link: %chttps://icantcode.fyi/?theme=re-zero",
      BODY,
      LINK,
    );
    console.log(
      "%cbuilt with care. source → %chttps://github.com/icantcodefyi",
      BODY,
      LINK,
    );
    /* eslint-enable no-console */

    unlock("console");
  }, []);

  return null;
}
