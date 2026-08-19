import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import type { PageBox } from "./layout";

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.55, 0.55, 0.55);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);

function centerText(page: PDFPage, text: string, font: PDFFont, size: number, y: number, pageWidth: number, color: RGB = BLACK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (pageWidth - width) / 2, y, size, font, color });
}

export function drawFooter(page: PDFPage, fonts: Fonts, pageNumber: number, pageWidthPt: number) {
  const text = String(pageNumber);
  centerText(page, text, fonts.regular, 9, 18, pageWidthPt, GRAY);
}

export function drawHeader(page: PDFPage, fonts: Fonts, title: string, box: PageBox, pageHeightPt: number) {
  page.drawText(title, { x: box.x, y: pageHeightPt - 30, size: 9, font: fonts.regular, color: GRAY });
}

export function drawBlankPage(_page: PDFPage) {
  // Intentionally blank (used only to keep the interior page count even).
}

export function drawTitlePage(
  page: PDFPage,
  fonts: Fonts,
  content: { title: string; tagline?: string; topic?: string; audience?: string },
  box: PageBox,
  pageWidthPt: number,
  pageHeightPt: number
) {
  centerText(page, content.title, fonts.bold, 28, pageHeightPt * 0.6, pageWidthPt);
  if (content.tagline) {
    centerText(page, content.tagline, fonts.regular, 13, pageHeightPt * 0.6 - 30, pageWidthPt, GRAY);
  }
  page.drawLine({
    start: { x: box.x + box.width * 0.3, y: pageHeightPt * 0.6 - 45 },
    end: { x: box.x + box.width * 0.7, y: pageHeightPt * 0.6 - 45 },
    thickness: 1,
    color: LIGHT_GRAY,
  });
}

interface GridArea {
  cellSize: number;
  originX: number;
  originY: number;
}

function fitGrid(box: PageBox, rows: number, cols: number, reserveTopPt = 0): GridArea {
  const usableHeight = box.height - reserveTopPt;
  const cellSize = Math.min(box.width / cols, usableHeight / rows);
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const originX = box.x + (box.width - gridWidth) / 2;
  const originY = box.y + (usableHeight - gridHeight) / 2;
  return { cellSize, originX, originY };
}

function drawGridLines(page: PDFPage, area: GridArea, rows: number, cols: number, thickness = 0.75) {
  for (let r = 0; r <= rows; r++) {
    const y = area.originY + (rows - r) * area.cellSize;
    page.drawLine({
      start: { x: area.originX, y },
      end: { x: area.originX + cols * area.cellSize, y },
      thickness,
      color: LIGHT_GRAY,
    });
  }
  for (let c = 0; c <= cols; c++) {
    const x = area.originX + c * area.cellSize;
    page.drawLine({
      start: { x, y: area.originY },
      end: { x, y: area.originY + rows * area.cellSize },
      thickness,
      color: LIGHT_GRAY,
    });
  }
}

export function drawWordSearchPage(
  page: PDFPage,
  fonts: Fonts,
  content: { rows: number; cols: number; grid: string[][]; words: string[]; title: string },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, content.title, fonts.bold, 16, box.y + box.height - 16, pageWidthPt);
  const wordListHeight = 60;
  const area = fitGrid(box, content.rows, content.cols, 40 + wordListHeight);
  drawGridLines(page, area, content.rows, content.cols);

  const fontSize = Math.max(6, Math.min(area.cellSize * 0.55, 13));
  for (let r = 0; r < content.rows; r++) {
    for (let c = 0; c < content.cols; c++) {
      const letter = content.grid[r][c];
      const x = area.originX + c * area.cellSize + area.cellSize / 2 - fonts.regular.widthOfTextAtSize(letter, fontSize) / 2;
      const y = area.originY + (content.rows - r - 1) * area.cellSize + area.cellSize / 2 - fontSize / 2.8;
      page.drawText(letter, { x, y, size: fontSize, font: fonts.regular, color: BLACK });
    }
  }

  const wordsText = content.words.join("   •   ");
  const wordsY = box.y + 10;
  drawWrappedText(page, wordsText, fonts.regular, 10, box.x, wordsY, box.width, 12, GRAY);
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: RGB = BLACK
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y + lineHeight * 3; // start a few lines up so text grows upward from y
  const lines: string[] = [];
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
  for (const l of lines.slice(0, 6)) {
    page.drawText(l, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }
}

