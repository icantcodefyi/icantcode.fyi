import { NavLink } from "react-router";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80">
      <div className="mx-auto max-w-2xl flex items-center justify-between px-5 py-3">
        <NavLink
          to="/"
          className="font-display text-base font-medium tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          aniruddh
        </NavLink>
        <nav className="flex items-center gap-5">
          <a
            href="https://github.com/icantcodefyi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            github
          </a>
          <a
            href="https://twitter.com/icantcodefyi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            twitter
          </a>
          <a
            href="mailto:icantcodefyi@gmail.com"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            contact
          </a>
        </nav>
      </div>
    </header>
  );
}
