import { kv } from "@vercel/kv";

export default async function handler(req, res) {
    const url = req.url;

    // Ensure KV exists
    let licenses = await kv.get("licenses");
    let heartbeats = await kv.get("heartbeats");

    if (!licenses) {
        await kv.set("licenses", {});
        licenses = {};
    }

    if (!heartbeats) {
        await kv.set("heartbeats", {});
        heartbeats = {};
    }

    /* ----------------------- VERIFY KEY ----------------------- */
    if (url.startsWith("/api/verify")) {
        const { key } = req.body;

        if (!key)
            return res.json({ ok: false, error: "missing_key" });

        const valid = !!licenses[key];

        return res.json({ ok: true, valid });
    }

    /* ----------------------- HEARTBEAT -------------------------- */
    if (url.startsWith("/api/heartbeat")) {
        const { key, user } = req.body;

        if (!key || !user)
            return res.json({ ok: false, error: "missing_fields" });

        if (!licenses[key])
            return res.json({ ok: false, error: "invalid_key" });

        // Save heartbeat
        heartbeats[user] = {
            key,
            last: Date.now()
        };

        await kv.set("heartbeats", heartbeats);

        return res.json({ ok: true, saved: true });
    }

    /* ----------------------- UNKNOWN ROUTE ----------------------- */
    return res.status(404).json({ ok: false, error: "not_found" });
}
