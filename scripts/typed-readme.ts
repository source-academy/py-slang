/**
 * Builds the front page of the documentation of Python §4 Typed: the template (docs/md/README_4_typed.md)
 * with the types of the predeclared names, which are taken from the declarations that the type checker
 * uses (src/typecheck/prelude.pyi), so that the documentation cannot differ from what is checked.
 *
 *     tsx scripts/typed-readme.ts <template> <prelude.pyi> <output>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { signaturesOf, type ModuleDescription } from "../src/typecheck/module-description";
import { temporaryModuleDescriptions } from "../src/typecheck/modules";

const MARKER = "<!-- PRELUDE -->";
const MODULES_MARKER = "<!-- MODULES -->";

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
          // the marker of positional-only parameters is noise for a student: `(x: int, /)` is `(x: int)`
          .replace(/,\s*\/(?=\s*[,)])/g, "")
          .replace(/\(\s*\/\s*,\s*/g, "(")
          .replace(/\b_(TypeIs|NoReturn)\b/g, "$1")
          // the Any of the narrowing of is_pair and is_list: a program cannot write it, and nor does a student read it
          .replace(/\b_Any\b/g, "object")
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

/** What the documentation has for a module, besides what its description says (docs/md/module-types.json). */
export interface ModuleDocs {
  note?: string;
  types?: Record<string, string>;
}

/** The types and the names of the modules whose types are known: `docs` has the explanations of the types. */
export function renderModules(
  descriptions: ModuleDescription[],
  docs: Record<string, ModuleDocs>,
): string {
  return descriptions
    .map(description => {
      const { types, lines } = signaturesOf(description);
      const doc = docs[description.module] ?? {};
      const typeItems = types.map(({ name, typeParameters }) => {
        const shown = typeParameters.length ? `${name}[${typeParameters.join(", ")}]` : name;
        return `<li><code>${escapeHtml(shown)}</code>: ${escapeHtml(doc.types?.[name] ?? "")}</li>`;
      });
      return [
        `<h3>${escapeHtml(description.module)}</h3>`,
        doc.note ? `<p>${escapeHtml(doc.note)}</p>` : "",
        typeItems.length ? `<p>Types:</p>\n<ul>\n${typeItems.join("\n")}\n</ul>` : "",
        `<pre><code>${lines.map(escapeHtml).join("\n")}</code></pre>`,
      ]
        .filter(part => part !== "")
        .join("\n");
    })
    .join("\n");
}

if (require.main === module) {
  const [template, prelude, output] = process.argv.slice(2);
  const text = readFileSync(template, "utf8");
  if (!text.includes(MARKER)) throw new Error(`${template} has no ${MARKER}`);
  if (!text.includes(MODULES_MARKER)) throw new Error(`${template} has no ${MODULES_MARKER}`);
  const docs = JSON.parse(readFileSync("docs/md/module-types.json", "utf8")) as Record<
    string,
    ModuleDocs
  >;
  writeFileSync(
    output,
    text
      .replace(MARKER, renderTypes(readFileSync(prelude, "utf8")))
      .replace(MODULES_MARKER, renderModules(temporaryModuleDescriptions(), docs)),
  );
}
