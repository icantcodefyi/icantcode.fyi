import { useEffect, useRef, useState } from "react";

// Official composite outline (datameet/maps india-composite.geojson), RDP-simplified,
// equirectangular at 9px/deg with cos(22°) longitude correction.
const INDIA =
  "M79.4 15.4 L82.7 15.6 L82.9 14.8 L84.8 14.8 L85.5 13.3 L90.1 12.0 L90.6 11.0 L94.7 10.9 L95.9 12.2 L96.6 11.7 L97.7 14.0 L100.1 14.4 L100.6 16.0 L101.8 14.6 L103.6 15.5 L100.8 22.4 L98.4 23.2 L98.4 24.5 L96.0 24.7 L96.9 26.7 L95.2 28.8 L90.8 29.0 L92.5 32.1 L91.0 32.2 L91.3 34.4 L92.7 36.0 L95.2 36.1 L94.6 37.8 L96.4 40.7 L91.5 43.8 L90.0 42.5 L89.6 40.5 L86.7 42.0 L87.5 44.3 L90.0 46.9 L89.3 48.5 L90.5 50.3 L89.5 51.2 L89.9 53.0 L91.0 53.2 L92.6 51.7 L95.4 55.6 L99.0 56.1 L102.1 57.9 L102.0 59.6 L108.7 62.6 L103.2 67.1 L103.5 68.4 L102.2 69.8 L102.6 72.0 L101.3 72.9 L100.8 75.4 L104.5 77.8 L104.9 76.6 L110.2 79.6 L111.1 81.6 L112.2 81.4 L115.9 84.1 L117.4 83.5 L120.6 85.7 L122.7 85.3 L123.0 87.3 L126.7 87.7 L127.8 88.8 L128.4 87.5 L132.4 88.7 L132.2 87.8 L134.8 87.1 L135.9 88.3 L138.7 88.8 L138.9 91.4 L143.5 93.0 L143.6 94.0 L147.1 92.9 L149.0 95.7 L150.4 94.8 L153.0 95.2 L156.3 97.0 L159.1 95.5 L159.3 96.7 L161.4 97.7 L166.0 96.4 L167.0 97.5 L168.4 94.2 L166.8 90.7 L168.5 84.7 L167.9 83.5 L172.2 81.7 L173.9 82.7 L174.3 84.1 L173.3 86.7 L174.5 89.2 L173.1 90.5 L176.4 93.5 L178.4 93.0 L182.4 94.5 L186.5 92.7 L189.6 93.9 L197.7 93.5 L199.4 92.5 L200.7 93.2 L200.6 89.5 L201.3 89.2 L200.4 87.5 L197.4 87.5 L196.6 86.1 L197.3 85.0 L199.6 85.4 L202.3 83.8 L204.1 84.7 L206.4 83.0 L205.9 81.4 L208.0 81.0 L210.7 77.9 L217.1 75.7 L220.0 73.6 L219.4 72.4 L222.7 70.9 L223.7 72.3 L227.5 73.2 L233.4 70.4 L235.9 71.6 L235.2 73.5 L236.4 72.8 L239.0 76.6 L237.0 78.2 L237.8 78.9 L237.8 77.9 L239.6 77.3 L241.4 79.6 L243.0 79.5 L245.0 81.0 L245.2 83.8 L244.1 83.7 L241.1 86.4 L243.3 90.7 L240.9 90.2 L239.5 88.4 L235.6 89.3 L228.9 94.5 L226.5 95.3 L225.8 96.8 L226.9 100.1 L224.5 104.7 L222.3 106.2 L221.8 107.9 L223.1 108.7 L222.9 110.4 L220.3 114.5 L218.3 120.2 L214.9 118.8 L212.8 119.3 L211.4 118.1 L212.3 121.6 L211.8 126.6 L211.1 127.7 L209.7 127.4 L210.3 134.4 L208.9 135.0 L208.6 137.0 L207.8 137.3 L206.1 135.4 L205.3 137.0 L202.6 121.3 L200.7 122.0 L199.9 121.2 L200.0 123.5 L198.3 125.1 L198.9 127.0 L197.1 128.4 L195.7 125.5 L195.4 127.2 L194.8 126.9 L193.3 122.2 L195.1 117.8 L196.8 118.1 L197.5 116.7 L198.3 117.5 L198.1 116.6 L199.5 117.6 L199.6 115.8 L201.6 115.0 L202.7 112.2 L202.2 110.7 L204.4 110.9 L203.8 109.5 L200.8 108.1 L187.3 108.5 L182.2 107.2 L182.6 101.3 L180.9 98.7 L180.1 101.1 L178.2 100.7 L176.5 99.6 L176.0 97.2 L174.4 97.1 L175.7 98.6 L172.5 98.4 L173.1 97.7 L170.2 95.2 L169.7 96.5 L171.3 97.6 L168.4 99.5 L167.8 102.5 L169.1 102.5 L171.4 105.2 L173.7 105.1 L173.9 106.5 L175.3 107.4 L174.6 108.3 L170.6 107.9 L170.2 110.3 L169.6 111.0 L168.0 110.4 L167.0 112.8 L169.7 115.4 L173.0 116.3 L173.3 119.0 L171.7 120.0 L171.6 122.0 L173.6 123.3 L172.9 125.5 L175.2 125.9 L173.9 127.7 L175.0 129.2 L174.7 131.8 L176.1 135.4 L175.1 137.7 L176.1 140.1 L174.6 140.1 L174.1 138.8 L174.0 140.3 L172.9 139.7 L173.4 136.7 L172.2 136.1 L171.5 138.5 L171.2 137.3 L170.7 137.7 L170.7 140.3 L170.4 139.3 L170.2 140.5 L170.2 139.3 L169.2 139.2 L169.0 140.7 L168.6 135.5 L167.1 134.8 L168.5 135.9 L165.3 139.5 L159.3 141.0 L157.8 142.8 L157.1 144.6 L158.3 147.4 L157.4 147.8 L159.1 148.3 L156.3 150.0 L156.8 151.4 L155.8 152.2 L156.9 151.7 L154.6 153.1 L153.3 155.2 L146.4 157.5 L142.2 160.3 L134.6 170.0 L129.8 172.6 L127.0 176.5 L119.4 181.5 L119.4 185.8 L114.4 188.1 L113.1 187.5 L110.7 188.2 L108.0 193.4 L105.8 191.8 L102.3 193.8 L100.5 199.1 L101.8 203.6 L101.2 208.2 L103.0 215.3 L101.4 222.6 L98.1 229.8 L99.1 242.1 L95.6 241.7 L94.1 242.6 L94.0 244.4 L91.0 249.4 L91.5 250.7 L93.4 251.3 L85.7 253.6 L84.0 259.4 L79.7 262.1 L75.2 259.6 L71.3 254.7 L72.3 253.9 L71.3 254.4 L69.7 250.5 L69.0 244.5 L66.0 237.7 L65.7 234.7 L62.9 229.4 L60.1 226.8 L57.0 219.3 L56.1 212.1 L53.6 206.3 L54.4 206.6 L52.4 202.4 L51.0 201.9 L51.4 201.1 L49.3 199.1 L49.2 196.8 L48.3 196.1 L49.1 196.0 L45.9 191.3 L44.8 187.4 L45.6 187.1 L44.8 187.2 L44.4 186.2 L45.4 186.3 L44.4 185.4 L45.1 185.3 L44.3 184.2 L44.4 181.4 L43.3 179.1 L44.2 179.2 L43.2 178.2 L43.5 176.5 L41.2 170.8 L41.4 170.3 L42.6 171.5 L42.4 169.9 L41.1 169.7 L40.9 167.9 L41.8 168.6 L40.5 166.6 L41.2 165.4 L41.9 166.4 L41.0 164.7 L42.3 163.6 L41.6 162.1 L40.1 164.8 L39.9 161.1 L41.0 161.2 L39.6 159.7 L40.8 159.1 L39.5 159.0 L38.8 156.3 L40.9 150.0 L40.4 148.1 L41.1 148.0 L40.3 147.7 L40.5 146.1 L39.5 145.8 L40.5 145.5 L39.3 145.0 L40.0 144.2 L38.7 145.1 L38.7 143.9 L39.6 144.0 L38.4 143.1 L39.7 141.8 L39.0 141.3 L41.1 139.7 L37.9 139.9 L38.5 137.6 L39.6 137.0 L37.6 137.4 L38.3 135.0 L41.0 134.4 L37.8 134.1 L37.0 135.0 L36.1 134.0 L34.9 136.6 L35.4 137.5 L34.7 137.2 L35.9 140.2 L34.3 144.0 L23.5 148.6 L18.0 145.3 L7.8 134.0 L8.9 132.5 L8.6 133.3 L9.9 133.0 L10.2 134.5 L12.6 133.0 L13.9 133.9 L14.4 132.5 L15.1 133.2 L16.6 131.9 L18.1 131.9 L20.4 128.1 L19.1 128.3 L18.5 127.3 L18.6 128.2 L15.7 128.6 L14.3 130.2 L11.4 128.9 L10.0 129.3 L5.3 126.3 L6.0 126.6 L4.8 125.8 L5.7 125.1 L3.5 123.2 L6.8 119.9 L4.3 121.1 L3.6 120.4 L2.9 122.6 L1.4 122.2 L2.9 121.2 L1.6 121.2 L3.0 119.0 L6.3 119.1 L6.7 116.0 L7.2 116.9 L7.9 116.1 L8.4 116.8 L13.3 116.2 L14.4 117.3 L16.9 117.3 L17.6 116.1 L21.4 115.0 L21.5 116.5 L22.6 116.9 L26.0 115.2 L25.0 114.8 L25.8 112.6 L22.2 106.2 L22.2 103.5 L18.9 103.4 L17.5 101.4 L18.1 95.8 L12.6 94.1 L13.2 90.2 L19.8 82.7 L21.6 82.7 L22.9 85.1 L24.0 85.5 L32.5 83.1 L36.6 75.9 L41.3 73.5 L45.0 65.3 L49.8 63.0 L49.5 60.4 L55.9 55.1 L54.3 54.6 L55.5 52.0 L54.1 49.4 L55.1 47.8 L57.4 46.3 L60.4 46.0 L61.5 44.8 L59.3 42.5 L55.8 42.4 L56.0 39.2 L55.4 40.0 L53.2 39.9 L47.0 37.0 L46.7 29.8 L45.0 25.4 L45.5 23.7 L47.2 23.7 L47.8 21.9 L50.4 20.8 L51.2 18.7 L48.0 17.8 L48.3 15.1 L45.1 15.0 L42.8 13.3 L43.2 12.1 L38.1 12.1 L38.0 8.7 L41.5 6.5 L42.2 4.5 L48.8 4.3 L47.3 2.5 L50.4 3.3 L53.6 1.7 L54.8 2.1 L55.8 0.9 L57.6 2.3 L59.6 1.5 L61.9 2.2 L62.3 4.2 L64.6 4.0 L67.0 6.8 L72.8 9.4 L73.8 12.1 L78.0 13.3 L79.4 15.4Z M207.9 218.6 L208.5 222.0 L208.0 223.2 L207.0 222.7 L207.7 223.9 L206.2 223.9 L206.1 221.3 L206.9 221.1 L206.4 219.4 L207.9 218.6Z M209.0 212.9 L209.4 214.9 L208.3 214.7 L209.2 215.4 L209.0 217.3 L207.8 217.0 L207.9 218.2 L207.0 218.6 L207.2 214.9 L208.0 213.0 L209.0 212.9Z M206.2 224.8 L207.0 227.7 L205.9 230.0 L206.6 230.1 L205.9 231.3 L204.6 228.2 L205.0 227.3 L205.4 228.2 L206.2 224.8Z";

