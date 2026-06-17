const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const workspace = path.resolve(root, "..");
const envPath = path.join(workspace, ".env.local");

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.+?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readProviderJson(response) {
  const text = await response.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function generateImage(req, res) {
  if (!process.env.NVIDIA_API_KEY && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    sendJson(res, 500, { error: "NVIDIA_API_KEY is not configured." });
    return;
  }

  const payload = JSON.parse(await readBody(req));
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

  if (process.env.NVIDIA_API_KEY) {
    if (process.env.NVIDIA_NIM_BASE_URL) {
      const nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL.replace(/\/+$/, "");
      const response = await fetch(`${nimBaseUrl}/v1/infer`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: [
            prompt,
            "Create one polished ecommerce PDP marketing image.",
            "Preserve the uploaded product's exact shape, color, print, and branding as much as possible.",
            "Use marketplace-ready lighting, clean composition, and readable English callouts.",
            "Do not invent a different product.",
          ].join(" "),
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
      if (!b64) {
        sendJson(res, 500, { error: "NVIDIA NIM returned no image." });
        return;
      }

      sendJson(res, 200, { imageData: `data:image/png;base64,${b64}`, provider: "nvidia-nim" });
      return;
    }

    const form = new FormData();
    form.set("model", process.env.NVIDIA_IMAGE_MODEL || "qwen-image-edit-2511");
    form.set(
      "prompt",
      [
        prompt,
        "Create one polished ecommerce PDP marketing image.",
        "Preserve the uploaded product's exact shape, color, print, and branding as much as possible.",
        "Use marketplace-ready lighting, clean composition, and readable English callouts.",
        "Do not invent a different product.",
        `Product: ${product.brand || ""} ${product.productName || ""}`,
      ].join(" "),
    );
    form.set("size", "1024x1024");
    form.set("image", new Blob([imageBuffer], { type: imageMime }), `product.${imageMime.split("/")[1]}`);

    const response = await fetch("https://integrate.api.nvidia.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: form,
    });

    const { json: result, text } = await readProviderJson(response);
    if (!response.ok) {
      const unavailable = response.status === 404 && /404 page not found/i.test(text);
      sendJson(res, response.status, {
        error: unavailable
          ? "NVIDIA image editing endpoint is not available for this API key/account. Enable a hosted Visual GenAI image model in NVIDIA Build, or use a different image provider key."
          : result?.error?.message || result?.detail || text.slice(0, 240) || "NVIDIA image generation failed.",
      });
      return;
    }

    if (!result) {
      sendJson(res, 502, { error: `NVIDIA returned non-JSON response: ${text.slice(0, 240)}` });
      return;
    }

    const b64 = result.data?.[0]?.b64_json || result.data?.[0]?.image?.b64_json;
    const url = result.data?.[0]?.url;
    if (b64) {
      sendJson(res, 200, { imageData: `data:image/png;base64,${b64}`, provider: "nvidia" });
      return;
    }
    if (url) {
      sendJson(res, 200, { imageUrl: url, provider: "nvidia" });
      return;
    }

    sendJson(res, 500, { error: "NVIDIA returned no image." });
    return;
  }

  if (process.env.GEMINI_API_KEY) {
    const geminiPrompt = [
      prompt,
      "Create one polished ecommerce PDP marketing image.",
      "Preserve the uploaded product's exact shape, color, print, and branding as much as possible.",
      "Use clear composition, marketplace-ready lighting, and readable English callouts.",
      "Do not invent a different product.",
      `Product: ${product.brand || ""} ${product.productName || ""}`,
    ].join(" ");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: geminiPrompt },
                {
                  inline_data: {
                    mime_type: imageMime,
                    data: imageBuffer.toString("base64"),
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      const providerMessage = result.error?.message || "Nano Banana image generation failed.";
      sendJson(res, response.status, { error: providerMessage });
      return;
    }

    const parts = result.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
    const imagePayload = imagePart?.inlineData || imagePart?.inline_data;
    if (!imagePayload?.data) {
      const text = parts.map((part) => part.text).filter(Boolean).join(" ");
      sendJson(res, 500, { error: text || "Nano Banana returned no image." });
      return;
    }

    const mime = imagePayload.mimeType || imagePayload.mime_type || "image/png";
    sendJson(res, 200, { imageData: `data:${mime};base64,${imagePayload.data}`, provider: "gemini" });
    return;
  }

  const form = new FormData();
  form.set("model", "gpt-image-1");
  form.set(
    "prompt",
    [
      prompt,
      "Create a polished ecommerce PDP marketing image.",
      "Preserve the uploaded product's exact shape, color, print, and branding as much as possible.",
      "Use clear composition with readable English callouts.",
      `Product: ${product.brand || ""} ${product.productName || ""}`,
    ].join(" "),
  );
  form.set("size", "1024x1024");
  form.set("quality", "low");
  form.set("output_format", "png");
  form.set("input_fidelity", "high");
  form.set("image", new Blob([imageBuffer], { type: imageMime }), `product.${imageMime.split("/")[1]}`);

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  const result = await response.json();
  if (!response.ok) {
    const providerMessage = result.error?.message || "";
    const safeMessage = /incorrect api key|invalid api key/i.test(providerMessage)
      ? "The saved OpenAI API key is invalid. Add a valid key to .env.local and restart the app."
      : providerMessage || "Image generation failed.";
    sendJson(res, response.status, { error: safeMessage });
    return;
  }

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    sendJson(res, 500, { error: "No image returned from API." });
    return;
  }

  sendJson(res, 200, { imageData: `data:image/png;base64,${b64}` });
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/generate-image") {
    generateImage(req, res).catch((error) => {
      sendJson(res, 500, { error: error.message || "Unexpected server error." });
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(5173, () => {
  console.log("PDP AI Studio running at http://localhost:5173");
});
