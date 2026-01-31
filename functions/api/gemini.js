export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const key = env.GEMINI_API_KEY;
    if (!key) {
      return json({ error: "Missing GEMINI_API_KEY (set it in Cloudflare Pages env vars as a secret)." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const prompt = (body.prompt || "").trim();
    const system = (body.system || "").trim();
    const model = (body.model || env.GEMINI_MODEL || "gemini-2.0-flash").trim();

    if (!prompt) return json({ error: "Missing prompt" }, 400);

    // Gemini REST endpoint (Generative Language API)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            ...(system ? [{ text: `SYSTEM:\n${system}\n\n` }] : []),
            { text: prompt }
          ]
        }
      ]
    };

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error?.message || `${upstream.status} ${upstream.statusText}`;
      return json({ error: msg }, upstream.status);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ||
      "";

    return json({ text });
  } catch (err) {
    return json({ error: err?.message || "Unknown error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
