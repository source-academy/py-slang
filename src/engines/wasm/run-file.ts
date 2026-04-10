import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileToWasmAndRun } from "./index";

(async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: yarn wasm <path-to-python-file>");
    process.exit(1);
  }

  const { prints } = await compileToWasmAndRun(readFileSync(resolve(filePath), "utf8"));
  prints.forEach(p => console.log(p));
})();
