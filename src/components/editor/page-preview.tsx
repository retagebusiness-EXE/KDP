const WALL_N = 1;
const WALL_E = 2;
const WALL_S = 4;
const WALL_W = 8;

export function PagePreview({ type, content }: { type: string; content: unknown }) {
  switch (type) {
    case "title":
      return <TitlePreview content={content as { title: string; tagline?: string; topic?: string }} />;
    case "word_search":
      return <WordSearchPreview content={content as { rows: number; cols: number; grid: string[][]; words: string[]; title: string }} />;
    case "crossword":
      return <CrosswordPreview content={content as CrosswordContent} />;
    case "sudoku":
    case "number_puzzle":
      return <SudokuPreview content={content as { size: number; grid: number[][]; title: string }} />;
    case "maze":
      return <MazePreview content={content as MazeContent} />;
    case "coloring":
      return <ColoringPreview content={content as { imageUrl: string; title: string }} />;
    case "journal":
      return <JournalPreview content={content as { prompt: string; lineCount: number }} />;
    case "planner":
      return <PlannerPreview content={content as { weekLabel: string; sections: string[]; days: string[] }} />;
    case "log_book":
      return <LogBookPreview content={content as { columns: string[]; rowCount: number; title: string }} />;
    case "notebook":
      return <NotebookPreview content={content as { style: "lined" | "grid" | "dot" }} />;
    case "answer_key":
      return <AnswerKeyPreview content={content as AnswerKeyContent} />;
    case "blank":
      return <div className="flex h-full items-center justify-center text-sm text-slate-300">Blank page</div>;
    default:
      return <div className="p-6 text-sm text-slate-400">No preview available for &ldquo;{type}&rdquo;.</div>;
  }
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center gap-4 p-8">{children}</div>;
}

function TitlePreview({ content }: { content: { title: string; tagline?: string; topic?: string } }) {
  return (
    <PageFrame>
      <h1 className="text-center text-3xl font-bold text-slate-900">{content.title}</h1>
      {content.tagline && <p className="text-center text-slate-500">{content.tagline}</p>}
    </PageFrame>
  );
}

function Grid({ rows, cols, children }: { rows: number; cols: number; children: React.ReactNode }) {
  return (
    <div
      className="grid border border-slate-300"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, aspectRatio: `${cols} / ${rows}`, width: "100%", maxWidth: 420 }}
    >
      {children}
    </div>
  );
}

function WordSearchPreview({ content }: { content: { rows: number; cols: number; grid: string[][]; words: string[]; title: string } }) {
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
      <Grid rows={content.rows} cols={content.cols}>
        {content.grid.flatMap((row, r) =>
          row.map((letter, c) => (
            <div key={`${r}-${c}`} className="flex items-center justify-center border border-slate-100 text-[10px] font-medium text-slate-700 sm:text-xs">
              {letter}
            </div>
          ))
        )}
      </Grid>
      <p className="max-w-md text-center text-xs text-slate-500">{content.words.join("  •  ")}</p>
    </PageFrame>
  );
}

interface CrosswordContent {
  rows: number;
  cols: number;
  blocked: boolean[][];
  title: string;
  across: { number: number; clue: string; length: number }[];
  down: { number: number; clue: string; length: number }[];
  numbering: { number: number; row: number; col: number }[];
}

