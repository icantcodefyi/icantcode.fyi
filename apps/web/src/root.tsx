import "./index.css";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";

import { ConsoleGreeting } from "@/components/console-greeting";
import { DebugOverlays } from "@/components/debug-overlays";
import { KonamiMode } from "@/components/konami-mode";
import { Oneko } from "@/components/oneko";
import { SecretSynth } from "@/components/secret-synth";
import { Terminal } from "@/components/terminal";
import { UrlTheme } from "@/components/url-theme";
import { ART_BOOT } from "@/lib/art";
import { MODE_BOOT } from "@/lib/mode";
import type { Route } from "./+types/root";

const SHARE = {
  url: "https://icantcode.fyi/",
  title: "Aniruddh Dubge — product engineer",
  description:
    "Self-taught product engineer from Indore, building at Supernova AI in Bengaluru. Thirteen hackathon wins and a lot of anime.",
  image: "https://icantcode.fyi/og.jpg",
  imageAlt: "Aniruddh Dubge in big pink letters beside an anime girl in a white hooded jacket, on a moonlit hill of flowers",
};

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Onest:wght@400;500;600&family=Cinzel:wght@600;800&family=Anton&family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@500;900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="no-js" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {/* Share data lives here, not in route meta(): the site is an SPA, so
            only this static <head> reaches link crawlers (X, WhatsApp, Slack). */}
        <title>Aniruddh Dubge — product engineer</title>
        <meta name="description" content={SHARE.description} />
        <meta name="theme-color" content="#0b0a0d" />
        <link rel="canonical" href={SHARE.url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="icantcode.fyi" />
        <meta property="og:url" content={SHARE.url} />
        <meta property="og:title" content={SHARE.title} />
        <meta property="og:description" content={SHARE.description} />
        <meta property="og:image" content={SHARE.image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={SHARE.imageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@icantcodefyi" />
        <meta name="twitter:creator" content="@icantcodefyi" />
        <meta name="twitter:title" content={SHARE.title} />
        <meta name="twitter:description" content={SHARE.description} />
        <meta name="twitter:image" content={SHARE.image} />
        <meta name="twitter:image:alt" content={SHARE.imageAlt} />
        <script
          // flags script-enhanced entrances before first paint
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.replace('no-js','js')" }}
        />
        <script
          // day / night before first paint, so nothing flashes
          dangerouslySetInnerHTML={{ __html: MODE_BOOT }}
        />
        <script
          // AVIF support + the current mode's hero plates, fetched before the app boots
          dangerouslySetInnerHTML={{ __html: ART_BOOT }}
        />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <UrlTheme />
      <ConsoleGreeting />
      <Oneko />
      <Terminal />
      <KonamiMode />
      <SecretSynth />
      <DebugOverlays />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main className="pt-16 p-4 container mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold">{message}</h1>
      <p className="mt-2 text-muted-foreground">{details}</p>
      {stack && (
        <pre className="mt-4 w-full p-4 overflow-x-auto text-xs bg-muted rounded-lg">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