const HOME = { x: 66, y: 130 };

const CITIES = [
  { name: "Indore", x: 66, y: 130, events: ["WebGranth — 1st", "HackHive — 1st", "Hackistica '23 — first ever", "HackWave — organised"] },
  { name: "Bangalore", x: 80, y: 218, events: ["EthIndia 2023 — first flight here", "EthIndia 2024 — Polkadot", "Unfold 2024 — Nethermind"] },
  { name: "Pune", x: 49, y: 168, events: ["The Better Hack — 2nd"] },
  { name: "Mumbai", x: 41, y: 163, events: ["Imagine Hackathon — organised"] },
  { name: "Delhi", x: 77, y: 77, events: ["HackVSIT 5.0 — 3rd"] },
  { name: "Roorkee", x: 83, y: 66, events: ["Syntax Error X — Manga track"] },
  { name: "Jammu", x: 57, y: 40, events: ["Udaymitsav '24 — 1st track"] },
  { name: "Bhopal", x: 79, y: 125, events: ["Version Beta — 3rd"] },
  { name: "Chennai", x: 102, y: 217, events: ["Genesis 1.0 — Berachain"] },
];

/** Bowed arc from home to a city, bulging to the right of travel. */
function arc(x: number, y: number) {
  const mx = (HOME.x + x) / 2, my = (HOME.y + y) / 2;
  const dx = x - HOME.x, dy = y - HOME.y;
  return `M${HOME.x} ${HOME.y} Q${mx - dy * 0.35} ${my + dx * 0.35} ${x} ${y}`;
}

