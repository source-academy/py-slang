// Runs every cases/*.py through the checker and compares reported lines with `# E` markers.
//   # E        an error is expected on this line
//   # E?       an error is welcome but not required (recorded as "bonus" / "missed?")
//   # E(line N) an error is expected on line N
//   # S        Source-specific rule (py-slang rejects at runtime); records whether pyright catches it
import { readFileSync, readdirSync } from "node:fs";
import { createChecker } from "./client.mjs";

const prelude = readFileSync(new URL("./prelude/__builtins__.pyi", import.meta.url), "utf8");
const mode = process.argv[2] ?? "standard";
const checker = await createChecker({
  files: {
    "__builtins__.pyi": prelude,
    ...(process.env.SOURCE_BUILTINS
      ? {
          "/typeshed-fallback/stdlib/builtins.pyi": readFileSync(
            new URL("./build/builtins.source.pyi", import.meta.url),
            "utf8",
          ),
          "/typeshed-fallback/stdlib/types.pyi": readFileSync(
            new URL("./build/types.source.pyi", import.meta.url),
            "utf8",
          ),
        }
      : {}),
  },
  config: { typeCheckingMode: mode, ...JSON.parse(process.env.CONFIG ?? "{}") },
});
console.log(`mode=${mode}  startup ${checker.startupMs.toFixed(0)} ms`);

const dir = new URL("./cases/", import.meta.url);
const only = process.argv[3];
for (const name of readdirSync(dir)
  .filter(f => f.endsWith(".py") && (!only || f.includes(only)))
  .sort()) {
  const text = readFileSync(new URL(name, dir), "utf8");
  const lines = text.split("\n");
  const must = new Set(),
    may = new Set(),
    src = new Set();
  lines.forEach((l, i) => {
    const m = l.match(/#\s*(E\?|E\(line (\d+)\)|E|S\??)(\s|$)/);
    if (!m) return;
    if (m[2]) must.add(Number(m[2]));
    else if (m[1] === "E") must.add(i + 1);
    else if (m[1] === "E?") may.add(i + 1);
    else src.add(i + 1);
  });
  const { diagnostics, ms } = await checker.check(name, text);
  const errs = diagnostics.filter(d => d.severity === 1);
  const got = new Map();
  for (const d of errs) {
    const ln = d.range.start.line + 1;
    got.set(ln, [...(got.get(ln) ?? []), d.message.split("\n")[0]]);
  }
  // `# typed: rejected` on the first line: under the Typed §4 rules (CONFIG set) the file is not a
  // Typed §4 program at all; it passes when it is rejected, wherever the errors are.
  if (process.env.CONFIG && lines[0].includes("typed: rejected")) {
    console.log(
      `\n── ${name}  (${ms.toFixed(0)} ms, ${errs.length} errors)  not Typed §4: => ${errs.length > 0 ? "PASS (rejected)" : "FAIL (accepted)"}`,
    );
    continue;
  }
  const missed = [...must].filter(l => !got.has(l));
  const unexpected = [...got.keys()].filter(l => !must.has(l) && !may.has(l) && !src.has(l));
  console.log(
    `\n── ${name}  (${ms.toFixed(0)} ms, ${errs.length} errors, ${diagnostics.length - errs.length} other)`,
  );
  for (const [ln, msgs] of [...got].sort((a, b) => a[0] - b[0])) {
    const tag = must.has(ln) ? "ok  " : may.has(ln) ? "bonus" : src.has(ln) ? "S-hit" : "FP  ";
    for (const m of msgs) console.log(`  ${tag} L${ln}: ${m}`);
  }
  for (const ln of missed) console.log(`  MISS L${ln}: ${lines[ln - 1].trim()}`);
  for (const ln of may) if (!got.has(ln)) console.log(`  miss? L${ln}: ${lines[ln - 1].trim()}`);
  for (const ln of src) if (!got.has(ln)) console.log(`  S-miss L${ln}: ${lines[ln - 1].trim()}`);
  if (process.env.SHOW_WARN)
    for (const d of diagnostics.filter(d => d.severity !== 1))
      console.log(`  (sev${d.severity}) L${d.range.start.line + 1}: ${d.message.split("\n")[0]}`);
  console.log(
    `  => ${missed.length === 0 && unexpected.length === 0 ? "PASS" : `FAIL (missed ${missed.length}, false positives ${unexpected.length})`}`,
  );
}
checker.close();
