import { describe, expect, it } from "vitest";

import { parseManualMarkdown } from "../../apps/web/src/lib/manual-markdown";
import { isManualKey, MANUALS } from "../../apps/web/src/lib/manuals";

describe("web manuals", () => {
  it("parses headings, lists, checklists, tables, and code without HTML execution", () => {
    const content = parseManualMarkdown(`# Manual

## First section

Paragraph
continued.

- item
- [x] done

1. first
2. second

| Role | Access |
|---|---|
| Staff | Check-in |

\`\`\`
safe
\`\`\`

## First section
`);

    expect(content.outline).toEqual([
      { level: 2, text: "First section", id: "first-section" },
      { level: 2, text: "First section", id: "first-section-2" },
    ]);
    expect(content.blocks).toEqual(
      expect.arrayContaining([
        { type: "paragraph", text: "Paragraph continued." },
        {
          type: "unordered-list",
          items: [{ text: "item" }, { text: "done", checked: true }],
        },
        { type: "ordered-list", items: ["first", "second"] },
        {
          type: "table",
          headers: ["Role", "Access"],
          rows: [["Staff", "Check-in"]],
        },
        { type: "code", value: "safe" },
      ]),
    );
  });

  it("exposes only the registered manuals", () => {
    expect(isManualKey("admin")).toBe(true);
    expect(isManualKey("participant")).toBe(true);
    expect(isManualKey("../secret")).toBe(false);
    expect(Object.keys(MANUALS)).toEqual(["admin", "participant"]);
  });
});
