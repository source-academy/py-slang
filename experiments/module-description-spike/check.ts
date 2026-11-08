import { readFileSync } from "node:fs";
import { PyrightClient } from "/Users/henz/Repos/SourceAcademy/py-slang-typed-p1/src/typecheck/client";
import { tidy, toTypeDiagnostic } from "/Users/henz/Repos/SourceAcademy/py-slang-typed-p1/src/typecheck/diagnostics";
import { nodeWorkerFactory } from "/Users/henz/Repos/SourceAcademy/py-slang-typed-p1/src/typecheck/node-worker";

const P = "/private/tmp/claude-502/-Users-henz-Repos-SourceAcademy-py-slang/df912b62-ff3c-4be6-a201-3de718355823/scratchpad/module-description-prototype/";
const programs: [string, string][] = [
  ["correct: shapes and combinators", "from rune import heart, circle, beside, stack, show\nshow(stack(beside(heart, circle), circle))\n"],
  ["correct: a callback that returns a rune", "from rune import animate_rune, heart, rotate\nanimate_rune(1, 20, lambda t: rotate(t, heart))\n"],
  ["mistake: a number where a rune is wanted", "from rune import heart, beside, show\nshow(beside(heart, 3))\n"],
  ["mistake: show of a number", "from rune import show\nshow(5)\n"],
  ["mistake: the callback returns a number", "from rune import animate_rune\nanimate_rune(1, 20, lambda t: t * 2)\n"],
  ["mistake: the callback takes no argument", "from rune import animate_rune, heart\nanimate_rune(1, 20, lambda: heart)\n"],
  ["mistake: a rune where a number is wanted", "from rune import heart, scale\nscale(heart, heart)\n"],
  ["mistake: a name the module does not have", "from rune import heart, flower\nflower\n"],
];
async function main() {
  for (const kind of ["coarse", "precise"]) {
    const client = await PyrightClient.start(nodeWorkerFactory("/Users/henz/Repos/SourceAcademy/py-slang-typed-p1/dist/TypedPy4Checker.js"), {
      "rune.pyi": readFileSync(`${P}rune.${kind}.pyi`, "utf8"),
    });
    console.log(`\n=== stub generated from the ${kind.toUpperCase()} description`);
    for (const [label, code] of programs) {
      const ds = tidy((await client.check("main.py", code)).map(d => toTypeDiagnostic(d))).filter(d => d.severity === "error");
      console.log(`${ds.length ? "REJECTED" : "accepted"}  ${label}${ds.length ? "\n            -> " + ds.map(d => `L${d.line}: ${d.message}`).join("\n            -> ") : ""}`);
    }
    client.dispose();
  }
}
main();
