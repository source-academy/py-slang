// Extracts typeshed's stdlib/builtins.pyi and stdlib/types.pyi from the worker bundle to
// build/builtins.orig.pyi and build/types.orig.pyi.
const fs = require("fs");
const acorn = require("acorn");
const src = fs.readFileSync(require.resolve("browser-basedpyright/dist/pyright.worker.js"), "utf8");
(function walk(n) {
  if (!n || typeof n.type !== "string") return;
  const m =
    n.type === "Property" &&
    n.key &&
    /^\/typeshed-fallback\/stdlib\/(builtins|types)\.pyi$/.exec(n.key.value);
  if (m) {
    fs.writeFileSync(`build/${m[1]}.orig.pyi`, n.value.value);
    return;
  }
  for (const k in n) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v.type === "string") walk(v);
  }
})(acorn.parse(src, { ecmaVersion: "latest" }));
