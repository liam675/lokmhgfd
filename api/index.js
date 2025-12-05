// /api/index.js
const { kv } = require("@vercel/kv");

// Helper to parse raw JSON body for POST requests
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  const url = req.url || "";
  const method = (req.method || "GET").toUpperCase();

  // load KV objects (or default)
  let licenses = await kv.get("licenses") || {};
  let heartbeats = await kv.get("heartbeats") || {};

  // ensure objects exist in KV (first run)
  if (!licenses || typeof licenses !== "object") {
    licenses = {};
    await kv.set("licenses", licenses);
  }
  if (!heartbeats || typeof heartbeats !== "object") {
    heartbeats = {};
    await kv.set("heartbeats", heartbeats);
  }

  // POST endpoints need body
  let body = {};
  if (method === "POST") {
    try {
      body = await parseBody(req);
    } catch (e) {
      return res.statusCode = 400, res.end(JSON.stringify({ ok:false, error:"invalid_json" }));
    }
  }

  // ---------- VERIFY ----------
  // POST /api/verify  { key: "KEY" }
  if (url.startsWith("/api/verify")) {
    const key = body.key || (req.query && req.query.key) || null;
    if (!key) return res.end(JSON.stringify({ ok:false, error:"missing_key" }));

    const valid = Boolean(licenses[key]);
    return res.end(JSON.stringify({ ok:true, valid }));
  }

  // ---------- HEARTBEAT ----------
  // POST /api/heartbeat  { key: "KEY", user: "username", meta: { ... } }
  if (url.startsWith("/api/heartbeat")) {
    const key = body.key;
    const user = body.user;
    const meta = body.meta || null;

    if (!key || !user) return res.end(JSON.stringify({ ok:false, error:"missing_fields" }));

    if (!licenses[key]) return res.end(JSON.stringify({ ok:false, error:"invalid_key" }));

    // update heartbeat
    heartbeats[user] = {
      key,
      last: Date.now(),
      meta
    };

    await kv.set("heartbeats", heartbeats);
    return res.end(JSON.stringify({ ok:true, saved:true, timestamp: heartbeats[user].last }));
  }

  // ---------- STATUS ----------
  // GET /api/status?user=username  OR POST /api/status { user: "username" }
  if (url.startsWith("/api/status")) {
    // allow POST body or query param
    const user = (method === "POST") ? body.user : new URL("http://x"+url).searchParams.get("user");
    if (!user) return res.end(JSON.stringify({ ok:false, error:"missing_user" }));

    const hb = heartbeats[user];
    if (!hb) return res.end(JSON.stringify({ ok:true, online:false }));

    const now = Date.now();
    const ONLINE_THRESHOLD = 20 * 1000; // 20s
    const online = (now - hb.last) < ONLINE_THRESHOLD;

    return res.end(JSON.stringify({
      ok: true,
      online,
      last: hb.last,
      human_last: new Date(hb.last).toISOString(),
      meta: hb.meta || null
    }));
  }

  // ---------- ADMIN: add license ----------
  // POST /api/admin/add_license  (headers or query must include admin token)
  // body: { key: "KEY", owner: "name", expires: null or ms, hwid: "" }
  if (url.startsWith("/api/admin/add_license")) {
    const tokenHeader = req.headers["x-admin-token"] || req.headers["admin_token"];
    const tokenQuery = new URL("http://x"+url).searchParams.get("token");
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

    const provided = tokenHeader || tokenQuery;
    if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
      return res.statusCode = 403, res.end(JSON.stringify({ ok:false, error:"unauthorized" }));
    }

    const { key, owner, expires, hwid } = body || {};
    if (!key || !owner) return res.end(JSON.stringify({ ok:false, error:"missing_fields" }));

    licenses[key] = { owner, created: Date.now(), expires: expires || null, hwid: hwid || "" };
    await kv.set("licenses", licenses);

    return res.end(JSON.stringify({ ok:true, added:true, key, meta: licenses[key] }));
  }

  // ---------- ADMIN: list heartbeats ----------
  if (url.startsWith("/api/admin/list_heartbeats")) {
    const tokenHeader = req.headers["x-admin-token"] || req.headers["admin_token"];
    const tokenQuery = new URL("http://x"+url).searchParams.get("token");
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

    const provided = tokenHeader || tokenQuery;
    if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
      return res.statusCode = 403, res.end(JSON.stringify({ ok:false, error:"unauthorized" }));
    }

    return res.end(JSON.stringify({ ok:true, heartbeats }));
  }

  // unknown route
  res.statusCode = 404;
  return res.end(JSON.stringify({ ok:false, error:"not_found" }));
};
