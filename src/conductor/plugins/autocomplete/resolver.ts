import { SyntaxNode, Tree, TreeCursor } from "@lezer/common";
import { AutoCompleteEntry, CompletionItemKind } from "./types";

import mathJSON from "./builtins/math.json";
import miscJSON from "./builtins/misc.json";

type Environment = {
  variables: string[];
  functions: string[];
  child: Environment | null;
};

const getNodeText = (node: SyntaxNode, doc: string): string => {
  return doc.slice(node.from, node.to);
};

function isCompletionItemKind(value: string): value is CompletionItemKind {
  return Object.values(CompletionItemKind).includes(value as CompletionItemKind);
}

/**
 * The extractEnvironment function traverses the syntax tree from the given position downwards to collect variable and function names in scope.
 * It returns an Environment object representing the current scope and its child scope unless the position is inside a function parameter list, in which case it returns null.
 *
 * @param iter The TreeCursor used to traverse the syntax tree
 * @param pos The 0-based index position in the document for which to extract the environment
 * @param doc The document text, used to extract variable and function names from the syntax nodes
 * @returns The Environment object representing the current scope and its child scopes, or null if the position is inside a function parameter list
 */
const extractEnvironment = (iter: TreeCursor, pos: number, doc: string): Environment | null => {
  const topEnv: Environment = {
    variables: [],
    functions: [],
    child: null,
  };

  let currentEnv = topEnv;
  while (iter) {
    if (iter.node.type.name === "ParamList") {
      return null;
    }
    if (iter.node.type.name == "FunctionDefinition" || iter.node.type.name == "LambdaExpression") {
      // Add function parameters to inner environment
      const params = iter.node.getChild("ParamList");
      if (params) {
        for (let param = params.firstChild; param; param = param.nextSibling) {
          if (param.type.name === "VariableName") {
            currentEnv.variables.push(getNodeText(param, doc));
          }
        }
      }
      if (!iter.enter(pos, -1)) {
        break;
      }
      continue;
    }
    if (iter.node.type.name !== "Block" && iter.node.type.name !== "Script") {
      if (!iter.enter(pos, -1)) {
        break;
      }
      continue;
    }
    // Iterate children
    for (let child = iter.node.firstChild; child; child = child.nextSibling) {
      // Assignment → variable
      if (child.type.name === "AssignStatement") {
        const left = child.firstChild;
        if (
          left &&
          left.type.name === "VariableName" &&
          (left.from != iter.node.from || left.to != iter.node.to)
        ) {
          currentEnv.variables.push(getNodeText(left, doc));
        }
      }

      // Function
      if (child.type.name === "FunctionDefinition") {
        const nameNode = child.getChild("VariableName");
        if (nameNode) {
          currentEnv.functions.push(getNodeText(nameNode, doc));
        }
      }
    }
    const nextEnv = {
      variables: [],
      functions: [],
      child: null,
    };
    currentEnv.child = nextEnv;
    currentEnv = nextEnv;

    if (!iter.enter(pos, -1)) {
      break;
    }
  }
  return topEnv;
};

/**
 * Checks if `sub` is a subsequence of `str`, meaning all characters of `sub` appear in `str` in the same order, but not necessarily contiguously.
 * @param sub The subsequence to check
 * @param str The string to check against
 * @returns true if `sub` is a subsequence of `str`, false otherwise
 */
const isSubsequence = (sub: string, str: string): boolean => {
  let i = 0;
  for (const char of str) {
    if (char === sub[i]) {
      i++;
    }
    if (i === sub.length) {
      return true;
    }
  }
  return false;
};

/**
 * Converts a 1-based line and column number to a 0-based index in the document string. If the line or column is out of bounds,
 * it returns the closest valid index (e.g. end of document).
 *
 * @param doc The document text
 * @param line The 1-based line number
 * @param column The 1-based column number
 * @returns The 0-based index in the document string corresponding to the given line and column, or the closest valid index if out of bounds
 */
const convertPosToIndex = (doc: string, line: number, column: number): number => {
  let pos = 0;
  while (line > 0) {
    const newlineIndex = doc.indexOf("\n", pos);
    if (newlineIndex === -1) {
      return doc.length;
    }
    pos = newlineIndex + 1;
    line--;
  }
  return pos + column;
};

/**
 * Gets the names of variables and functions in scope at the given position in the document,
 * as well as built-in functions, variables and keywords.
 * @param tree The syntax tree of the document, created using Lezer
 * @param doc The document text
 * @param line The 1-based line number of the cursor position
 * @param column The 1-based column number of the cursor position
 * @param variant The variant of the language
 * @returns a list of autocomplete entries, each containing the name, type (variable or function), and documentation (for built-ins)
 */
export const getNames = (
  tree: Tree,
  doc: string,
  line: number,
  column: number,
  _variant: number,
): AutoCompleteEntry[] => {
  const pos = convertPosToIndex(doc, line - 1, column); // Convert position to 0-based index
  const node = tree.resolve(pos, -1); // Get the syntax node ending at the cursor position
  if (node.type.name !== "VariableName") {
    return [];
  }

  const query = getNodeText(node, doc);

  let env: Environment | null = extractEnvironment(tree.cursor(), pos, doc);

  const entries: AutoCompleteEntry[] = [];
  let score = 1; // The score is used to prioritize suggestions from inner scopes over outer scopes. Built-ins will have the lowest score.
  while (env) {
    const symbols = [
      ...env.variables.map(v => ({ name: v, meta: CompletionItemKind.Variable, score: score })),
      ...env.functions.map(f => ({ name: f, meta: CompletionItemKind.Function, score: score })),
    ];
    // Filter symbols based on query, sort alphabetically, and add to entries
    symbols
      .filter(s => isSubsequence(query, s.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(s => entries.push(s));

    env = env.child;
    score++;
  }

  // TODO: Add keywords to autocomplete suggestions
  // TODO: Add docstrings for user-defined functions to autocomplete suggestions?
  // TODO: Add documentation for otherbuilt-ins, not just math and misc modules
  const symbols = [...miscJSON, ...mathJSON].map(v => ({
    name: v.name,
    meta: isCompletionItemKind(v.meta) ? v.meta : CompletionItemKind.Variable,
    docHTML: "<h4>" + v.title + "</h4><p>" + v.description + "</p>",
  }));
  symbols
    .filter(s => isSubsequence(query, s.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(s => entries.push(s));

  return entries;
};
