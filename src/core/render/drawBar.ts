export type Ctx2D =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function roundedRectPath(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** Draw `image` covering a circle of `diameter` centred at (cx, cy). */
export function drawCircularImage(
  ctx: Ctx2D,
  image: CanvasImageSource,
  cx: number,
  cy: number,
  diameter: number,
  ringColor?: string,
): void {
  const r = diameter / 2;
  const { width: iw, height: ih } = imageSize(image);
  if (!iw || !ih) return;

  // object-fit: cover
  const scale = Math.max(diameter / iw, diameter / ih);
  const dw = iw * scale;
  const dh = ih * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();

  if (ringColor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ringColor;
    ctx.stroke();
    ctx.restore();
  }
}

function imageSize(image: CanvasImageSource): {
  width: number;
  height: number;
} {
  if ("naturalWidth" in image) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  if ("videoWidth" in image) {
    return { width: image.videoWidth, height: image.videoHeight };
  }
  const w = (image as { width: number | SVGAnimatedLength }).width;
  const h = (image as { height: number | SVGAnimatedLength }).height;
  return {
    width: typeof w === "number" ? w : w.baseVal.value,
    height: typeof h === "number" ? h : h.baseVal.value,
  };
}
