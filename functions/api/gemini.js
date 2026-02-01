export const onRequestOptions = async () => {
  // Not strictly necessary for same-origin calls, but harmless and helps if a preflight ever happens.
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
};

export const onRequestPost = async (context) => {
  try {
    const { request, env } = context;

    const key = env.GEMINI_API_KEY;
    if (!key) {
      return json({ error: "Server misconfigured: GEMINI_API_KEY is missing." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const prompt = (body.prompt || "").toString();
    const system = (body.system || "").toString();
    const model = (body.model || "gemini-2.0-flash").toString(); // default model

    if (!prompt.trim()) {
      return json({ error: "Missing prompt." }, 400);
    }

    // Gemini REST endpoint: POST .../v1beta/models/<model>:generateContent?key=... :contentReference[oaicite:3]{index=3}
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    // Request supports systemInstruction + contents 
    const payload = {
      ...(system.trim()
        ? { systemInstruction: { parts: [{ text: system }] } }
        : {}),
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // Bubble up Google’s error message if present
      const msg =
        data?.error?.message ||
        data?.message ||
        `${resp.status} ${resp.statusText}`;
      return json({ error: msg, details: data }, resp.status);
    }

    // Extract text safely (Gemini can return multiple parts)
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p?.text || "").join("").trim();

    return json({ text: text || "(No text returned)", raw: data }, 200);
  } catch (err) {
    return json({ error: err?.message || "Unknown server error" }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
