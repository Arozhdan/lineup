/** Extract coordinates from a pasted maps link (Google / Apple / Mapy.cz).
    Short links (maps.app.goo.gl) are expanded by following redirects. */

const COORD_PATTERNS = [
  /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // google .../@50.08,14.43,15z
  /[?&]q=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/, // ?q=50.08,14.43
  /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // google data blob
  /[?&]ll=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/, // apple ?ll=
  /[?&]x=(-?\d{1,3}\.\d+)&y=(-?\d{1,3}\.\d+)/, // mapy.cz ?x=14.43&y=50.08 (lng,lat!)
];

export function extractCoords(url: string): { lat: number; lng: number } | null {
  for (const re of COORD_PATTERNS) {
    const m = url.match(re);
    if (!m) continue;
    let lat = Number(m[1]);
    let lng = Number(m[2]);
    if (re.source.includes("x=")) [lat, lng] = [lng, lat]; // mapy.cz order
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

/** Best-effort: expand short links and pull coordinates. Never throws. */
export async function resolveMapsLink(url: string): Promise<{ lat: number; lng: number } | null> {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  const direct = extractCoords(u);
  if (direct) return direct;
  if (!/goo\.gl|maps\.app|mapy\.cz\/s\//i.test(u)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(u, { redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    let final = res.url ?? "";
    // Google may bounce through a consent page that wraps the real URL.
    if (final.includes("consent.google.com")) {
      const cont = new URL(final).searchParams.get("continue");
      if (cont) final = decodeURIComponent(cont);
    }
    return extractCoords(final);
  } catch {
    return null;
  }
}