export function IndiaMap() {
  const ref = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const city = CITIES[active];

  return (
    <div className="mt-6 grid items-center gap-6 sm:grid-cols-[1fr_200px]">
      <svg ref={ref} viewBox="-4 -4 256 272" className={`india-map w-full max-w-[380px] ${on ? "is-on" : ""}`} fill="none">
        <path d={INDIA} fill="var(--pastel-sage)" fillOpacity="0.35" stroke="oklch(0.30 0.015 60)" strokeWidth="1.2" strokeLinejoin="round" className="map-outline" pathLength={1} />
        {CITIES.slice(1).map((c, i) => (
          <path key={c.name} d={arc(c.x, c.y)} className="map-route" pathLength={1} style={{ animationDelay: `${0.8 + i * 0.18}s` }} />
        ))}
        {CITIES.map((c, i) => (
          <g
            key={c.name}
            className="map-pin"
            style={{ animationDelay: `${1 + i * 0.18}s` }}
            onPointerEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <circle cx={c.x} cy={c.y} r="9" fill="transparent" />
            <circle cx={c.x} cy={c.y} r={i === active ? 5 : 3.5} fill={i === 0 ? "var(--pastel-blush)" : "var(--pastel-butter)"} stroke="oklch(0.30 0.015 60)" strokeWidth="1.3" className="transition-all duration-300" />
            {i === active && <circle cx={c.x} cy={c.y} r="5" className="map-ping" />}
          </g>
        ))}
        <text x={HOME.x - 8} y={HOME.y + 3} className="fill-foreground/60 font-mono text-[8px] uppercase tracking-widest" textAnchor="end">home</text>
      </svg>
      <div key={active} className="map-card rounded-xl border border-border bg-card p-4 shadow-[0_14px_24px_-18px_oklch(0.2_0.02_60/0.35)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{active === 0 ? "home base" : "flew to"}</p>
        <p className="mt-1 font-display text-xl font-medium">{city.name}</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {city.events.map((e) => (
            <li key={e}>✦ {e}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground/70">← hover the pins</p>
      </div>
    </div>
  );
}
