/**
 * Builds the front page of the documentation of Python §4 Typed: the template (docs/md/README_4_typed.md)
 * with the types of the predeclared names, which are taken from the declarations that the type checker
 * uses (src/typecheck/prelude.pyi), so that the documentation cannot differ from what is checked.
 *
 *     tsx scripts/typed-readme.ts <template> <prelude.pyi> <output>
 */
import { readFileSync, writeFileSync } from "node:fs";

const MARKER = "<!-- PRELUDE -->";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The declarations of the prelude, by group: `# ── pairs and linked lists (…) ───` starts a group. */
export function groupsOf(prelude: string): { title: string; lines: string[] }[] {
  const groups: { title: string; lines: string[] }[] = [];
  for (const line of prelude.split("\n")) {
    const heading = /^# ── (.+?) ─+$/.exec(line);
    if (heading) {
      groups.push({
        title: heading[1].replace(/\s*\(.*\)\s*$/, "").replace(/:.*$/, ""),
        lines: [],
      });
      continue;
    }
    const group = groups[groups.length - 1];
    if (!group) continue;
    // A declaration that a program can use; the private helpers (leading underscore) are left out.
    if (/^(def |type )/.test(line) || /^[a-z][A-Za-z0-9_]*: /.test(line)) {
      group.lines.push(
        line
          .replace(/: \.\.\.$/, "")
          .replace(/\b_(Any|TypeIs|NoReturn)\b/g, "$1")
          .trimEnd(),
      );
    }
  }
  return groups.filter(group => group.lines.length > 0);
}

export function renderTypes(prelude: string): string {
  return groupsOf(prelude)
    .map(
      ({ title, lines }) =>
        `<h3>${escapeHtml(title)}</h3>\n<pre><code>${lines.map(escapeHtml).join("\n")}</code></pre>`,
    )
    .join("\n");
}

if (require.main === module) {
  const [template, prelude, output] = process.argv.slice(2);
  const text = readFileSync(template, "utf8");
  if (!text.includes(MARKER)) throw new Error(`${template} has no ${MARKER}`);
  writeFileSync(output, text.replace(MARKER, renderTypes(readFileSync(prelude, "utf8"))));
}