export function drawCrosswordPage(
  page: PDFPage,
  fonts: Fonts,
  content: {
    rows: number;
    cols: number;
    blocked: boolean[][];
    title: string;
    across: { number: number; clue: string; length: number }[];
    down: { number: number; clue: string; length: number }[];
    numbering: { number: number; row: number; col: number }[];
  },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, content.title, fonts.bold, 16, box.y + box.height - 16, pageWidthPt);
  const gridBoxHeight = box.height * 0.55;
  const area = fitGrid({ ...box, y: box.y + box.height - 40 - gridBoxHeight, height: gridBoxHeight }, content.rows, content.cols, 0);

  for (let r = 0; r < content.rows; r++) {
    for (let c = 0; c < content.cols; c++) {
      const x = area.originX + c * area.cellSize;
      const y = area.originY + (content.rows - r - 1) * area.cellSize;
      if (content.blocked[r][c]) {
        page.drawRectangle({ x, y, width: area.cellSize, height: area.cellSize, color: BLACK });
      }
    }
  }
  drawGridLines(page, area, content.rows, content.cols);
  const numberFontSize = Math.max(4, area.cellSize * 0.28);
  for (const n of content.numbering) {
    const x = area.originX + n.col * area.cellSize + 1;
    const y = area.originY + (content.rows - n.row - 1) * area.cellSize + area.cellSize - numberFontSize - 1;
    page.drawText(String(n.number), { x, y, size: numberFontSize, font: fonts.regular, color: BLACK });
  }

  const cluesTop = box.y + box.height * 0.4;
  const colWidth = box.width / 2 - 10;
  page.drawText("ACROSS", { x: box.x, y: cluesTop, size: 10, font: fonts.bold, color: BLACK });
  let y1 = cluesTop - 14;
  for (const clue of content.across.slice(0, 14)) {
    page.drawText(`${clue.number}. ${clue.clue}`, { x: box.x, y: y1, size: 8, font: fonts.regular, color: BLACK, maxWidth: colWidth });
    y1 -= 12;
  }
  page.drawText("DOWN", { x: box.x + colWidth + 20, y: cluesTop, size: 10, font: fonts.bold, color: BLACK });
  let y2 = cluesTop - 14;
  for (const clue of content.down.slice(0, 14)) {
    page.drawText(`${clue.number}. ${clue.clue}`, { x: box.x + colWidth + 20, y: y2, size: 8, font: fonts.regular, color: BLACK, maxWidth: colWidth });
    y2 -= 12;
  }
}

export function drawSudokuPage(
  page: PDFPage,
  fonts: Fonts,
  content: { size: number; grid: number[][]; title: string },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, content.title, fonts.bold, 16, box.y + box.height - 16, pageWidthPt);
  const area = fitGrid(box, content.size, content.size, 40);
  drawGridLines(page, area, content.size, content.size, 0.5);
  // Bold 3x3 box borders.
  for (let i = 0; i <= content.size; i += 3) {
    const x = area.originX + i * area.cellSize;
    page.drawLine({ start: { x, y: area.originY }, end: { x, y: area.originY + content.size * area.cellSize }, thickness: 1.75, color: BLACK });
    const y = area.originY + i * area.cellSize;
    page.drawLine({ start: { x: area.originX, y }, end: { x: area.originX + content.size * area.cellSize, y }, thickness: 1.75, color: BLACK });
  }
  const fontSize = area.cellSize * 0.5;
  for (let r = 0; r < content.size; r++) {
    for (let c = 0; c < content.size; c++) {
      const v = content.grid[r][c];
      if (!v) continue;
      const text = String(v);
      const x = area.originX + c * area.cellSize + area.cellSize / 2 - fonts.bold.widthOfTextAtSize(text, fontSize) / 2;
      const y = area.originY + (content.size - r - 1) * area.cellSize + area.cellSize / 2 - fontSize / 2.8;
      page.drawText(text, { x, y, size: fontSize, font: fonts.bold, color: BLACK });
    }
  }
}

const WALL_N = 1;
const WALL_E = 2;
const WALL_S = 4;
const WALL_W = 8;

