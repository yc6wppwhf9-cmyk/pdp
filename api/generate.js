/* Server-side proxy for Gemini image generation.
   The API key lives in the GEMINI_API_KEY env var on Vercel — never in the browser.
   Optional: set APP_PASSWORD to require a shared password from the app. */
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });

  const pass = process.env.APP_PASSWORD;
  if (pass && req.headers["x-app-pass"] !== pass)
    return res.status(401).json({ error: { message: "Wrong or missing app password" } });

  const key = process.env.GEMINI_API_KEY;
  if (!key)
    return res.status(500).json({ error: { message: "GEMINI_API_KEY is not configured on the server" } });

  const { model = "gemini-2.5-flash-image", prompt, images = [], size } = req.body || {};
  if (!prompt) return res.status(400).json({ error: { message: "Missing prompt" } });

  const parts = [{ text: prompt }];
  for (const im of images) parts.push({ inline_data: { mime_type: im.mime || "image/png", data: im.data } });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio: size === "1024x1536" ? "2:3" : "1:1" }
    }
  };

  const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let r = await call();
  let data = await r.json();
  /* some model versions reject imageConfig — retry without it */
  if (!r.ok && JSON.stringify(data).match(/image_config|imageConfig|aspect/i)) {
    delete body.generationConfig.imageConfig;
    r = await call();
    data = await r.json();
  }
  res.status(r.status).json(data);
};
