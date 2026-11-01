import "./index.css";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";

import type { Route } from "./+types/root";

const SHARE = {
  url: "https://www.icantcode.fyi/",
  title: "icantcodefyi",
  description:
    "Self-taught product engineer from Indore, building at Supernova AI in Bengaluru. Thirteen hackathon wins and a lot of anime.",
  image: "https://www.icantcode.fyi/og.jpg?v=2",
  imageAlt: "Aniruddh Dubge in black letters on white, with a one-line intro and icantcode.fyi",
};

const PERSON = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Aniruddh Dubge",
  alternateName: ["ani", "icantcodefyi"],
  url: SHARE.url,
  image: SHARE.image,
  jobTitle: "Product engineer",
  worksFor: { "@type": "Organization", name: "Supernova AI" },
  homeLocation: { "@type": "Place", name: "Bengaluru, India" },
  description: SHARE.description,
  sameAs: [
    "https://github.com/icantcodefyi",
    "https://twitter.com/icantcodefyi",
    "https://www.linkedin.com/in/aniruddhdubge",
  ],
};

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {/* Share data lives here, not in route meta(): the site is an SPA, so
            only this static <head> reaches link crawlers (X, WhatsApp, Slack). */}
        <title>icantcodefyi</title>
        <meta name="description" content={SHARE.description} />
        <meta name="theme-color" content="#ffffff" />
        <meta name="author" content="Aniruddh Dubge" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <script
          type="application/ld+json"
          // who this site is about, for search engines
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON) }}
        />
        <link rel="canonical" href={SHARE.url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="icantcodefyi" />
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
    <Outlet />
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
    <main>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
