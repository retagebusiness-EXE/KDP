import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument } from "pdf-lib";
import type { Fonts } from "./render-page";

/**
 * KDP's print pipeline requires embedded fonts — pdf-lib's StandardFonts
 * (Helvetica etc.) are references to the PDF base-14 set, not embedded font
 * programs, and Amazon's preflight rejects interiors/covers that rely on
 * them. DejaVu Sans (Bitstream Vera-derived, free for embedding/redistribution)
 * ships as real TTF files we can subset and embed instead.
 */
const FONT_DIR = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");

export async function embedDocumentFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(FONT_DIR, "DejaVuSans.ttf")),
    readFile(path.join(FONT_DIR, "DejaVuSans-Bold.ttf")),
  ]);
  const [regular, bold] = await Promise.all([
    doc.embedFont(regularBytes, { subset: true }),
    doc.embedFont(boldBytes, { subset: true }),
  ]);
  return { regular, bold };
}
