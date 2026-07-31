import type { ReactNode } from "react";

import { type ManualBlock, parseManualMarkdown } from "../lib/manual-markdown";

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return tokens.filter(Boolean).map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (link) {
      return (
        <a href={link[2]} key={index}>
          {link[1]}
        </a>
      );
    }
    return token;
  });
}

function ManualTable({ block }: Readonly<{ block: Extract<ManualBlock, { type: "table" }> }>) {
  return (
    <div className="manual-table-scroll">
      <table>
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header}>{renderInline(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {block.headers.map((_, cellIndex) => (
                <td key={cellIndex}>{renderInline(row[cellIndex] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualBlockView({ block }: Readonly<{ block: ManualBlock }>) {
  switch (block.type) {
    case "heading": {
      if (block.level === 1) return <h1 id={block.id}>{renderInline(block.text)}</h1>;
      if (block.level === 2) return <h2 id={block.id}>{renderInline(block.text)}</h2>;
      return <h3 id={block.id}>{renderInline(block.text)}</h3>;
    }
    case "paragraph":
      return <p>{renderInline(block.text)}</p>;
    case "unordered-list":
      return (
        <ul className={block.items.some((item) => item.checked !== undefined) ? "manual-checklist" : undefined}>
          {block.items.map((item, index) => (
            <li className={item.checked ? "is-checked" : undefined} key={index}>
              {item.checked !== undefined && <span aria-hidden="true">{item.checked ? "✓" : "□"}</span>}
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>
      );
    case "ordered-list":
      return (
        <ol>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "table":
      return <ManualTable block={block} />;
    case "code":
      return (
        <pre>
          <code>{block.value}</code>
        </pre>
      );
  }
}

export function ManualDocument({ markdown }: Readonly<{ markdown: string }>) {
  const content = parseManualMarkdown(markdown);
  return (
    <div className="manual-layout">
      <aside className="manual-toc">
        <details open>
          <summary>目次</summary>
          <nav aria-label="マニュアル目次">
            <ol>
              {content.outline
                .filter((item) => item.level === 2)
                .map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
            </ol>
          </nav>
        </details>
      </aside>
      <article className="manual-article">
        {content.blocks.map((block, index) => (
          <ManualBlockView block={block} key={`${block.type}-${index}`} />
        ))}
        <p className="manual-back-to-top">
          <a href="#manual-page-top">ページ上部へ戻る</a>
        </p>
      </article>
    </div>
  );
}
