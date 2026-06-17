const creativeTypes = [
  {
    id: "white-bg",
    title: "White Background",
    headline: "Clean Front Angle",
    mode: "clean",
    check: "Front-angle product image on a clean white background.",
  },
  {
    id: "hero",
    title: "AI Hero Shot",
    headline: "Larger Than Life",
    mode: "dark",
    check: "Hero creative includes product, brand logo, and high-impact scene.",
  },
  {
    id: "lifestyle",
    title: "AI Lifestyle",
    headline: "Designed For The Right User",
    mode: "soft",
    check: "Lifestyle scene matches selected age group, model, and location.",
  },
  {
    id: "comfort",
    title: "Comfort That Carries Well",
    headline: "Comfort Details",
    mode: "soft",
    check: "Comfort features such as straps, handle, back panel, and load points are called out.",
  },
  {
    id: "space",
    title: "Space Story",
    headline: "Every Pocket Has A Purpose",
    mode: "soft",
    check: "Main compartment, front pocket, side pocket, organizer, and laptop area are explained.",
  },
  {
    id: "everything",
    title: "Everything You Need In A Bag",
    headline: "Built For Everyday Carry",
    mode: "soft",
    check: "Additional features and accessories are shown clearly.",
  },
  {
    id: "dimensions",
    title: "Dimensions & Capacity",
    headline: "Size Made Clear",
    mode: "clean",
    check: "Dimensions in inches/cm and capacity in liters are visible.",
  },
  {
    id: "what-fits",
    title: "What Fits In?",
    headline: "For All Your Essentials",
    mode: "clean",
    check: "Flat-lay composition shows items that fit inside the bag.",
  },
];

const state = {
  imageData: "",
  generated: false,
  generatedFiles: new Map(),
  aiBlocked: "",
};

