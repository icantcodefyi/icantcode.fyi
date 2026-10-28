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
