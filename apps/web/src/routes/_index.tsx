import { EARLIER, EMAIL, HOSTED, MAILTO, SOCIALS, WINS, WORK, type Win } from "@/lib/site-data";

const when = (w: Win) => (w.year ? [w.month, w.year].filter(Boolean).join(" ") : "Undated");

function WinRows({ rows, did = "What I built" }: { rows: readonly Win[]; did?: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>{did}</th>
          <th>Where</th>
          <th>Result</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((w) => (
          <tr key={w.event}>
            <td>{w.event}</td>
            <td>{w.built}</td>
            <td>
              {w.venue}
              {w.online ? " (online)" : ""}
            </td>
            <td>{w.prize}</td>
            <td>{when(w)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Home() {
  return (
    <main>
      <h1>Aniruddh Dubge</h1>
      <p>
        <i>a.k.a. ani, icantcodefyi</i>
      </p>
      <p>
        Self-taught product engineer from Indore, building at Supernova AI in Bengaluru. Thirteen hackathon wins and
        a lot of anime.
      </p>
      <p>
        <a href={MAILTO}>{EMAIL}</a>
        {SOCIALS.map((s) => (
          <span key={s.href}>
            {" · "}
            <a href={s.href}>{s.label}</a>
          </span>
        ))}
      </p>

      <p>
        Jump to: <a href="#work">Work</a> · <a href="#hackathons">Hackathons</a> · <a href="#contact">Contact</a>
      </p>

      <hr />

      <h2 id="work">Recent work</h2>
      <ul>
        {WORK.map((w) => (
          <li key={w.name}>
            <a href={w.url}>{w.name}</a> ({w.tags}). {w.what}
          </li>
        ))}
      </ul>
      <p>Earlier: {EARLIER.join(", ")}.</p>

      <hr />

      <h2 id="hackathons">Hackathons</h2>
      <p>Thirteen wins, newest first.</p>
      <div className="scroll"><WinRows rows={WINS} /></div>
      <h3>Organised</h3>
      <div className="scroll"><WinRows rows={HOSTED} did="What I did" /></div>

      <hr />


      <h2 id="contact">Contact</h2>
      <p>
        Email me at <a href={MAILTO}>{EMAIL}</a>, or find me on{" "}
        {SOCIALS.map((s, i) => (
          <span key={s.href}>
            {i > 0 ? (i === SOCIALS.length - 1 ? " and " : ", ") : ""}
            <a href={s.href}>{s.label}</a>
          </span>
        ))}
        . I live in Bengaluru, from Indore.
      </p>

      <hr />

      <footer>
        <small>© 2026 Aniruddh Dubge.</small>
      </footer>
    </main>
  );
}