const els = {
  file: document.getElementById("productImage"),
  preview: document.getElementById("previewImage"),
  emptyPreview: document.getElementById("emptyPreview"),
  form: document.getElementById("productForm"),
  grid: document.getElementById("creativeGrid"),
  qcList: document.getElementById("qcList"),
  qcScore: document.getElementById("qcScore"),
  badge: document.getElementById("completionBadge"),
  exportBtn: document.getElementById("exportBtn"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),
  exportPptxBtn: document.getElementById("exportPptxBtn"),
  exportDocxBtn: document.getElementById("exportDocxBtn"),
  aiGenerateBtn: document.getElementById("aiGenerateBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

function calcCapacityFromDimensions(dimensionsStr) {
  const inMatch = dimensionsStr.match(/([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)\s*in/i);
  if (inMatch) {
    const liters = parseFloat(inMatch[1]) * parseFloat(inMatch[2]) * parseFloat(inMatch[3]) * 0.01639;
    return `~${Math.round(liters)} L`;
  }
  const cmMatch = dimensionsStr.match(/([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)\s*cm/i);
  if (cmMatch) {
    const liters = parseFloat(cmMatch[1]) * parseFloat(cmMatch[2]) * parseFloat(cmMatch[3]) * 0.001;
    return `~${Math.round(liters)} L`;
  }
  return "";
}

function getProduct() {
  const dimensions = document.getElementById("dimensions").value.trim();
  const capacityInput = document.getElementById("capacity").value.trim();
  return {
    brand: document.getElementById("brand").value.trim(),
    productName: document.getElementById("productName").value.trim(),
    audience: document.getElementById("audience").value,
    capacity: capacityInput || calcCapacityFromDimensions(dimensions),
    dimensions,
    theme: document.getElementById("theme").value.trim(),
    features: document
      .getElementById("features")
      .value.split(",")
      .map((feature) => feature.trim())
      .filter(Boolean),
  };
}

function pickFeatures(product, count = 4) {
  return product.features.slice(0, count);
}

function buildPrompt(type, product) {
  const featureText = product.features.join(", ");
  const base = `${product.brand} ${product.productName}`;

  const prompts = {
    "white-bg": `Create a clean ecommerce product image of the ${base} on a pure white background. The bag must face directly forward — strict front-facing angle, no tilt or 3/4 rotation. Centre the product with even padding on all sides. No shadows, gradients, props, or text overlays. Photorealistic, identical to the uploaded reference image. Suitable for Amazon/Flipkart main image slot.`,

    "hero": `Create a cinematic larger-than-life hero shot of the ${base} for a premium ecommerce PDP. Dark atmospheric background (${product.theme}). Product is the focal point at a powerful 3/4 upward angle with dramatic lighting and bold shadow play. Brand name "${product.brand}" prominently visible. Add aspirational environmental elements — light rays, depth, energy. Highlight 2–3 key features: ${product.features.slice(0, 3).join(", ")}. High contrast, billboard quality, photorealistic.`,

    "lifestyle": `Create a lifestyle scene featuring the ${base} being used naturally by a ${product.audience}. Location and setting should feel authentic and aspirational. The bag is the hero of the scene — clearly visible, not obscured. Natural light, real environment, no studio feel. Theme: ${product.theme}.`,

    "comfort": `Create a close-up detail PDP image of the ${base} highlighting its comfort features: ${featureText}. Show strap padding, breathable back panel, cushion handle, and load points with clear callout labels. Soft background (${product.theme}). Premium product photography style.`,

    "space": `Create a space-story PDP image for the ${base} showing all compartments and pockets with labelled callouts: main compartment, front pocket, side pocket, organiser, and padded laptop sleeve. Capacity: ${product.capacity}. Dimensions: ${product.dimensions}. Clean infographic style with soft background (${product.theme}).`,

    "everything": `Create a features overview PDP image for the ${base} showcasing every included accessory and extra feature: ${featureText}. Show charging port, raincover, charms, and any additional accessories. Soft background (${product.theme}). Clean callout labels, premium ecommerce style.`,

    "dimensions": `Create a dimensions PDP image for the ${base} with measurement annotations clearly showing ${product.dimensions} and capacity ${product.capacity}. Use clean white or light background, dimension lines in brand colour, and both inch and cm values visible. Photorealistic product, no distortion.`,

    "what-fits": `Create a flat-lay PDP image showing what fits inside the ${base} (capacity ${product.capacity}): a laptop, water bottle, books, wallet, charger, and small pouch arranged neatly around or beside the open bag. Clean white background, top-down or slight angle, styled like a premium Amazon listing.`,
  };

  return prompts[type.id] || `Create a marketplace PDP image for ${base}. Image type: ${type.title}. Theme: ${product.theme}. Audience: ${product.audience}. Features: ${featureText}. Keep the product consistent with the uploaded reference image, premium ecommerce composition, no misleading product changes.`;
}

function renderCreative(type, product) {
  return `
    <article class="creative-card" data-id="${type.id}">
      <div class="creative-visual">
        <canvas class="generated-canvas" width="1200" height="900" data-canvas-id="${type.id}"></canvas>
      </div>
      <div class="creative-body">
        <h3>${type.title}</h3>
        <p>${type.check}</p>
        <div class="prompt-box">${buildPrompt(type, product)}</div>
        <div class="ai-status" data-ai-status="${type.id}"></div>
        <div class="card-actions">
          <button class="download-btn" type="button" data-download-id="${type.id}">Download PNG</button>
        </div>
      </div>
    </article>
  `;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines) return y;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawPill(ctx, text, x, y, fill = "rgba(255,255,255,.9)", ink = "#1b1d24") {
  ctx.font = "700 26px Arial";
  const width = Math.min(ctx.measureText(text).width + 40, 420);
  roundedRect(ctx, x, y, width, 48, 24);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(text, x + 20, y + 32);
}

function drawProduct(ctx, image, x, y, maxW, maxH) {
  if (!image) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "700 34px Arial";
    ctx.fillText("Upload image", x + 50, y + maxH / 2);
    return;
  }
  const ratio = Math.min(maxW / image.width, maxH / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  ctx.drawImage(image, x + (maxW - width) / 2, y + (maxH - height) / 2, width, height);
}

function drawCanvas(type, product, canvas, image) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const features = pickFeatures(product, 5);

  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  if (type.mode === "dark") {
    gradient.addColorStop(0, "#161d2a");
    gradient.addColorStop(1, "#3a4961");
  } else if (type.mode === "clean") {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#f2f5f8");
  } else {
    gradient.addColorStop(0, "#f6eafe");
    gradient.addColorStop(1, "#dff5ee");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = type.mode === "dark" ? "rgba(255,255,255,.08)" : "rgba(31,122,109,.08)";
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.arc(80 + i * 145, 100 + (i % 3) * 105, 36 + (i % 2) * 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = type.mode === "dark" ? "#ffffff" : "#145a51";
  ctx.font = "800 34px Arial";
  ctx.fillText((product.brand || "Brand").toUpperCase(), 70, 78);

  ctx.fillStyle = type.mode === "dark" ? "#ffffff" : "#1b1d24";
  ctx.font = "800 62px Arial";
  wrapText(ctx, type.headline, 70, 168, 520, 68, 2);

  ctx.font = "400 30px Arial";
  ctx.fillStyle = type.mode === "dark" ? "#e5edf5" : "#4b5563";
  const subline = type.id === "dimensions" ? `${product.dimensions} | ${product.capacity}` : product.audience;
  wrapText(ctx, subline, 74, 300, 520, 38, 2);

  const productX = type.id === "white-bg" || type.id === "what-fits" ? 390 : 570;
  const productY = type.id === "hero" ? 220 : 240;
  drawProduct(ctx, image, productX, productY, 500, 540);

  if (type.id === "dimensions") {
    ctx.strokeStyle = "#1f7a6d";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(600, 790);
    ctx.lineTo(930, 790);
    ctx.moveTo(965, 300);
    ctx.lineTo(965, 720);
    ctx.stroke();
    drawPill(ctx, product.capacity || "Capacity", 760, 705, "#1f7a6d", "#fff");
  } else if (type.id === "what-fits") {
    const items = ["Laptop", "Bottle", "Books", "Wallet", "Charger", "Pouch"];
    items.forEach((item, index) => {
      const x = 70 + (index % 2) * 210;
      const y = 410 + Math.floor(index / 2) * 95;
      drawPill(ctx, item, x, y);
    });
  } else {
    features.forEach((feature, index) => {
      const x = index % 2 === 0 ? 70 : 760;
      const y = 410 + Math.floor(index / 2) * 92;
      drawPill(ctx, feature, x, y);
    });
  }

  ctx.fillStyle = type.mode === "dark" ? "#d8f3ec" : "#145a51";
  ctx.font = "800 38px Arial";
  ctx.fillText(type.title, 70, 840);

  state.generatedFiles.set(type.id, canvas.toDataURL("image/png"));
}

function renderGeneratedImages(product) {
  const load = state.imageData
    ? new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.src = state.imageData;
      })
    : Promise.resolve(null);

  load.then((image) => {
    creativeTypes.forEach((type) => {
      const canvas = document.querySelector(`[data-canvas-id="${type.id}"]`);
      if (canvas) drawCanvas(type, product, canvas, image);
    });
  });
}

function renderQc(product) {
  const complete = state.generated && state.imageData && product.brand && product.capacity && product.dimensions && !state.aiBlocked;
  const score = complete ? creativeTypes.length : 0;
  els.qcScore.textContent = `${score}/${creativeTypes.length}`;
  els.badge.textContent = state.aiBlocked ? "AI Blocked" : complete ? "QC Ready" : state.generated ? "Needs Details" : "Ready";

  els.qcList.innerHTML = creativeTypes
    .map(
      (type) => `
        <div class="qc-item">
          <span class="qc-dot">${complete ? "✓" : "!"}</span>
          <div>
            <strong>${type.title}</strong>
            <small>${state.aiBlocked || type.check}</small>
          </div>
        </div>
      `,
    )
    .join("");
}

function generate() {
  const product = getProduct();
  state.generated = true;
  state.aiBlocked = "";
  state.generatedFiles.clear();
  els.grid.innerHTML = creativeTypes.map((type) => renderCreative(type, product)).join("");
  renderGeneratedImages(product);
  renderQc(product);
}

function exportProject() {
  const product = getProduct();
  const payload = {
    product,
    generatedAt: new Date().toISOString(),
    creatives: creativeTypes.map((type) => ({
      id: type.id,
      title: type.title,
      qcCheck: type.check,
      prompt: buildPrompt(type, product),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${product.productName || "pdp-project"}.json`.replace(/[^\w.-]+/g, "-");
  link.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function downloadCreative(id) {
  const product = getProduct();
  const dataUrl = state.generatedFiles.get(id);
  if (!dataUrl) return;
  downloadDataUrl(dataUrl, `${product.productName || "pdp"}-${id}.png`.replace(/[^\w.-]+/g, "-"));
}

function downloadAll() {
  if (!state.generatedFiles.size) generate();
  const product = getProduct();
  creativeTypes.forEach((type, index) => {
    const dataUrl = state.generatedFiles.get(type.id);
    if (!dataUrl) return;
    window.setTimeout(() => {
      downloadDataUrl(dataUrl, `${String(index + 1).padStart(2, "0")}-${product.productName || "pdp"}-${type.id}.png`.replace(/[^\w.-]+/g, "-"));
    }, index * 180);
  });
}

async function exportPptx() {
  if (!state.generatedFiles.size) {
    alert("Generate the PDP set first, then export.");
    return;
  }
  const product = getProduct();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in, matching the reference file

  const img = (id) => state.generatedFiles.get(id);

  // Slides 1–3: two images side-by-side, positions extracted from reference PPTX (EMU → inches)
  const pairs = [
    {
      ids: ["white-bg", "hero"],
      pos: [{ x: 0.62, y: 0.34, w: 5.43, h: 6.81 }, { x: 6.26, y: 0.34, w: 5.43, h: 6.81 }],
    },
    {
      ids: ["lifestyle", "comfort"],
      pos: [{ x: 0.79, y: 0.29, w: 5.52, h: 6.91 }, { x: 6.51, y: 0.0, w: 5.6, h: 7.5 }],
    },
    {
      ids: ["space", "everything"],
      pos: [{ x: 0.76, y: 0.0, w: 5.6, h: 7.5 }, { x: 7.24, y: 0.35, w: 5.08, h: 6.79 }],
    },
  ];
  for (const { ids, pos } of pairs) {
    const slide = pptx.addSlide();
    ids.forEach((id, i) => {
      const d = img(id);
      if (d) slide.addImage({ data: d, ...pos[i] });
    });
  }

  // Slide 4: 4-column × 2-row thumbnail grid, matching the reference PPTX
  const slide4 = pptx.addSlide();
  const xs = [0.34, 3.42, 6.5, 9.58];
  const ys = [0.36, 3.85];
  creativeTypes.forEach(({ id }, i) => {
    const d = img(id);
    if (d) slide4.addImage({ data: d, x: xs[i % 4], y: ys[Math.floor(i / 4)], w: 2.74, h: 2.74 });
  });

  const slug = (product.productName || "PDP").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  await pptx.writeFile({ fileName: `${slug}-PDP-Reference.pptx` });
}

async function exportDocx() {
  if (!window.docx) {
    alert("DOCX library is still loading. Please try again in a moment.");
    return;
  }
  const D = window.docx;
  const product = getProduct();

  const hCell = (text) =>
    new D.TableCell({
      children: [new D.Paragraph({ children: [new D.TextRun({ text, bold: true, color: "FFFFFF" })] })],
      shading: { fill: "1F7A6D" },
    });

  const dCell = (text) =>
    new D.TableCell({
      children: [new D.Paragraph({ children: [new D.TextRun(text)] })],
    });

  const checkMap = {
    "white-bg": "Front-angle product image on a clean white background.",
    "hero": "Larger than Life image. Brand logo visible in composition.",
    "lifestyle": "Age group, male/female model, and background location correct.",
    "comfort": "Shoulder straps, cushion handle, breathable back panel, and load points highlighted.",
    "space": "Main compartment, front pocket, side pocket, organiser, and laptop area labelled.",
    "everything": "Charging port, charms, raincover, and additional features shown.",
    "dimensions": `Dimensions (${product.dimensions}) and capacity (${product.capacity}) clearly visible.`,
    "what-fits": "Flat-lay composition showing items that fit: Laptop, Bottle, Books, Wallet, Charger.",
  };

  const qcRows = [
    new D.TableRow({
      children: [hCell("Image #"), hCell("Description"), hCell("Check Points / Should Include")],
      tableHeader: true,
    }),
    ...creativeTypes.map((type, i) =>
      new D.TableRow({
        children: [dCell(String(i + 1)), dCell(type.title), dCell(checkMap[type.id] || type.check)],
      }),
    ),
  ];

  const sectionHeading = (text) =>
    new D.Paragraph({
      children: [new D.TextRun({ text, bold: true, size: 28, color: "1F7A6D" })],
      spacing: { before: 400, after: 120 },
    });

  const bullet = (text) =>
    new D.Paragraph({
      children: [new D.TextRun(`•  ${text}`)],
      spacing: { before: 60 },
    });

  const doc = new D.Document({
    sections: [
      {
        children: [
          new D.Paragraph({
            children: [new D.TextRun({ text: "Mandatory QC Checklist", bold: true, size: 40 })],
            spacing: { after: 80 },
          }),
          new D.Paragraph({
            children: [
              new D.TextRun({
                text: `${product.brand}  ${product.productName}   |   ${product.capacity}   |   ${product.dimensions}`,
                size: 20,
                color: "555555",
              }),
            ],
            spacing: { after: 280 },
          }),
          new D.Table({
            width: { size: 100, type: D.WidthType.PERCENTAGE },
            rows: qcRows,
          }),
          sectionHeading("COMFORT FEATURES"),
          ...[
            "Adjustable Shoulder Straps",
            "Bartacked Stitch on Load Points",
            "Premium Quality Zippers",
            "Breathable Back Panel",
            "Super Soft Cushion Handle",
            "Bottom Rib Pad",
            "Wide Padded Shoulder Straps",
            "Fabric Details (Vegan / Premium / Durable)",
          ].map(bullet),
          sectionHeading("SPACE STORY"),
          ...[
            "Main Compartment",
            "Front Pocket",
            "Bottle Pocket",
            "(I/A) Side Zip Pocket",
            "Easy Organiser / Premium Organiser",
            "Tech Compartment – Padded Laptop Sleeve, Document Sleeve",
            `Dimension in Inches: ${product.dimensions}`,
            `Capacity in Liters: ${product.capacity}`,
            "(I/F) Raincover",
          ].map(bullet),
        ],
      },
    ],
  });

  const blob = await D.Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(product.productName || "PDP").replace(/[^\w\s-]/g, "").trim()}-QC-Checklist.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function generateAiImages() {
  if (!state.imageData) {
    alert("Upload a product image first.");
    return;
  }
  if (!state.generated) generate();

  const product = getProduct();
  state.aiBlocked = "";
  renderQc(product);
  els.aiGenerateBtn.disabled = true;
  els.aiGenerateBtn.textContent = "Generating...";

  for (const type of creativeTypes) {
    const status = document.querySelector(`[data-ai-status="${type.id}"]`);
    const canvas = document.querySelector(`[data-canvas-id="${type.id}"]`);
    if (status) status.textContent = "Generating with NVIDIA...";

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: state.imageData,
          prompt: buildPrompt(type, product),
          product,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI generation failed");

      const finalImageData = result.imageData || result.imageUrl;
      if (!finalImageData) throw new Error("No generated image returned.");
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = finalImageData;
      });

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      state.generatedFiles.set(type.id, canvas.toDataURL("image/png"));
      if (status) status.textContent = `${result.provider || "AI"} image generated.`;
    } catch (error) {
      const message = error.message || "AI generation failed.";
      state.aiBlocked = message;
      renderQc(product);
      if (status) status.textContent = message;
      break;
    }
  }

  els.aiGenerateBtn.disabled = false;
  els.aiGenerateBtn.textContent = "Generate With NVIDIA";
}

els.file.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.imageData = reader.result;
    els.preview.src = state.imageData;
    els.preview.style.display = "block";
    els.emptyPreview.style.display = "none";
    if (state.generated) generate();
  };
  reader.readAsDataURL(file);
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate();
});

els.exportBtn.addEventListener("click", exportProject);
els.downloadAllBtn.addEventListener("click", downloadAll);
els.exportPptxBtn.addEventListener("click", () => exportPptx().catch((e) => alert(e.message || "PPTX export failed.")));
els.exportDocxBtn.addEventListener("click", () => exportDocx().catch((e) => alert(e.message || "DOCX export failed.")));
els.aiGenerateBtn.addEventListener("click", generateAiImages);

els.grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-download-id]");
  if (!button) return;
  downloadCreative(button.dataset.downloadId);
});

els.resetBtn.addEventListener("click", () => {
  state.imageData = "";
  state.generated = false;
  state.aiBlocked = "";
  state.generatedFiles.clear();
  els.file.value = "";
  els.preview.removeAttribute("src");
  els.preview.style.display = "none";
  els.emptyPreview.style.display = "block";
  els.grid.innerHTML = "";
  renderQc(getProduct());
  els.badge.textContent = "Ready";
});

renderQc(getProduct());
