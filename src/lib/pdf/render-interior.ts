import { PDFDocument } from "pdf-lib";
import { embedDocumentFonts } from "./fonts";
import { DEFAULT_LAYOUT, getContentBox, inToPt, type PageLayoutConfig } from "./layout";
import {
  drawAnswerKeyPage,
  drawBlankPage,
  drawColoringPage,
  drawCrosswordPage,
  drawFooter,
  drawJournalPage,
  drawLogBookPage,
  drawMazePage,
  drawNotebookPage,
  drawPlannerPage,
  drawSudokuPage,
  drawTitlePage,
  drawWordSearchPage,
  type Fonts,
} from "./render-page";

export interface InteriorPageInput {
  index: number;
  type: string;
  content: unknown;
}

export interface InteriorRenderOptions {
  trimWidthIn: number;
  trimHeightIn: number;
}

export async function renderInteriorPdf(
  options: InteriorRenderOptions,
  pages: InteriorPageInput[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("KDP Book Builder Interior");
  doc.setProducer("KDP Book Builder");

  const fonts: Fonts = await embedDocumentFonts(doc);

  const layoutConfig: PageLayoutConfig = { ...DEFAULT_LAYOUT, trimWidthIn: options.trimWidthIn, trimHeightIn: options.trimHeightIn };
  const widthPt = inToPt(options.trimWidthIn);
  const heightPt = inToPt(options.trimHeightIn);

  const sorted = [...pages].sort((a, b) => a.index - b.index);

  for (const pageInput of sorted) {
    const pdfPage = doc.addPage([widthPt, heightPt]);
    const isLeftPage = pageInput.index % 2 === 0;
    const box = getContentBox(layoutConfig, isLeftPage);

    await drawPageByType(doc, pdfPage, fonts, pageInput, box, widthPt, heightPt);

    if (pageInput.type !== "title" && pageInput.type !== "blank") {
      drawFooter(pdfPage, fonts, pageInput.index + 1, widthPt);
    }
  }

  return doc.save();
}

async function drawPageByType(
  doc: PDFDocument,
  pdfPage: import("pdf-lib").PDFPage,
  fonts: Fonts,
  pageInput: InteriorPageInput,
  box: ReturnType<typeof getContentBox>,
  widthPt: number,
  heightPt: number
) {
  const content = pageInput.content as Record<string, unknown>;
  switch (pageInput.type) {
    case "title":
      drawTitlePage(pdfPage, fonts, content as { title: string; tagline?: string }, box, widthPt, heightPt);
      return;
    case "word_search":
      drawWordSearchPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "crossword":
      drawCrosswordPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "sudoku":
    case "number_puzzle":
      drawSudokuPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "maze":
      drawMazePage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "coloring":
      await drawColoringPage(doc, pdfPage, fonts, content as never, box, widthPt);
      return;
    case "journal":
      drawJournalPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "planner":
      drawPlannerPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "log_book":
      drawLogBookPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "notebook":
      drawNotebookPage(pdfPage, content as never, box);
      return;
    case "answer_key":
      drawAnswerKeyPage(pdfPage, fonts, content as never, box, widthPt);
      return;
    case "blank":
      drawBlankPage(pdfPage);
      return;
    default:
      drawBlankPage(pdfPage);
  }
}
