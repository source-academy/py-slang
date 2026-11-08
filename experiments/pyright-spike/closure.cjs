// Computes the transitive import closure of the given stdlib stub modules (from the bundle's
// embedded typeshed) and writes it as a keep list for trim.cjs.
const fs = require("fs");
const acorn = require("acorn");
const src = fs.readFileSync(require.resolve("browser-basedpyright/dist/pyright.worker.js"), "utf8");
const ast = acorn.parse(src, { ecmaVersion: "latest" });
const files = {};
(function walk(n) {
  if (!n || typeof n.type !== "string") return;
  if (
    n.type === "Property" &&
    n.key &&
    typeof n.key.value === "string" &&
    n.key.value.startsWith("/typeshed-fallback/stdlib/")
  ) {
    files[n.key.value.slice("/typeshed-fallback/stdlib/".length)] = n.value.value ?? "";
    return;
  }
  for (const k in n) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v.type === "string") walk(v);
  }
})(ast);
const modFile = m => {
  const p = m.replace(/\./g, "/");
  return [`${p}.pyi`, `${p}/__init__.pyi`].find(f => f in files);
};
const roots = process.argv.slice(2);
const seen = new Set();
const queue = roots.map(modFile).filter(Boolean);
while (queue.length) {
  const f = queue.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const pkg = f.replace(/(\/__init__)?\.pyi$/, "").replace(/\//g, ".");
  const isInit = f.endsWith("__init__.pyi");
  for (const line of files[f].split(/\r?\n/)) {
    let m = line.match(/^\s*from\s+(\.*)([\w.]*)\s+import\s+(.*)/);
    let mods = [];
    if (m) {
      let base = m[2];
      if (m[1]) {
        const parts = pkg.split(".");
        const up = m[1].length - (isInit ? 1 : 0);
        base = [...parts.slice(0, parts.length - up), ...(m[2] ? [m[2]] : [])].join(".");
      }
      mods.push(base);
      for (const name of m[3].replace(/[()]/g, "").split(","))
        mods.push(`${base}.${name.trim().split(/\s+/)[0]}`);
    } else if ((m = line.match(/^\s*import\s+(.*)/))) {
      for (const part of m[1].split(",")) mods.push(part.trim().split(/\s+/)[0]);
    }
    for (const mod of mods) {
      // include parent packages too
      const ps = mod.split(".");
      for (let i = 1; i <= ps.length; i++) {
        const g = modFile(ps.slice(0, i).join("."));
        if (g && !seen.has(g)) queue.push(g);
      }
    }
  }
}
const bytes = [...seen].reduce((a, f) => a + files[f].length, 0);
console.error(
  `${seen.size} of ${Object.keys(files).length} stdlib files, ${(bytes / 1e6).toFixed(2)} MB`,
);
console.log([...seen].sort().join("\n"));
