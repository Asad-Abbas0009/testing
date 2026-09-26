/**
 * JPEG of the visitor badge already drawn on the check-in screen.
 * Uses the rendered card (styles, photo, QR). No extra package.
 */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function copyComputedStyle(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);
  let css = "";
  for (let i = 0; i < computed.length; i += 1) {
    const prop = computed.item(i);
    css += `${prop}:${computed.getPropertyValue(prop)};`;
  }
  target.setAttribute("style", css);
  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    const next = targetChildren[index];
    if (next) copyComputedStyle(child, next);
  });
}

async function inlineImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        img.setAttribute("src", await blobToDataUrl(await response.blob()));
      } catch {
        // Keep the original address. The rest of the badge still captures.
      }
    })
  );
}

export async function captureBadgeJpeg(node: HTMLElement): Promise<string> {
  const width = Math.ceil(node.offsetWidth || node.getBoundingClientRect().width);
  const height = Math.ceil(node.offsetHeight || node.getBoundingClientRect().height);
  if (width < 10 || height < 10) {
    throw new Error("Badge is not laid out yet");
  }

  const clone = node.cloneNode(true) as HTMLElement;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  copyComputedStyle(node, clone);
  await inlineImages(clone);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const markup = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">${markup}</foreignObject>` +
    `</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw the badge");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}
