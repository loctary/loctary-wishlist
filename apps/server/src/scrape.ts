/**
 * Product-page metadata scraper. Given a public URL, fetches the HTML and
 * extracts what most e-commerce sites expose via OpenGraph / Twitter Card /
 * JSON-LD (schema.org/Product) — title, description, price, currency, image.
 *
 * No general-purpose scraper here: this only touches META tags and JSON-LD
 * `<script>` blocks. If a store doesn't expose those, we return partial data
 * and let the user fill the rest by hand. If we start seeing systematic
 * misses on specific domains, wire a hosted scraper API in as a fallback
 * inside `scrapeProductPage`, keyed by hostname.
 */

/**
 * A large chunk of e-commerce sites block obvious bot user-agents outright
 * (403 / "please enable JS"). Presenting as a stock Chrome-on-Windows browser
 * gets us past most of them. The heavy hitters (Rozetka, Amazon, Shein, …)
 * fingerprint TLS / run JS challenges and will still block us — those need a
 * hosted scraper (see comment on `scrapeProductPage`).
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

/**
 * `null` fields → nothing was extracted for that key. `blocked=true` → the
 * fetch itself failed (403, network error, timeout, non-html response) so
 * the caller can tell "site blocked us" from "site loaded but no metadata"
 * in error messaging.
 */
export interface ScrapedProduct {
  title: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  /** Absolute URL to a product image on the source page (not yet uploaded). */
  imageUrl: string | null;
  blocked: boolean;
}

/**
 * Validate a user-supplied URL and reject the SSRF-hostile shapes: non-http(s),
 * localhost, private IP ranges, link-local. Returns the parsed URL or null.
 */
export function ssrfSafeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host === "0.0.0.0" || host === "::" || host === "::1") return null;
  if (/^127\./.test(host)) return null;
  if (/^10\./.test(host)) return null;
  if (/^192\.168\./.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null;
  if (/^169\.254\./.test(host)) return null;
  // IPv6 loopback / link-local / ULA
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return null;
  return u;
}

/** Fetch `url` with a timeout, following redirects, capped at MAX_HTML_BYTES. */
async function fetchHtml(url: URL): Promise<{ html: string; finalUrl: URL } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: BROWSER_HEADERS,
    });
    if (!res.ok || !res.body) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct && !ct.includes("html") && !ct.includes("xml")) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
      if (total >= MAX_HTML_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    const buf = new Uint8Array(total > MAX_HTML_BYTES ? MAX_HTML_BYTES : total);
    let off = 0;
    for (const c of chunks) {
      const take = Math.min(c.byteLength, buf.byteLength - off);
      buf.set(c.subarray(0, take), off);
      off += take;
      if (off >= buf.byteLength) break;
    }
    return {
      html: new TextDecoder("utf-8", { fatal: false }).decode(buf),
      finalUrl: new URL(res.url || url.toString()),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* --- HTML entity decoding (small, safe subset) --------------------------- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, code: string) => {
    const c = code.toLowerCase();
    if (c.startsWith("#x")) {
      const n = parseInt(c.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    if (c.startsWith("#")) {
      const n = parseInt(c.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[c] ?? m;
  });
}

/* --- <meta> extraction --------------------------------------------------- */

function extractMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const metaRe = /<meta\b([^>]*?)\/?>/gi;
  for (const match of html.matchAll(metaRe)) {
    const attrs = match[1] ?? "";
    const key =
      attrs.match(/\bproperty\s*=\s*["']([^"']+)["']/i)?.[1] ??
      attrs.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1] ??
      attrs.match(/\bitemprop\s*=\s*["']([^"']+)["']/i)?.[1];
    const content = attrs.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!key || content === undefined) continue;
    const k = key.trim().toLowerCase();
    // First win — page-level tags usually appear before per-widget dupes.
    if (!(k in out) && content.length > 0) out[k] = decodeEntities(content);
  }
  return out;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const raw = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  return raw || null;
}

/* --- JSON-LD ------------------------------------------------------------- */

