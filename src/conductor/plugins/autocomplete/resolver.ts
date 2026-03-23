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
export const extractEnvironment = (
  iter: TreeCursor,
  pos: number,
  doc: string,
): Environment | null => {
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

export const getNames = (
  tree: Tree,
  doc: string,
  line: number,
  column: number,
  _variant: number,
): AutoCompleteEntry[] => {
  const pos = convertPosToIndex(doc, line - 1, column);
  const node = tree.resolve(pos, -1);
  if (node.type.name !== "VariableName") {
    return [];
  }

  const query = getNodeText(node, doc);

  let env: Environment | null = extractEnvironment(tree.cursor(), pos, doc);
  const entries: AutoCompleteEntry[] = [];
  let score = 1;
  while (env) {
    const symbols = [
      ...env.variables.map(v => ({ name: v, meta: CompletionItemKind.Variable, score: score })),
      ...env.functions.map(f => ({ name: f, meta: CompletionItemKind.Function, score: score })),
    ];
    symbols
      .filter(s => isSubsequence(query, s.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(s => entries.push(s));

    env = env.child;
    score++;
  }
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
