// Builds a trimmed copy of the worker bundle by deleting typeshed entries from the embedded
// file map.  Usage: node trim.cjs <out.js> [stdlib-keep-list.txt]
//   without a keep list: drop third-party stubs (stubs/…) only
//   with a keep list:    also drop every stdlib file not matching a line prefix in the list
const fs = require("fs");
const acorn = require("acorn");
const src = fs.readFileSync(require.resolve("browser-basedpyright/dist/pyright.worker.js"), "utf8");
const [out, keepFile] = process.argv.slice(2);
const keep = keepFile
  ? fs
      .readFileSync(keepFile, "utf8")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
  : null;
const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script" });
const cuts = [];
(function walk(n) {
  if (!n || typeof n.type !== "string") return;
  if (
    n.type === "ObjectExpression" &&
    n.properties.length > 100 &&
    n.properties.some(
      p =>
        p.key && typeof p.key.value === "string" && p.key.value.startsWith("/typeshed-fallback/"),
    )
  ) {
    for (let i = 0; i < n.properties.length; i++) {
      const p = n.properties[i];
      const k = p.key && p.key.value;
      if (typeof k !== "string" || !k.startsWith("/typeshed-fallback/")) continue;
      const rel = k.slice("/typeshed-fallback/".length);
      let drop = rel.startsWith("stubs/");
      if (!drop && keep && rel.startsWith("stdlib/") && rel !== "stdlib/VERSIONS")
        drop = !keep.some(pre => rel.slice("stdlib/".length).startsWith(pre));
      if (drop) {
        const end = i + 1 < n.properties.length ? n.properties[i + 1].start : p.end;
        cuts.push([p.start, end]);
      }
    }
    return;
  }
  for (const key in n) {
    const v = n[key];
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v.type === "string") walk(v);
  }
})(ast);
cuts.sort((a, b) => b[0] - a[0]);
let s = src;
for (const [a, b] of cuts) s = s.slice(0, a) + s.slice(b);
s = s.replace(/,(\s*)}/g, (m, ws, off) => m); // trailing comma after last cut is legal JS anyway
fs.writeFileSync(out, s);
console.log(
  `dropped ${cuts.length} files; ${(src.length / 1e6).toFixed(2)} MB -> ${(s.length / 1e6).toFixed(2)} MB`,
);
