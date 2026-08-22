/* ============================================================
   THE COLD FRONT — optional Cloudflare Worker proxy (always-on, anywhere)
   ------------------------------------------------------------
   Use this when the local proxy isn't available (phone, other PCs).
   It does the same job as proxy/cf-proxy.ps1 but runs on Cloudflare's
   edge, so the site can reach ESPN feeds from any device/network.

   Deploy (free tier is plenty for a fan site):
     1. npm i -g wrangler   (or use the Cloudflare dashboard's
        "Workers & Pages -> Create worker" and paste this file)
     2. wrangler login
     3. cd proxy && wrangler deploy
     4. Put your worker URL in js/common.js -> CF.CONFIG.endpoints.remoteProxy
        e.g. remoteProxy: "https://cf-proxy.<you>.workers.dev",
   ============================================================ */

const ALLOWED_HOSTS = new Set([
  "site.api.espn.com",
  "site.web.api.espn.com",
  "sports.core.api.espn.com",
  "www.espn.com",
  "www.thesportsdb.com",
  "gamma-api.polymarket.com",
  "clob.polymarket.com",
  "api.open-meteo.com",
  "api.weather.gov",
  "news.google.com",
  "www.bing.com",
  "api.the-odds-api.com",
  "v3.football.api-sports.io",
]);

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*",
    // Chrome Private Network Access (public site -> loopback / private LAN).
    "access-control-allow-private-network": "true",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "content-type": "application/json" }, cors()),
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return json({ ok: true });
    if (url.pathname !== "/fetch") return json({ error: "not found" }, 404);

    const target = url.searchParams.get("url") || "";
    let t;
    try { t = new URL(target); } catch (e) { return json({ error: "bad url" }, 400); }
    if (t.protocol !== "https:" || !ALLOWED_HOSTS.has(t.hostname)) {
      return json({ error: "host not allowed" }, 403);
    }

    try {
      const upstream = await fetch(t.toString(), {
        headers: {
          // Non-browser UA: some networks make ESPN 403 browser traffic.
          "user-agent": "curl/8.13.0",
          accept: "*/*",
        },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: Object.assign(
          { "content-type": upstream.headers.get("content-type") || "application/json" },
          cors()
        ),
      });
    } catch (e) {
      return json({ error: "upstream failed" }, 502);
    }
  },
};