export function drawMazePage(
  page: PDFPage,
  fonts: Fonts,
  content: { rows: number; cols: number; walls: number[][]; start: { row: number; col: number }; end: { row: number; col: number }; title: string },
  box: PageBox,
  pageWidthPt: number,
  path?: { row: number; col: number }[]
) {
  centerText(page, content.title, fonts.bold, 16, box.y + box.height - 16, pageWidthPt);
  const area = fitGrid(box, content.rows, content.cols, 40);

  const cellTopLeft = (r: number, c: number) => ({
    x: area.originX + c * area.cellSize,
    y: area.originY + (content.rows - r - 1) * area.cellSize,
  });

  // Outer border always closed.
  page.drawRectangle({
    x: area.originX,
    y: area.originY,
    width: content.cols * area.cellSize,
    height: content.rows * area.cellSize,
    borderColor: BLACK,
    borderWidth: 2,
  });

  for (let r = 0; r < content.rows; r++) {
    for (let c = 0; c < content.cols; c++) {
      const walls = content.walls[r][c];
      const { x, y } = cellTopLeft(r, c);
      if (walls & WALL_N) page.drawLine({ start: { x, y: y + area.cellSize }, end: { x: x + area.cellSize, y: y + area.cellSize }, thickness: 2, color: BLACK });
      if (walls & WALL_S) page.drawLine({ start: { x, y }, end: { x: x + area.cellSize, y }, thickness: 2, color: BLACK });
      if (walls & WALL_W) page.drawLine({ start: { x, y }, end: { x, y: y + area.cellSize }, thickness: 2, color: BLACK });
      if (walls & WALL_E) page.drawLine({ start: { x: x + area.cellSize, y }, end: { x: x + area.cellSize, y: y + area.cellSize }, thickness: 2, color: BLACK });
    }
  }

  if (path && path.length > 1) {
    const color = rgb(0.85, 0.2, 0.2);
    for (let i = 0; i < path.length - 1; i++) {
      const a = cellTopLeft(path[i].row, path[i].col);
      const b = cellTopLeft(path[i + 1].row, path[i + 1].col);
      page.drawLine({
        start: { x: a.x + area.cellSize / 2, y: a.y + area.cellSize / 2 },
        end: { x: b.x + area.cellSize / 2, y: b.y + area.cellSize / 2 },
        thickness: Math.max(2, area.cellSize * 0.15),
        color,
      });
    }
  }

  const startLabel = "START";
  const endLabel = "END";
  const s = cellTopLeft(content.start.row, content.start.col);
  const e = cellTopLeft(content.end.row, content.end.col);
  page.drawText(startLabel, { x: s.x + 2, y: s.y + area.cellSize * 0.3, size: Math.min(7, area.cellSize * 0.3), font: fonts.regular, color: GRAY });
  page.drawText(endLabel, { x: e.x + 2, y: e.y + area.cellSize * 0.3, size: Math.min(7, area.cellSize * 0.3), font: fonts.regular, color: GRAY });
}

export async function drawColoringPage(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  content: { imageUrl: string; title: string },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, content.title, fonts.regular, 11, box.y + box.height - 12, pageWidthPt, GRAY);
  const imageBox = { x: box.x, y: box.y, width: box.width, height: box.height - 24 };

  const embedded = await tryEmbedImage(doc, content.imageUrl);
  if (embedded) {
    const scale = Math.min(imageBox.width / embedded.width, imageBox.height / embedded.height);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded.image, {
      x: imageBox.x + (imageBox.width - w) / 2,
      y: imageBox.y + (imageBox.height - h) / 2,
      width: w,
      height: h,
    });
    return;
  }

  // Vector fallback placeholder (used for the mock provider's SVG output,
  // which pdf-lib cannot embed directly). A real image provider returning
  // PNG/JPEG bytes is embedded above via drawImage instead.
  const size = Math.min(imageBox.width, imageBox.height) * 0.7;
  const cx = imageBox.x + imageBox.width / 2;
  const cy = imageBox.y + imageBox.height / 2;
  page.drawEllipse({ x: cx, y: cy, xScale: size / 2, yScale: size / 2, borderColor: BLACK, borderWidth: 3 });
  page.drawRectangle({
    x: imageBox.x,
    y: imageBox.y,
    width: imageBox.width,
    height: imageBox.height,
    borderColor: LIGHT_GRAY,
    borderWidth: 1,
  });
  centerText(page, "Illustration placeholder (configure an image-capable AI provider)", fonts.regular, 8, imageBox.y - 4, pageWidthPt, GRAY);
}

