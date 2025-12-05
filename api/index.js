const { kv } = require("@vercel/kv");

module.exports = async (req, res) => {
    // Manual JSON parse for POST
    let body = {};

    if (req.method === "POST") {
        let data = "";
        await new Promise(resolve => {
            req.on("data", chunk => data += chunk);
            req.on("end", resolve);
        });

        try {
            body = JSON.parse(data || "{}");
        } catch {
            return res.status(400).json({ ok: false, error: "invalid_json" });
        }
    }

    const url = req.url;

    let licenses = await kv.get("licenses") || {};
    let heartbeats = await kv.get("heartbeats") || {};

    // VERIFY
    if (url.startsWith("/api/verify")) {
        const key = body.key;

        if (!key)
            return res.json({ ok: false, error: "missing_key" });

        return res.json({ ok: true, valid: Boolean(licenses[key]) });
    }

    // HEARTBEAT
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

    // 404
    res.status(404).json({ ok: false, error: "not_found" });
};
