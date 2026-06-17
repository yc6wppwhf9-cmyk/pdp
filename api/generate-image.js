function sendJson(res, status, data) {
  res.status(status).json(data);
}

async function readProviderJson(response) {
  const text = await response.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const { NVIDIA_API_KEY, NVIDIA_NIM_BASE_URL, NVIDIA_IMAGE_MODEL, GEMINI_API_KEY, OPENAI_API_KEY } = process.env;

  if (!NVIDIA_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) {
    sendJson(res, 500, { error: "No API key configured. Set NVIDIA_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in Vercel environment variables." });
    return;
  }

  const payload = req.body;
  const imageData = String(payload.imageData || "");
  const prompt = String(payload.prompt || "");
  const product = payload.product || {};

  if (!imageData || !prompt) {
    sendJson(res, 400, { error: "Image and prompt are required." });
    return;
  }

  const imageMatch = imageData.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!imageMatch) {
    sendJson(res, 400, { error: "Upload a PNG, JPG, or WEBP product image." });
    return;
  }

  const imageMime = imageMatch[1] === "image/jpg" ? "image/jpeg" : imageMatch[1];
  const imageBuffer = Buffer.from(imageMatch[2], "base64");

  if (NVIDIA_API_KEY) {
    if (NVIDIA_NIM_BASE_URL) {
      const nimBaseUrl = NVIDIA_NIM_BASE_URL.replace(/\/+$/, "");
      const response = await fetch(`${nimBaseUrl}/v1/infer`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: [prompt, "Create one polished ecommerce PDP marketing image.", "Preserve the uploaded product's exact shape, color, print, and branding.", "Do not invent a different product."].join(" "),
          image: imageBuffer.toString("base64"),
          seed: 0,
        }),
      });
      const { json: result, text } = await readProviderJson(response);
      if (!response.ok) {
        sendJson(res, response.status, { error: result?.error?.message || result?.detail || text.slice(0, 240) || "NVIDIA NIM generation failed." });
        return;
      }
      const b64 = result?.artifacts?.[0]?.base64;
      if (!b64) { sendJson(res, 500, { error: "NVIDIA NIM returned no image." }); return; }
      sendJson(res, 200, { imageData: `data:image/png;base64,${b64}`, provider: "nvidia-nim" });
      return;
    }

    const form = new FormData();
    form.set("model", NVIDIA_IMAGE_MODEL || "qwen-image-edit-2511");
    form.set("prompt", [prompt, "Create one polished ecommerce PDP marketing image.", "Preserve the uploaded product's exact shape, color, print, and branding.", "Do not invent a different product.", `Product: ${product.brand || ""} ${product.productName || ""}`].join(" "));
    form.set("size", "1024x1024");
    form.set("image", new Blob([imageBuffer], { type: imageMime }), `product.${imageMime.split("/")[1]}`);

    const response = await fetch("https://integrate.api.nvidia.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: form,
    });
    const { json: result, text } = await readProviderJson(response);
    if (!response.ok) {
      const unavailable = response.status === 404 && /404 page not found/i.test(text);
      sendJson(res, response.status, { error: unavailable ? "NVIDIA image editing endpoint is not available for this API key." : result?.error?.message || result?.detail || text.slice(0, 240) || "NVIDIA image generation failed." });
      return;
    }
    const b64 = result?.data?.[0]?.b64_json || result?.data?.[0]?.image?.b64_json;
    const url = result?.data?.[0]?.url;
    if (b64) { sendJson(res, 200, { imageData: `data:image/png;base64,${b64}`, provider: "nvidia" }); return; }
    if (url) { sendJson(res, 200, { imageUrl: url, provider: "nvidia" }); return; }
    sendJson(res, 500, { error: "NVIDIA returned no image." });
    return;
  }

  if (GEMINI_API_KEY) {
    const geminiPrompt = [prompt, "Create one polished ecommerce PDP marketing image.", "Preserve the uploaded product's exact shape, color, print, and branding.", "Do not invent a different product.", `Product: ${product.brand || ""} ${product.productName || ""}`].join(" ");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }, { inline_data: { mime_type: imageMime, data: imageBuffer.toString("base64") } }] }] }),
    });
    const result = await response.json();
    if (!response.ok) { sendJson(res, response.status, { error: result.error?.message || "Gemini image generation failed." }); return; }
    const parts = result.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const imagePayload = imagePart?.inlineData || imagePart?.inline_data;
    if (!imagePayload?.data) {
      const txt = parts.map((p) => p.text).filter(Boolean).join(" ");
      sendJson(res, 500, { error: txt || "Gemini returned no image." });
      return;
    }
    const mime = imagePayload.mimeType || imagePayload.mime_type || "image/png";
    sendJson(res, 200, { imageData: `data:${mime};base64,${imagePayload.data}`, provider: "gemini" });
    return;
  }

  const form = new FormData();
  form.set("model", "gpt-image-1");
  form.set("prompt", [prompt, "Create a polished ecommerce PDP marketing image.", "Preserve the uploaded product's exact shape, color, print, and branding.", `Product: ${product.brand || ""} ${product.productName || ""}`].join(" "));
  form.set("size", "1024x1024");
  form.set("quality", "low");
  form.set("output_format", "png");
  form.set("input_fidelity", "high");
  form.set("image", new Blob([imageBuffer], { type: imageMime }), `product.${imageMime.split("/")[1]}`);

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const result = await response.json();
  if (!response.ok) {
    const msg = result.error?.message || "";
    sendJson(res, response.status, { error: /incorrect api key|invalid api key/i.test(msg) ? "The OpenAI API key is invalid. Set a valid key in Vercel environment variables." : msg || "Image generation failed." });
    return;
  }
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) { sendJson(res, 500, { error: "No image returned from API." }); return; }
  sendJson(res, 200, { imageData: `data:image/png;base64,${b64}` });
}
