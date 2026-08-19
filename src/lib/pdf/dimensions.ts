/**
 * KDP trim-size and cover-math helpers. The spine/cover formulas below are
 * standard-practice approximations of Amazon KDP's published guidance —
 * they are good enough to lay out a print-ready cover and to catch obvious
 * mistakes, but KDP's own requirements can change. We never claim a
 * generated file is guaranteed to pass KDP validation; the export screen
 * always tells the user to double-check current specs before uploading.
 */

export interface TrimSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

export const KDP_TRIM_SIZES: TrimSize[] = [
  { id: "5x8", label: "5 x 8 in", widthIn: 5, heightIn: 8 },
  { id: "5.06x7.81", label: "5.06 x 7.81 in", widthIn: 5.06, heightIn: 7.81 },
  { id: "5.25x8", label: "5.25 x 8 in", widthIn: 5.25, heightIn: 8 },
  { id: "5.5x8.5", label: "5.5 x 8.5 in", widthIn: 5.5, heightIn: 8.5 },
  { id: "6x9", label: "6 x 9 in", widthIn: 6, heightIn: 9 },
  { id: "6.14x9.21", label: "6.14 x 9.21 in", widthIn: 6.14, heightIn: 9.21 },
  { id: "6.69x9.61", label: "6.69 x 9.61 in", widthIn: 6.69, heightIn: 9.61 },
  { id: "7x10", label: "7 x 10 in", widthIn: 7, heightIn: 10 },
  { id: "7.44x9.69", label: "7.44 x 9.69 in", widthIn: 7.44, heightIn: 9.69 },
  { id: "7.5x9.25", label: "7.5 x 9.25 in", widthIn: 7.5, heightIn: 9.25 },
  { id: "8x10", label: "8 x 10 in", widthIn: 8, heightIn: 10 },
  { id: "8.25x6", label: "8.25 x 6 in", widthIn: 8.25, heightIn: 6 },
  { id: "8.25x8.25", label: "8.25 x 8.25 in", widthIn: 8.25, heightIn: 8.25 },
  { id: "8.5x8.5", label: "8.5 x 8.5 in", widthIn: 8.5, heightIn: 8.5 },
  { id: "8.5x11", label: "8.5 x 11 in", widthIn: 8.5, heightIn: 11 },
];

export const BLEED_IN = 0.125;
export const SAFE_MARGIN_IN = 0.25;
export const MIN_INTERIOR_MARGIN_IN = 0.375; // KDP minimum inside (gutter) margin guidance for books under 150pp

export const MIN_PAPERBACK_PAGES = 24;
export const MAX_PAPERBACK_PAGES_BW = 828;

export type PaperType = "WHITE" | "CREAM";
export type InteriorColor = "BW" | "COLOR";

/** Inches of spine width per page, by paper/interior type (approximate). */
const SPINE_FACTOR_PER_PAGE: Record<PaperType, Record<InteriorColor, number>> = {
  WHITE: { BW: 0.002252, COLOR: 0.002347 },
  CREAM: { BW: 0.0025, COLOR: 0.002315 },
};

export function calculateSpineWidthIn(pageCount: number, paperType: PaperType, interiorColor: InteriorColor): number {
  const factor = SPINE_FACTOR_PER_PAGE[paperType][interiorColor];
  return Math.round(pageCount * factor * 10000) / 10000;
}

export interface CoverDimensionsInput {
  trimWidthIn: number;
  trimHeightIn: number;
  pageCount: number;
  paperType: PaperType;
  interiorColor: InteriorColor;
  bleed: boolean;
}

export interface CoverDimensions {
  spineWidthIn: number;
  bleedIn: number;
  /** Width of a single front/back panel (trim width, no bleed). */
  panelWidthIn: number;
  panelHeightIn: number;
  fullWidthIn: number;
  fullHeightIn: number;
}

/**
 * Full wraparound cover = back panel + spine + front panel, plus bleed on
 * all outer edges (top, bottom, left, right) — not around the spine seams.
 */
export function calculateCoverDimensions(input: CoverDimensionsInput): CoverDimensions {
  const spineWidthIn = calculateSpineWidthIn(input.pageCount, input.paperType, input.interiorColor);
  const bleedIn = input.bleed ? BLEED_IN : 0;

  const fullWidthIn = input.trimWidthIn * 2 + spineWidthIn + bleedIn * 2;
  const fullHeightIn = input.trimHeightIn + bleedIn * 2;

  return {
    spineWidthIn,
    bleedIn,
    panelWidthIn: input.trimWidthIn,
    panelHeightIn: input.trimHeightIn,
    fullWidthIn,
    fullHeightIn,
  };
}

export interface DimensionWarning {
  level: "error" | "warning";
  message: string;
}

export function validateInteriorDimensions(
  trimWidthIn: number,
  trimHeightIn: number,
  pageCount: number,
  bleed: boolean,
  interiorColor: InteriorColor = "BW"
): DimensionWarning[] {
  const issues: DimensionWarning[] = [];
  const known = KDP_TRIM_SIZES.find(
    (t) => Math.abs(t.widthIn - trimWidthIn) < 0.001 && Math.abs(t.heightIn - trimHeightIn) < 0.001
  );
  if (!known) {
    issues.push({
      level: "warning",
      message: `${trimWidthIn}" x ${trimHeightIn}" is not one of the standard KDP trim sizes. Custom sizes are allowed but double-check them against KDP's current print specifications before publishing.`,
    });
  }
  if (pageCount < MIN_PAPERBACK_PAGES) {
    issues.push({
      level: "error",
      message: `Paperback interiors need at least ${MIN_PAPERBACK_PAGES} pages (this book has ${pageCount}).`,
    });
  }
  if (interiorColor === "BW" && pageCount > MAX_PAPERBACK_PAGES_BW) {
    issues.push({
      level: "error",
      message: `Black-and-white paperback interiors max out at ${MAX_PAPERBACK_PAGES_BW} pages (this book has ${pageCount}).`,
    });
  }
  if (pageCount % 2 !== 0) {
    issues.push({ level: "error", message: `Interior page count (${pageCount}) must be even.` });
  }
  if (bleed && pageCount < MIN_PAPERBACK_PAGES) {
    issues.push({ level: "warning", message: "Bleed interiors typically also require the minimum page count." });
  }
  return issues;
}
