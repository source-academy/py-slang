// Prototype: a language-neutral description of the module `rune`, two ways.
//  coarse  = from what the conductor module declares (attachModuleMethod: DataType signatures)
//  precise = from the TypeScript declarations of the module's own functions (the compiler's types)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MODULES = "/Users/henz/Repos/SourceAcademy/modules";
const require = createRequire(join(MODULES, "package.json"));
const ts = require("typescript");
const BUNDLE = join(MODULES, "src/bundles/rune");
const OUT = new URL(".", import.meta.url).pathname;

// ---------- coarse: the conductor plugin ----------
const index = ts.createSourceFile("index.ts", readFileSync(join(BUNDLE, "src/index.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const coarse = { exportedNames: [], signatures: {}, classFields: {} };
(function walk(n) {
  if (ts.isPropertyDeclaration(n) && n.name.getText() === "exportedNames" && n.initializer) {
    let init = n.initializer;
    while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
    if (ts.isArrayLiteralExpression(init)) coarse.exportedNames = init.elements.map(e => e.text);
    else console.log("exportedNames is a", ts.SyntaxKind[init.kind]);
  } else if (ts.isPropertyDeclaration(n) && n.type && n.exclamationToken) {
    coarse.classFields[n.name.getText()] = n.type.getText();
  } else if (ts.isCallExpression(n) && n.expression.getText() === "attachModuleMethod" && n.arguments.length === 4) {
    const [, name, args, ret] = n.arguments;
    coarse.signatures[name.text] = { params: args.elements.map(a => a.getText().replace("DataType.", "")), returns: ret.getText().replace("DataType.", "") };
  }
  ts.forEachChild(n, walk);
})(index);

// ---------- precise: the TypeScript declarations ----------
const cfgPath = join(BUNDLE, "tsconfig.json");
const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); } });
const functionsFile = join(BUNDLE, "src/functions.ts");
const program = ts.createProgram([functionsFile], { ...cfg.options, noEmit: true, skipLibCheck: true });
const checker = program.getTypeChecker();
const source = program.getSourceFile(functionsFile);
const unknowns = new Set();

function classify(t, decl) {
  const F = ts.TypeFlags;
  if (t.flags & F.Void) return "void";
  if (t.flags & F.NumberLike) return "number";
  if (t.flags & F.StringLike) return "string";
  if (t.flags & F.BooleanLike) return "boolean";
  if (t.isUnion()) {
    const rest = t.types.filter(x => !(x.flags & (F.Undefined | F.Null)));
    if (rest.length === 1) return classify(rest[0], decl);
  }
  const calls = t.getCallSignatures();
  if (calls.length > 0) return { function: describeSignature(calls[0], decl) };
  if (checker.isArrayType(t)) return { array: classify(checker.getTypeArguments(t)[0], decl) };
  const name = (t.aliasSymbol ?? t.symbol)?.name;
  if (name && name !== "__type" && name !== "__object") return { named: name };
  const s = checker.typeToString(t); unknowns.add(s); return { unknown: s };
}
function describeSignature(sig, decl) {
  return {
    params: sig.getParameters().map(p => {
      const d = p.valueDeclaration ?? decl;
      return { name: p.name, optional: !!(d && ts.isParameter(d) && d.questionToken), type: classify(checker.getTypeOfSymbolAtLocation(p, d), d) };
    }),
    returns: classify(sig.getReturnType(), decl),
  };
}
const precise = {};
const moduleSym = checker.getSymbolAtLocation(source);
for (const sym of checker.getExportsOfModule(moduleSym)) {
  const type = checker.getTypeOfSymbolAtLocation(sym, source);
  const calls = type.getCallSignatures();
  precise[sym.name] = calls.length > 0 ? { function: describeSignature(calls[0], sym.valueDeclaration) } : { value: classify(type, sym.valueDeclaration) };
}

writeFileSync(join(OUT, "rune.coarse.json"), JSON.stringify(coarse, null, 2));
writeFileSync(join(OUT, "rune.precise.json"), JSON.stringify({ precise, unknownTypes: [...unknowns] }, null, 2));
console.log("coarse: exportedNames", coarse.exportedNames.length, "| signatures", Object.keys(coarse.signatures).length, "| class fields", Object.keys(coarse.classFields).length);
console.log("precise: exports of functions.ts", Object.keys(precise).length, "| unknown types:", [...unknowns].join("; ") || "none");