async function tryEmbedImage(doc: PDFDocument, url: string) {
  try {
    if (url.startsWith("data:image/png")) {
      const base64 = url.split(",")[1];
      const image = await doc.embedPng(Buffer.from(base64, "base64"));
      return { image, width: image.width, height: image.height };
    }
    if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) {
      const base64 = url.split(",")[1];
      const image = await doc.embedJpg(Buffer.from(base64, "base64"));
      return { image, width: image.width, height: image.height };
    }
    if (url.startsWith("http")) {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type") ?? "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (contentType.includes("png")) {
        const image = await doc.embedPng(bytes);
        return { image, width: image.width, height: image.height };
      }
      if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        const image = await doc.embedJpg(bytes);
        return { image, width: image.width, height: image.height };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function drawJournalPage(
  page: PDFPage,
  fonts: Fonts,
  content: { prompt: string; lineCount: number },
  box: PageBox,
  pageWidthPt: number
) {
  drawWrappedText(page, content.prompt, fonts.bold, 13, box.x, box.y + box.height - 40, box.width, 16, BLACK);
  const lineTop = box.y + box.height - 90;
  const lineSpacing = Math.max(16, (lineTop - box.y) / content.lineCount);
  let y = lineTop;
  while (y > box.y) {
    page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.75, color: LIGHT_GRAY });
    y -= lineSpacing;
  }
  void pageWidthPt;
}

export function drawPlannerPage(
  page: PDFPage,
  fonts: Fonts,
  content: { weekLabel: string; sections: string[]; days: string[] },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, content.weekLabel, fonts.bold, 16, box.y + box.height - 16, pageWidthPt);
  const colWidth = box.width / content.days.length;
  const top = box.y + box.height - 40;
  const bottom = box.y + box.height * 0.35;
  for (let i = 0; i <= content.days.length; i++) {
    const x = box.x + i * colWidth;
    page.drawLine({ start: { x, y: bottom }, end: { x, y: top }, thickness: 0.75, color: LIGHT_GRAY });
  }
  content.days.forEach((day, i) => {
    page.drawText(day, { x: box.x + i * colWidth + 4, y: top - 12, size: 9, font: fonts.bold, color: BLACK });
  });
  page.drawLine({ start: { x: box.x, y: bottom }, end: { x: box.x + box.width, y: bottom }, thickness: 0.75, color: LIGHT_GRAY });
  page.drawLine({ start: { x: box.x, y: top }, end: { x: box.x + box.width, y: top }, thickness: 0.75, color: LIGHT_GRAY });

  let sectionY = bottom - 20;
  const sectionHeight = (sectionY - box.y) / content.sections.length;
  for (const section of content.sections) {
    page.drawText(section, { x: box.x, y: sectionY, size: 10, font: fonts.bold, color: BLACK });
    page.drawLine({ start: { x: box.x, y: sectionY - 14 }, end: { x: box.x + box.width, y: sectionY - 14 }, thickness: 0.75, color: LIGHT_GRAY });
    sectionY -= sectionHeight;
  }
}

export function drawLogBookPage(
  page: PDFPage,
  fonts: Fonts,
  content: { columns: string[]; rowCount: number; title: string },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, content.title, fonts.bold, 14, box.y + box.height - 14, pageWidthPt);
  const top = box.y + box.height - 40;
  const colWidth = box.width / content.columns.length;
  content.columns.forEach((col, i) => {
    page.drawText(col, { x: box.x + i * colWidth + 2, y: top, size: 9, font: fonts.bold, color: BLACK });
  });
  const rowHeight = Math.max(14, (top - box.y - 10) / content.rowCount);
  let y = top - 6;
  for (let r = 0; r <= content.rowCount; r++) {
    page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.5, color: LIGHT_GRAY });
    y -= rowHeight;
  }
  for (let i = 0; i <= content.columns.length; i++) {
    const x = box.x + i * colWidth;
    page.drawLine({ start: { x, y: box.y }, end: { x, y: top + 4 }, thickness: 0.5, color: LIGHT_GRAY });
  }
}

export function drawNotebookPage(page: PDFPage, content: { style: "lined" | "grid" | "dot" }, box: PageBox) {
  if (content.style === "lined") {
    let y = box.y + box.height;
    const spacing = 22;
    while (y > box.y) {
      page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.75, color: LIGHT_GRAY });
      y -= spacing;
    }
    return;
  }
  const spacing = 18;
  if (content.style === "grid") {
    for (let x = box.x; x <= box.x + box.width; x += spacing) {
      page.drawLine({ start: { x, y: box.y }, end: { x, y: box.y + box.height }, thickness: 0.5, color: LIGHT_GRAY });
    }
    for (let y = box.y; y <= box.y + box.height; y += spacing) {
      page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.5, color: LIGHT_GRAY });
    }
    return;
  }
  // dot grid
  for (let x = box.x; x <= box.x + box.width; x += spacing) {
    for (let y = box.y; y <= box.y + box.height; y += spacing) {
      page.drawCircle({ x, y, size: 0.7, color: LIGHT_GRAY });
    }
  }
}

