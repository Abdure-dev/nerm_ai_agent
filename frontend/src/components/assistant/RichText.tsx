import { Fragment, type ReactNode } from "react";

type RichTextProps = {
  content: string;
};

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: { text: string; depth: number }[] }
  | { kind: "paragraph"; lines: string[] };

const BULLET = /^(\s*)[-*•]\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;
const RULE = /^\s*[-—_*]{3,}\s*$/;

// Renders the small Markdown subset the assistant is asked to produce:
// headings, (nested) bullet and numbered lists, paragraphs, bold, and code.
export function RichText({ content }: RichTextProps) {
  return (
    <div className="space-y-3">
      {parseBlocks(content).map((block, index) => {
        if (block.kind === "heading") {
          return (
            <p key={index} className="pt-1 font-serif text-lg leading-snug text-maroon">
              {formatInline(block.text)}
            </p>
          );
        }

        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-maroon`}
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className={item.depth > 0 ? "ml-5 list-[circle]" : undefined}
                >
                  {formatInline(item.text)}
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {formatInline(block.lines.join("\n"))}
          </p>
        );
      })}
    </div>
  );
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of content.split("\n")) {
    if (!rawLine.trim() || RULE.test(rawLine)) {
      blocks.push({ kind: "paragraph", lines: [] });
      continue;
    }

    const heading = rawLine.trim().match(HEADING);
    const bullet = rawLine.match(BULLET);
    const numbered = rawLine.match(NUMBERED);
    const last = blocks.at(-1);

    if (heading) {
      blocks.push({ kind: "heading", text: heading[1].replace(/\*\*/g, "") });
    } else if (bullet || numbered) {
      const match = (bullet ?? numbered)!;
      const depth = match[1].length >= 2 ? 1 : 0;
      const ordered = !bullet;
      // Nested items stay inside the current list even if their marker differs.
      if (last?.kind === "list" && (last.ordered === ordered || depth > 0)) {
        last.items.push({ text: match[2], depth });
      } else {
        blocks.push({ kind: "list", ordered, items: [{ text: match[2], depth }] });
      }
    } else if (last?.kind === "paragraph") {
      last.lines.push(rawLine.trim());
    } else {
      blocks.push({ kind: "paragraph", lines: [rawLine.trim()] });
    }
  }

  return blocks.filter((block) => block.kind !== "paragraph" || block.lines.length > 0);
}

function formatInline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="bg-greystone-light px-1 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
