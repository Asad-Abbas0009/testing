/**
 * JPEG of the visitor badge already drawn on the check-in screen.
 * Text and QR stay in the card. Photos are drawn from bytes the page can
 * read, so an enrolment picture served by the API does not taint the canvas.
 */

type Slot = {
  x: number;
  y: number;
  w: number;
  h: number;
  circle: boolean;
  image: HTMLImageElement | null;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read a badge image"));
    image.src = src;
  });
}

async function readableImage(img: HTMLImageElement): Promise<{ image: HTMLImageElement; revoke?: string } | null> {
  const src = img.currentSrc || img.src;
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    const image = img.complete && img.naturalWidth > 0 ? img : await loadImage(src);
    return { image };
  }
  const response = await fetch(src, { mode: "cors", credentials: "omit" });
  if (!response.ok) return null;
  const revoke = URL.createObjectURL(await response.blob());
  try {
    return { image: await loadImage(revoke), revoke };
  } catch (err) {
    URL.revokeObjectURL(revoke);
    throw err;
  }
}

function isCircle(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const radius = parseFloat(style.borderTopLeftRadius) || 0;
  const size = Math.min(el.clientWidth, el.clientHeight);
  return size > 0 && radius >= size / 2 - 1;
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

function stripRemoteUrls(el: Element): void {
  const style = el.getAttribute("style") || "";
  if (/url\((['"]?)https?:/i.test(style)) {
    el.setAttribute("style", style.replace(/url\((['"]?)https?:[^)]+\)/gi, "none"));
  }
  Array.from(el.children).forEach(stripRemoteUrls);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

export async function captureBadgeJpeg(node: HTMLElement): Promise<string> {
  const width = Math.ceil(node.offsetWidth || node.getBoundingClientRect().width);
  const height = Math.ceil(node.offsetHeight || node.getBoundingClientRect().height);
  if (width < 10 || height < 10) {
    throw new Error("Badge is not laid out yet");
  }

  const origin = node.getBoundingClientRect();
  const pictures = Array.from(node.querySelectorAll("img"));
  const loaded = await Promise.all(
    pictures.map(async (img) => {
      const box = img.getBoundingClientRect();
      const frame = img.parentElement;
      let image: HTMLImageElement | null = null;
      let revoke: string | undefined;
      try {
        const readable = await readableImage(img);
        image = readable?.image ?? null;
        revoke = readable?.revoke;
      } catch {
        image = null;
      }
      const slot: Slot = {
        x: box.left - origin.left,
        y: box.top - origin.top,
        w: box.width,
        h: box.height,
        circle: isCircle(img) || (frame ? isCircle(frame) : false),
        image,
      };
      return { slot, revoke };
    }),
  );
  const revokeUrls = loaded.flatMap((item) => (item.revoke ? [item.revoke] : []));

  try {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    copyComputedStyle(node, clone);
    clone.querySelectorAll("img").forEach((img) => img.remove());
    stripRemoteUrls(clone);
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;

    const markup = new XMLSerializer().serializeToString(clone);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject x="0" y="0" width="${width}" height="${height}">${markup}</foreignObject>` +
      `</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const card = await loadImage(url);
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not draw the badge");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(card, 0, 0, width, height);

      for (const { slot } of loaded) {
        if (!slot.image || slot.w < 1 || slot.h < 1) continue;
        ctx.save();
        if (slot.circle) {
          ctx.beginPath();
          ctx.arc(slot.x + slot.w / 2, slot.y + slot.h / 2, Math.min(slot.w, slot.h) / 2, 0, Math.PI * 2);
          ctx.clip();
        }
        drawCover(ctx, slot.image, slot.x, slot.y, slot.w, slot.h);
        ctx.restore();
      }
      return canvas.toDataURL("image/jpeg", 0.92);
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    revokeUrls.forEach((item) => URL.revokeObjectURL(item));
  }
}
