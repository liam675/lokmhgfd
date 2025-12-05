import { kv } from "@vercel/kv";

export default async function handler(req, res) {
    let body = {};

    try {
        // Parse JSON body safely
        if (req.method === "POST") {
            const raw = await new Promise((resolve) => {
                let data = "";
                req.on("data", chunk => data += chunk);
                req.on("end", () => resolve(data));
            });

            body = raw ? JSON.parse(raw) : {};
        }
    } catch (err) {
        return res.status(400).json({ ok: false, error: "invalid_json" });
    }

    const url = req.url;

    // Load KV
    let licenses = await kv.get("licenses") || {};
    let heartbeats = await kv.get("heartbeats") || {};

    /* ---------------- VERIFY ---------------- */
    if (url.startsWith("/api/verify")) {
        const key = body.key;

        if (!key)
            return res.json({ ok: false, error: "missing_key" });

        return res.json({
            ok: true,
            valid: Boolean(licenses[key])
        });
    }

    /* --------------- HEARTBEAT --------------- */
    if (url.startsWith("/api/heartbeat")) {
        const key = body.key;
        const user = body.user;

        if (!key || !user)
            return res.json({ ok: false, error: "missing_fields" });

        if (!licenses[key])
            return res.json({ ok: false, error: "invalid_key" });

        heartbeats[user] = {
            key,
            last: Date.now()
        };

        await kv.set("heartbeats", heartbeats);

        return res.json({ ok: true, saved: true });
    }

    /* --------------- UNKNOWN ---------------- */
    return res.status(404).json({ ok: false, error: "not_found" });
}