function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some sites emit multiple concatenated objects — try wrapping.
      try {
        out.push(JSON.parse(`[${raw}]`));
      } catch {
        /* ignore malformed */
      }
    }
  }
  return out;
}

/**
 * Walk a JSON-LD payload (which may be an object, an array, or `@graph` wrapped)
 * and return the first node whose @type is (or contains) "Product".
 */
function findProductNode(root: unknown): Record<string, unknown> | null {
  const queue: unknown[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isProduct =
      type === "Product" || (Array.isArray(type) && type.includes("Product"));
    if (isProduct) return obj;
    // Descend into common wrappers.
    if (Array.isArray(obj["@graph"])) queue.push(...(obj["@graph"] as unknown[]));
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}

/** Parse a possibly comma-formatted number string. Returns null on non-finite. */
function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^\d,.\-]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Product offer shape varies wildly; try all the common paths. */
function readOffer(product: Record<string, unknown>): { price: number | null; currency: string | null } {
  const offers = product["offers"];
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const price = parseMoney(o["price"] ?? o["lowPrice"]);
    const currency =
      typeof o["priceCurrency"] === "string" ? (o["priceCurrency"] as string) : null;
    if (price !== null) return { price, currency };
    // priceSpecification.price / priceCurrency
    const spec = o["priceSpecification"];
    if (spec && typeof spec === "object") {
      const s = spec as Record<string, unknown>;
      const p2 = parseMoney(s["price"]);
      const c2 = typeof s["priceCurrency"] === "string" ? (s["priceCurrency"] as string) : null;
      if (p2 !== null) return { price: p2, currency: c2 };
    }
  }
  return { price: null, currency: null };
}

function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>)["url"];
        if (typeof url === "string") return url;
      }
    }
  }
  if (v && typeof v === "object") {
    const url = (v as Record<string, unknown>)["url"];
    if (typeof url === "string") return url;
  }
  return null;
}

function toAbsolute(base: URL, maybe: string | null): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

function trim(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

/**
 * Fetch `url` and extract product metadata. Returns partial data — every
 * field is nullable; the caller should fill in what's present and ignore
 * what's not.
 */
export async function scrapeProductPage(rawUrl: string): Promise<ScrapedProduct> {
  const empty: ScrapedProduct = {
    title: null,
    description: null,
    price: null,
    currency: null,
    imageUrl: null,
    blocked: false,
  };
  const url = ssrfSafeUrl(rawUrl);
  if (!url) return { ...empty, blocked: true };

  const fetched = await fetchHtml(url);
  if (!fetched) return { ...empty, blocked: true };
  const { html, finalUrl } = fetched;

  const meta = extractMeta(html);
  const jsonLd = extractJsonLd(html);

  let product: Record<string, unknown> | null = null;
  for (const node of jsonLd) {
    product = findProductNode(node);
    if (product) break;
  }

  // Title: OG → Twitter → JSON-LD name → <title>
  const title = trim(
    meta["og:title"] ??
      meta["twitter:title"] ??
      (typeof product?.["name"] === "string" ? (product["name"] as string) : null) ??
      extractTitle(html),
  );

  // Description: OG → Twitter → JSON-LD → <meta name="description">
  const description = trim(
    meta["og:description"] ??
      meta["twitter:description"] ??
      (typeof product?.["description"] === "string" ? (product["description"] as string) : null) ??
      meta["description"],
  );

  // Price/currency: OG product tags → JSON-LD offers
  let price = parseMoney(meta["product:price:amount"] ?? meta["og:price:amount"]);
  let currency =
    trim(meta["product:price:currency"] ?? meta["og:price:currency"])?.toUpperCase() ?? null;
  if (price === null && product) {
    const offer = readOffer(product);
    price = offer.price;
    if (!currency && offer.currency) currency = offer.currency.toUpperCase();
  }

  // Image: OG → Twitter → JSON-LD product image
  const rawImage =
    meta["og:image:secure_url"] ??
    meta["og:image"] ??
    meta["twitter:image"] ??
    firstString(product?.["image"]);
  const imageUrl = toAbsolute(finalUrl, rawImage ?? null);

  return { title, description, price, currency, imageUrl, blocked: false };
}
