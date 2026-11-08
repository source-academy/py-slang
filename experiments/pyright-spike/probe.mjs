import { readFileSync } from "node:fs";
import { createChecker } from "./client.mjs";
const prelude = readFileSync("prelude/__builtins__.pyi", "utf8");
const c = await createChecker({ files: { "__builtins__.pyi": prelude } });
const r = await c.check("p.py", process.argv[2]);
for (const d of r.diagnostics)
  console.log(`sev${d.severity} L${d.range.start.line + 1}: ${d.message}`);
c.close();
