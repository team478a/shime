export type ManualBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: Array<{ text: string; checked?: boolean }> }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; value: string };

export type ManualDocumentContent = {
  blocks: ManualBlock[];
  outline: Array<{ level: 2 | 3; text: string; id: string }>;
};

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return (
    /^#{1,3}\s+/.test(line) ||
    /^-\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^```/.test(line) ||
    (line.includes("|") && isTableDivider(next))
  );
}

function slugBase(text: string) {
  const normalized = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return normalized || "section";
}

type ParseState = {
  lines: string[];
  blocks: ManualBlock[];
  outline: ManualDocumentContent["outline"];
  slugs: Map<string, number>;
  index: number;
};

type BlockParser = (state: ParseState) => boolean;

function parseHeading(state: ParseState) {
  const heading = /^(#{1,3})\s+(.+)$/.exec(state.lines[state.index] ?? "");
  if (!heading) return false;
  const level = heading[1]!.length as 1 | 2 | 3;
  const text = heading[2]!.trim();
  const base = slugBase(text);
  const count = (state.slugs.get(base) ?? 0) + 1;
  state.slugs.set(base, count);
  const id = count === 1 ? base : `${base}-${count}`;
  state.blocks.push({ type: "heading", level, text, id });
  if (level === 2 || level === 3) state.outline.push({ level, text, id });
  state.index += 1;
  return true;
}

function parseCode(state: ParseState) {
  if (!/^```/.test(state.lines[state.index] ?? "")) return false;
  const code: string[] = [];
  state.index += 1;
  while (state.index < state.lines.length && !/^```/.test(state.lines[state.index] ?? "")) {
    code.push(state.lines[state.index] ?? "");
    state.index += 1;
  }
  if (state.index < state.lines.length) state.index += 1;
  state.blocks.push({ type: "code", value: code.join("\n") });
  return true;
}

function parseTable(state: ParseState) {
  const line = state.lines[state.index] ?? "";
  if (!line.includes("|") || !isTableDivider(state.lines[state.index + 1] ?? "")) return false;
  const headers = tableCells(line);
  const rows: string[][] = [];
  state.index += 2;
  while (
    state.index < state.lines.length &&
    (state.lines[state.index] ?? "").includes("|") &&
    (state.lines[state.index] ?? "").trim()
  ) {
    rows.push(tableCells(state.lines[state.index] ?? ""));
    state.index += 1;
  }
  state.blocks.push({ type: "table", headers, rows });
  return true;
}

function parseUnorderedList(state: ParseState) {
  if (!/^-\s+/.test(state.lines[state.index] ?? "")) return false;
  const items: Array<{ text: string; checked?: boolean }> = [];
  while (state.index < state.lines.length && /^-\s+/.test(state.lines[state.index] ?? "")) {
    const item = (state.lines[state.index] ?? "").replace(/^-\s+/, "");
    const checkbox = /^\[([ xX])\]\s+(.+)$/.exec(item);
    items.push(checkbox ? { text: checkbox[2]!, checked: checkbox[1]!.toLowerCase() === "x" } : { text: item });
    state.index += 1;
  }
  state.blocks.push({ type: "unordered-list", items });
  return true;
}

function parseOrderedList(state: ParseState) {
  if (!/^\d+\.\s+/.test(state.lines[state.index] ?? "")) return false;
  const items: string[] = [];
  while (state.index < state.lines.length && /^\d+\.\s+/.test(state.lines[state.index] ?? "")) {
    items.push((state.lines[state.index] ?? "").replace(/^\d+\.\s+/, ""));
    state.index += 1;
  }
  state.blocks.push({ type: "ordered-list", items });
  return true;
}

function parseParagraph(state: ParseState) {
  const paragraph = [(state.lines[state.index] ?? "").trim()];
  state.index += 1;
  while (
    state.index < state.lines.length &&
    (state.lines[state.index] ?? "").trim() &&
    !isBlockStart(state.lines, state.index)
  ) {
    paragraph.push((state.lines[state.index] ?? "").trim());
    state.index += 1;
  }
  state.blocks.push({ type: "paragraph", text: paragraph.join(" ") });
}

const blockParsers: BlockParser[] = [parseHeading, parseCode, parseTable, parseUnorderedList, parseOrderedList];

export function parseManualMarkdown(markdown: string): ManualDocumentContent {
  const state: ParseState = {
    lines: markdown.replace(/\r\n/g, "\n").split("\n"),
    blocks: [],
    outline: [],
    slugs: new Map(),
    index: 0,
  };
  while (state.index < state.lines.length) {
    if (!(state.lines[state.index] ?? "").trim()) {
      state.index += 1;
    } else if (!blockParsers.some((parser) => parser(state))) {
      parseParagraph(state);
    }
  }
  return { blocks: state.blocks, outline: state.outline };
}
