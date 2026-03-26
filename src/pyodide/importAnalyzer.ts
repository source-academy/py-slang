/**
 * AST-based import analysis for detecting and rewriting torch imports.
 *
 * Uses py-slang's parser to produce an AST from the import prefix of the
 * source, then walks FromImport nodes to find torch-related imports —
 * replacing the regex-based approach used in sa-conductor-py-torch.
 *
 * Because pyodide code uses full Python syntax that py-slang cannot parse,
 * we extract only the leading `from … import …` lines, append a dummy
 * statement so the grammar is satisfied, and parse that fragment.
 */

import { parse } from "../parser/parser-adapter";
import { StmtNS } from "../ast-types";

export interface TorchImportInfo {
  /** Full module path, e.g. "torch" or "torch.nn" */
  module: string;
  /** Imported names with optional aliases */
  names: { name: string; alias: string | null }[];
  /** 1-based line number in the original source */
  line: number;
}

/**
 * Extracts leading `from … import …` lines from the source and returns
 * them along with the line index where non-import code begins.
 */
function extractImportPrefix(source: string): {
  importLines: string[];
  bodyStartIdx: number;
} {
  const lines = source.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("from ") && trimmed.includes(" import ")) continue;
    break;
  }
  return { importLines: lines.slice(0, i), bodyStartIdx: i };
}

/**
 * Parses only the import prefix of the source using py-slang's parser
 * and returns all FromImport nodes whose root module is "torch".
 */
export function detectTorchImports(source: string): TorchImportInfo[] {
  const { importLines } = extractImportPrefix(source);
  if (importLines.length === 0) return [];

  // Append a dummy statement so the grammar (import* statement*) is satisfied.
  const fragment = importLines.join("\n") + "\n_ = 0\n";

  let ast: StmtNS.FileInput;
  try {
    ast = parse(fragment);
  } catch {
    return [];
  }

  const torchImports: TorchImportInfo[] = [];

  for (const stmt of ast.statements) {
    if (!(stmt instanceof StmtNS.FromImport)) continue;

    const moduleName = stmt.module.lexeme;
    const root = moduleName.split(".")[0];
    if (root !== "torch") continue;

    torchImports.push({
      module: moduleName,
      names: stmt.names.map(n => ({
        name: n.name.lexeme,
        alias: n.alias ? n.alias.lexeme : null,
      })),
      line: stmt.startToken.line,
    });
  }

  return torchImports;
}

/**
 * Returns the set of top-level module roots for all non-torch imports.
 * These are modules that should be installed via micropip.
 */
export function getNonTorchImportRoots(source: string): Set<string> {
  const { importLines } = extractImportPrefix(source);
  if (importLines.length === 0) return new Set();

  const fragment = importLines.join("\n") + "\n_ = 0\n";

  let ast: StmtNS.FileInput;
  try {
    ast = parse(fragment);
  } catch {
    return new Set();
  }

  const roots = new Set<string>();
  for (const stmt of ast.statements) {
    if (!(stmt instanceof StmtNS.FromImport)) continue;
    const root = stmt.module.lexeme.split(".")[0];
    if (root !== "torch") {
      roots.add(root);
    }
  }
  return roots;
}

/**
 * Generates Python assignment code that replaces a torch import statement.
 *
 * Example:
 *   from torch.nn import Linear as L, Conv2d
 *   →  L = __sa_import_torch.nn.Linear
 *      Conv2d = __sa_import_torch.nn.Conv2d
 */
function generateReplacement(imp: TorchImportInfo): string {
  const injected = "__sa_import_torch";
  const subparts = imp.module.split(".").slice(1);
  const base = subparts.length > 0 ? `${injected}.${subparts.join(".")}` : injected;

  return imp.names
    .map(({ name, alias }) => {
      const binding = alias ?? name;
      return `${binding} = ${base}.${name}`;
    })
    .join("\n");
}

/**
 * Rewrites the source code by replacing torch import lines with
 * variable assignments that reference the injected `__sa_import_torch` global.
 *
 * Non-torch code is passed through unchanged.
 */
export function rewriteTorchImports(source: string): {
  code: string;
  hasTorch: boolean;
} {
  const imports = detectTorchImports(source);

  if (imports.length === 0) {
    return { code: source, hasTorch: false };
  }

  const lines = source.split(/\r?\n/);

  // Process in reverse order so earlier line indices stay valid.
  for (let i = imports.length - 1; i >= 0; i--) {
    const imp = imports[i];
    const replacement = generateReplacement(imp);
    const idx = imp.line - 1;
    lines.splice(idx, 1, replacement);
  }

  return { code: lines.join("\n"), hasTorch: true };
}
