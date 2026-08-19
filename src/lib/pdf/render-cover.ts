import { PDFDocument, degrees, rgb } from "pdf-lib";
import { calculateCoverDimensions, type CoverDimensionsInput } from "./dimensions";
import { embedDocumentFonts } from "./fonts";
import { inToPt } from "./layout";

export interface CoverRenderInput {
  title: string;
  subtitle?: string;
  author: string;
  backCoverText?: string;
  colors: string[]; // hex colors, [0] = primary background
  dimensions: CoverDimensionsInput;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

/**
 * Renders a single-page wraparound cover PDF (back | spine | front) sized
 * exactly to the calculated full-cover dimensions. No barcode/ISBN box is
 * drawn unless the caller explicitly supplies one — KDP adds the barcode
 * automatically during their cover review, and we should not fabricate one.
 */
export async function renderCoverPdf(input: CoverRenderInput): Promise<Uint8Array> {
  const dims = calculateCoverDimensions(input.dimensions);
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.title} — Cover`);

  const widthPt = inToPt(dims.fullWidthIn);
  const heightPt = inToPt(dims.fullHeightIn);
  const page = doc.addPage([widthPt, heightPt]);

  const bg = hexToRgb(input.colors[0] ?? "#1E3A8A");
  const accent = hexToRgb(input.colors[1] ?? "#F59E0B");
  const white = rgb(1, 1, 1);

  page.drawRectangle({ x: 0, y: 0, width: widthPt, height: heightPt, color: bg });

  const bleedPt = inToPt(dims.bleedIn);
  const backPanelWidthPt = inToPt(dims.panelWidthIn);
  const spineWidthPt = inToPt(dims.spineWidthIn);
  const frontPanelXPt = bleedPt + backPanelWidthPt + spineWidthPt;

  // Spine background band + divider lines so front/back/spine are visually distinguishable.
  page.drawRectangle({ x: bleedPt + backPanelWidthPt, y: 0, width: spineWidthPt, height: heightPt, color: accent });
  page.drawLine({ start: { x: bleedPt + backPanelWidthPt, y: 0 }, end: { x: bleedPt + backPanelWidthPt, y: heightPt }, thickness: 0.5, color: white });
  page.drawLine({ start: { x: frontPanelXPt, y: 0 }, end: { x: frontPanelXPt, y: heightPt }, thickness: 0.5, color: white });

  const { regular, bold } = await embedDocumentFonts(doc);

  // Front cover: title, subtitle, author, centered on the front panel.
  const frontCenterX = frontPanelXPt + inToPt(dims.panelWidthIn) / 2;
  drawCenteredWrapped(page, input.title, bold, 32, frontCenterX, heightPt * 0.62, inToPt(dims.panelWidthIn) - inToPt(0.5), white);
  if (input.subtitle) {
    drawCenteredWrapped(page, input.subtitle, regular, 15, frontCenterX, heightPt * 0.5, inToPt(dims.panelWidthIn) - inToPt(0.7), white);
  }
  drawCenteredWrapped(page, input.author, bold, 16, frontCenterX, heightPt * 0.12, inToPt(dims.panelWidthIn) - inToPt(0.5), white);

  // Back cover blurb.
  if (input.backCoverText) {
    drawCenteredWrapped(page, input.backCoverText, regular, 11, bleedPt + backPanelWidthPt / 2, heightPt * 0.55, backPanelWidthPt - inToPt(0.8), white);
  }

  // Spine title (rotated to read top-to-bottom), only if there's room.
  if (spineWidthPt > inToPt(0.15)) {
    const spineFontSize = Math.min(14, spineWidthPt * 0.6);
    page.drawText(input.title, {
      x: bleedPt + backPanelWidthPt + spineWidthPt / 2 + spineFontSize / 2.8,
      y: heightPt / 2 - bold.widthOfTextAtSize(input.title, spineFontSize) / 2,
      size: spineFontSize,
      font: bold,
      color: white,
      rotate: degrees(90),
    });
  }

  return doc.save();
}

function drawCenteredWrapped(
  page: import("pdf-lib").PDFPage,
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  centerX: number,
  centerY: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = size * 1.3;
  const totalHeight = lines.length * lineHeight;
  let y = centerY + totalHeight / 2 - lineHeight;
  for (const l of lines) {
    const w = font.widthOfTextAtSize(l, size);
    page.drawText(l, { x: centerX - w / 2, y, size, font, color });
    y -= lineHeight;
  }
}