export interface AnswerKeyEntry {
  pageNumber: number;
  title: string;
  puzzleType: string;
  puzzleData: unknown;
  solutionData: unknown;
}

export function drawAnswerKeyPage(
  page: PDFPage,
  fonts: Fonts,
  content: { entries: AnswerKeyEntry[] },
  box: PageBox,
  pageWidthPt: number
) {
  centerText(page, "Answer Key", fonts.bold, 16, box.y + box.height - 16, pageWidthPt);
  const cols = content.entries.length > 1 ? 2 : 1;
  const rows = Math.ceil(content.entries.length / cols);
  const cellW = box.width / cols;
  const cellH = (box.height - 40) / rows;

  content.entries.forEach((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellBox: PageBox = {
      x: box.x + col * cellW + 6,
      y: box.y + box.height - 40 - (row + 1) * cellH + 6,
      width: cellW - 12,
      height: cellH - 20,
    };
    page.drawText(`Page ${entry.pageNumber}`, {
      x: cellBox.x,
      y: cellBox.y + cellBox.height + 4,
      size: 9,
      font: fonts.bold,
      color: BLACK,
    });
    drawAnswerThumbnail(page, fonts, entry, cellBox);
  });
}

function drawAnswerThumbnail(page: PDFPage, fonts: Fonts, entry: AnswerKeyEntry, box: PageBox) {
  if (entry.puzzleType === "word_search") {
    const puzzle = entry.puzzleData as { rows: number; cols: number; grid: string[][] };
    const solution = entry.solutionData as { mask: boolean[][] };
    const area = fitGrid(box, puzzle.rows, puzzle.cols);
    const fontSize = Math.max(3, Math.min(area.cellSize * 0.55, 8));
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const isWord = solution.mask[r][c];
        const letter = puzzle.grid[r][c];
        const x = area.originX + c * area.cellSize + area.cellSize / 2 - fonts.regular.widthOfTextAtSize(letter, fontSize) / 2;
        const y = area.originY + (puzzle.rows - r - 1) * area.cellSize + area.cellSize / 2 - fontSize / 2.8;
        page.drawText(letter, { x, y, size: fontSize, font: isWord ? fonts.bold : fonts.regular, color: isWord ? BLACK : LIGHT_GRAY });
      }
    }
    return;
  }
  if (entry.puzzleType === "sudoku") {
    const solution = entry.solutionData as { grid: number[][] };
    const area = fitGrid(box, 9, 9);
    drawGridLines(page, area, 9, 9, 0.4);
    const fontSize = area.cellSize * 0.5;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const text = String(solution.grid[r][c]);
        const x = area.originX + c * area.cellSize + area.cellSize / 2 - fonts.regular.widthOfTextAtSize(text, fontSize) / 2;
        const y = area.originY + (9 - r - 1) * area.cellSize + area.cellSize / 2 - fontSize / 2.8;
        page.drawText(text, { x, y, size: fontSize, font: fonts.regular, color: BLACK });
      }
    }
    return;
  }
  if (entry.puzzleType === "maze") {
    const puzzle = entry.puzzleData as { rows: number; cols: number; walls: number[][]; start: { row: number; col: number }; end: { row: number; col: number } };
    const solution = entry.solutionData as { path: { row: number; col: number }[] };
    drawMazePage(page, fonts, { ...puzzle, title: "" }, box, 0, solution.path);
    return;
  }
  if (entry.puzzleType === "crossword") {
    const puzzle = entry.puzzleData as { rows: number; cols: number; blocked: boolean[][] };
    const solution = entry.solutionData as { grid: (string | null)[][] };
    const area = fitGrid(box, puzzle.rows, puzzle.cols);
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const x = area.originX + c * area.cellSize;
        const y = area.originY + (puzzle.rows - r - 1) * area.cellSize;
        if (puzzle.blocked[r][c]) {
          page.drawRectangle({ x, y, width: area.cellSize, height: area.cellSize, color: BLACK });
          continue;
        }
        const letter = solution.grid[r][c] ?? "";
        const fontSize = Math.max(3, area.cellSize * 0.5);
        page.drawText(letter, {
          x: x + area.cellSize / 2 - fonts.regular.widthOfTextAtSize(letter, fontSize) / 2,
          y: y + area.cellSize / 2 - fontSize / 2.8,
          size: fontSize,
          font: fonts.regular,
          color: BLACK,
        });
      }
    }
    drawGridLines(page, area, puzzle.rows, puzzle.cols, 0.4);
  }
}
