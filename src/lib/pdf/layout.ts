export const PT_PER_IN = 72;

export function inToPt(inches: number): number {
  return inches * PT_PER_IN;
}

export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageLayoutConfig {
  trimWidthIn: number;
  trimHeightIn: number;
  outerMarginIn: number;
  gutterMarginIn: number;
  footerHeightIn: number;
}

export const DEFAULT_LAYOUT: Pick<PageLayoutConfig, "outerMarginIn" | "gutterMarginIn" | "footerHeightIn"> = {
  outerMarginIn: 0.5,
  gutterMarginIn: 0.75,
  footerHeightIn: 0.35,
};

/**
 * Content box in points, inset from the trim edges by the configured
 * margins, with room reserved at the bottom for the page-number footer.
 * `isLeftPage` swaps which side gets the wider gutter margin (binding side
 * alternates on left/right pages in a printed book).
 */
export function getContentBox(config: PageLayoutConfig, isLeftPage: boolean): PageBox {
  const widthPt = inToPt(config.trimWidthIn);
  const heightPt = inToPt(config.trimHeightIn);
  const outer = inToPt(config.outerMarginIn);
  const gutter = inToPt(config.gutterMarginIn);
  const footer = inToPt(config.footerHeightIn);

  const left = isLeftPage ? outer : gutter;
  const right = isLeftPage ? gutter : outer;

  return {
    x: left,
    y: footer,
    width: widthPt - left - right,
    height: heightPt - footer - outer,
  };
}