function CrosswordPreview({ content }: { content: CrosswordContent }) {
  const numberAt = new Map(content.numbering.map((n) => [`${n.row}-${n.col}`, n.number]));
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
      <Grid rows={content.rows} cols={content.cols}>
        {content.blocked.flatMap((row, r) =>
          row.map((isBlocked, c) => (
            <div key={`${r}-${c}`} className={"relative border border-slate-200 " + (isBlocked ? "bg-slate-900" : "bg-white")}>
              {!isBlocked && numberAt.has(`${r}-${c}`) && (
                <span className="absolute left-0.5 top-0 text-[6px] text-slate-500">{numberAt.get(`${r}-${c}`)}</span>
              )}
            </div>
          ))
        )}
      </Grid>
      <div className="grid w-full max-w-md grid-cols-2 gap-4 text-xs text-slate-600">
        <div>
          <p className="mb-1 font-semibold text-slate-800">Across</p>
          <ul className="space-y-0.5">
            {content.across.map((c) => (
              <li key={`a${c.number}`}>
                {c.number}. {c.clue}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-semibold text-slate-800">Down</p>
          <ul className="space-y-0.5">
            {content.down.map((c) => (
              <li key={`d${c.number}`}>
                {c.number}. {c.clue}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageFrame>
  );
}

function SudokuPreview({ content }: { content: { size: number; grid: number[][]; title: string } }) {
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
      <Grid rows={content.size} cols={content.size}>
        {content.grid.flatMap((row, r) =>
          row.map((value, c) => (
            <div
              key={`${r}-${c}`}
              className="flex items-center justify-center border border-slate-200 text-xs font-semibold text-slate-800"
              style={{
                borderTopWidth: r % 3 === 0 ? 2 : 1,
                borderLeftWidth: c % 3 === 0 ? 2 : 1,
                borderRightWidth: c === content.size - 1 ? 2 : 1,
                borderBottomWidth: r === content.size - 1 ? 2 : 1,
                borderColor: "#334155",
              }}
            >
              {value || ""}
            </div>
          ))
        )}
      </Grid>
    </PageFrame>
  );
}

interface MazeContent {
  rows: number;
  cols: number;
  walls: number[][];
  start: { row: number; col: number };
  end: { row: number; col: number };
  title: string;
}

function MazePreview({ content, path }: { content: MazeContent; path?: { row: number; col: number }[] }) {
  const onPath = new Set((path ?? []).map((p) => `${p.row}-${p.col}`));
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
      <Grid rows={content.rows} cols={content.cols}>
        {content.walls.flatMap((row, r) =>
          row.map((w, c) => (
            <div
              key={`${r}-${c}`}
              className={onPath.has(`${r}-${c}`) ? "bg-red-100" : "bg-white"}
              style={{
                borderTop: w & WALL_N ? "2px solid #0f172a" : "1px solid transparent",
                borderRight: w & WALL_E ? "2px solid #0f172a" : "1px solid transparent",
                borderBottom: w & WALL_S ? "2px solid #0f172a" : "1px solid transparent",
                borderLeft: w & WALL_W ? "2px solid #0f172a" : "1px solid transparent",
              }}
            />
          ))
        )}
      </Grid>
      <p className="text-xs text-slate-500">Start top-left, end bottom-right.</p>
    </PageFrame>
  );
}

function ColoringPreview({ content }: { content: { imageUrl: string; title: string } }) {
  return (
    <PageFrame>
      <h2 className="text-sm text-slate-500">{content.title}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.imageUrl} alt={content.title} className="max-h-96 w-full max-w-md rounded-lg border border-slate-200 object-contain" />
    </PageFrame>
  );
}

function JournalPreview({ content }: { content: { prompt: string; lineCount: number } }) {
  return (
    <PageFrame>
      <p className="text-base font-medium text-slate-900">{content.prompt}</p>
      <div className="w-full max-w-md space-y-3">
        {Array.from({ length: Math.min(10, content.lineCount) }).map((_, i) => (
          <div key={i} className="h-px w-full bg-slate-200" />
        ))}
      </div>
    </PageFrame>
  );
}

function PlannerPreview({ content }: { content: { weekLabel: string; sections: string[]; days: string[] } }) {
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">{content.weekLabel}</h2>
      <div className="grid w-full max-w-md grid-cols-7 gap-1 text-[10px] text-slate-500">
        {content.days.map((d) => (
          <div key={d} className="rounded border border-slate-200 py-4 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="w-full max-w-md space-y-2">
        {content.sections.map((s) => (
          <div key={s} className="rounded border border-slate-200 p-2 text-xs font-medium text-slate-700">
            {s}
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

function LogBookPreview({ content }: { content: { columns: string[]; rowCount: number; title: string } }) {
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
      <table className="w-full max-w-md border-collapse text-[10px] text-slate-600">
        <thead>
          <tr>
            {content.columns.map((c) => (
              <th key={c} className="border border-slate-200 px-2 py-1 text-left font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, r) => (
            <tr key={r}>
              {content.columns.map((c) => (
                <td key={c} className="h-5 border border-slate-100" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </PageFrame>
  );
}

function NotebookPreview({ content }: { content: { style: "lined" | "grid" | "dot" } }) {
  if (content.style === "lined") {
    return (
      <PageFrame>
        <div className="w-full max-w-md space-y-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-px w-full bg-slate-200" />
          ))}
        </div>
      </PageFrame>
    );
  }
  const cells = content.style === "grid" ? 16 : 12;
  return (
    <PageFrame>
      <div className="grid w-full max-w-md grid-cols-12 gap-3">
        {Array.from({ length: cells * 12 }).map((_, i) => (
          <div key={i} className={content.style === "grid" ? "h-3 w-3 border border-slate-200" : "h-1 w-1 rounded-full bg-slate-300"} />
        ))}
      </div>
    </PageFrame>
  );
}

interface AnswerKeyContent {
  entries: { pageNumber: number; title: string; puzzleType: string; puzzleData: unknown; solutionData: unknown }[];
}

function AnswerKeyPreview({ content }: { content: AnswerKeyContent }) {
  return (
    <PageFrame>
      <h2 className="text-lg font-semibold text-slate-900">Answer Key</h2>
      <div className="grid w-full max-w-lg grid-cols-2 gap-4">
        {content.entries.map((entry) => (
          <div key={entry.pageNumber} className="rounded border border-slate-200 p-2">
            <p className="mb-1 text-[10px] font-medium text-slate-500">Page {entry.pageNumber}</p>
            <AnswerThumbnail entry={entry} />
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

function AnswerThumbnail({ entry }: { entry: AnswerKeyContent["entries"][number] }) {
  if (entry.puzzleType === "word_search") {
    const puzzle = entry.puzzleData as { rows: number; cols: number; grid: string[][] };
    const solution = entry.solutionData as { mask: boolean[][] };
    return (
      <Grid rows={puzzle.rows} cols={puzzle.cols}>
        {puzzle.grid.flatMap((row, r) =>
          row.map((letter, c) => (
            <div
              key={`${r}-${c}`}
              className={"flex items-center justify-center text-[6px] " + (solution.mask[r][c] ? "bg-indigo-100 font-bold text-indigo-700" : "text-slate-300")}
            >
              {letter}
            </div>
          ))
        )}
      </Grid>
    );
  }
  if (entry.puzzleType === "sudoku") {
    const solution = entry.solutionData as { grid: number[][] };
    return (
      <Grid rows={9} cols={9}>
        {solution.grid.flatMap((row, r) => row.map((v, c) => <div key={`${r}-${c}`} className="flex items-center justify-center border border-slate-100 text-[6px]">{v}</div>))}
      </Grid>
    );
  }
  if (entry.puzzleType === "maze") {
    const puzzle = entry.puzzleData as MazeContent;
    const solution = entry.solutionData as { path: { row: number; col: number }[] };
    return <MazePreview content={{ ...puzzle, title: "" }} path={solution.path} />;
  }
  if (entry.puzzleType === "crossword") {
    const puzzle = entry.puzzleData as { rows: number; cols: number; blocked: boolean[][] };
    const solution = entry.solutionData as { grid: (string | null)[][] };
    return (
      <Grid rows={puzzle.rows} cols={puzzle.cols}>
        {puzzle.blocked.flatMap((row, r) =>
          row.map((isBlocked, c) => (
            <div key={`${r}-${c}`} className={"flex items-center justify-center border border-slate-100 text-[6px] " + (isBlocked ? "bg-slate-900" : "")}>
              {!isBlocked ? solution.grid[r][c] : ""}
            </div>
          ))
        )}
      </Grid>
    );
  }
  return null;
}
