import { kv } from "@vercel/kv";

export default async function handler(req, res) {
    const url = req.url;

    let licenses = await kv.get("licenses");
    let heartbeats = await kv.get("heartbeats");

    if (!licenses) { await kv.set("licenses", {}); licenses = {}; }
    if (!heartbeats) { await kv.set("heartbeats", {}); heartbeats = {}; }

    // Verify
    if (url.startsWith("/api/verify")) {
        const { key } = req.body || {};

        if (!key)
            return res.json({ ok: false, error: "missing_key" });

        const valid = !!licenses[key];
        return res.json({ ok: true, valid });
    }

    // Heartbeat
    if (url.startsWith("/api/heartbeat")) {
        const { key, user } = req.body || {};

        if (!key || !user)
            return res.json({ ok: false, error: "missing_fields" });

        if (!licenses[key])
            return res.json({ ok: false, error: "invalid_key" });

        heartbeats[user] = { key, last: Date.now() };
        await kv.set("heartbeats", heartbeats);

        return res.json({ ok: true, saved: true });
    }

    return res.status(404).json({ ok: false, error: "not_found" });
}
