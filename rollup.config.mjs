import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import nodePolyfills from "rollup-plugin-polyfill-node";
import replace from "@rollup/plugin-replace";
import wasm from "@rollup/plugin-wasm";

// Env EVALUATOR is set by scripts/build.ts.
const EVALUATOR = process.env.EVALUATOR;
if (!EVALUATOR) {
  throw new Error("EVALUATOR env var must be set. Use scripts/build.ts.");
}

// @sourceacademy/pynter-wasm's published pynterwasm.js uses
// `require("module").createRequire(import.meta.url)` at module-load time to
// build a `require` it only actually *invokes* inside an `ENVIRONMENT_IS_NODE`
// guard (to lazily require("node:fs") when running under Node) — but building
// that require isn't guarded, so it, and Rollup's own `import.meta.url`
// polyfill for it, both run unconditionally in every environment:
//  1. Rollup can't bundle the Node builtin "module" for a browser target, so
//     it externalizes it; for the IIFE output that means referencing a bare
//     global (`node_module`, Rollup's own sanitized guess — see the "Missing
//     global variable name" build warning) that nothing ever defines, so
//     evaluating `node_module.createRequire(...)` throws `ReferenceError:
//     node_module is not defined`.
//  2. Rollup's IIFE-format polyfill for `import.meta.url` (its
//     `_documentCurrentScript` helper) falls back to reading
//     `document.baseURI` — fine on the browser main thread, but a Worker has
//     no `document` at all, so that throws `ReferenceError: document is not
//     defined` too.
// Either one happens the moment the worker script runs, before the
// conductor's message channels are even wired up, so the failure never
// reaches evaluateChunk()'s try/catch or surfaces anywhere: the whole worker
// just dies, and Pynter hangs forever with no output and no error (confirmed
// live: source-academy.github.io/py-slang's deployed PyPvmlPynterEvaluator.js
// throws this in every browser Worker, even after #339's separate
// wasm-loading fix). The "iife" output is the only one affected — the "cjs"
// output really does run in Node, where both `document` and
// `require("node:module")` are moot/available respectively.
//
// Define both missing globals: a `createRequire` that's safe to *construct*
// but throws if ever actually *called* (which it isn't, in the browser), and
// a `document` stand-in that gets read via
// `(document.currentScript?.tagName === 'SCRIPT' && document.currentScript.src) || new URL(file, document.baseURI).href`
// — the same blob:-URL-as-relative-base problem #339 hit already rules out a
// real `baseURI` (a Worker's own blob: URL can't be used as a base for
// relative resolution — `new URL('x', 'blob:...')` itself throws
// "Invalid URL"). So instead make `currentScript` look like a real <script>
// pointing at the worker's own URL, which short-circuits the `&&` chain
// before that unusable `new URL(...)` fallback is ever reached.
const NODE_MODULE_BROWSER_SHIM_BANNER = [
  'var node_module = { createRequire: function () { return function unavailableRequire() { throw new Error("require() is not available in the browser"); }; } };',
  'if (typeof document === "undefined") { var document = { baseURI: "", currentScript: { tagName: "SCRIPT", src: (typeof location !== "undefined" ? location.href : "") } }; }',
].join("\n");

function plugins() {
  return [
    replace({
      preventAssignment: true,
      values: { __EVALUATOR__: EVALUATOR },
    }),
    commonjs({ include: ["node_modules/**"] }),
    json(),
    // pynterwasm.wasm crossed 100KB a while back (it's now ~103KB), which
    // pushed it over this threshold: above maxFileSize, @rollup/plugin-wasm
    // stops inlining the module as a base64 string and instead emits it as a
    // separate physical asset, fetched at runtime via a bare relative
    // filename (see its browserFilePath template — plain `fetch(filepath)`,
    // no base URL). That relative fetch resolves fine from a normal
    // <script src> or same-origin Worker, but the frontend's conductor
    // runner loads each evaluator bundle into a Worker constructed from a
    // `blob:` object URL — and a relative URL cannot be resolved against a
    // blob: base at all (`fetch("x.wasm")` there throws synchronously:
    // "Failed to parse URL from x.wasm"). Emscripten's generated
    // createWasm() invokes instantiateWasm inside its own try/catch, which
    // swallows that throw instead of rejecting anything, so neither the
    // module's ready-promise nor pynter-wasm.ts's own instantiate-failure
    // race (added for a different, asynchronous failure mode) ever settles
    // — initPynter() hangs forever. Comfortably over pynterwasm.wasm's
    // current size keeps it inlined and avoids the runtime fetch entirely.
    wasm({ maxFileSize: 512 * 1024 }),
    typescript(),
    nodeResolve(),
    nodePolyfills(),
    terser({
      compress: { dead_code: true, passes: 3 },
    }),
  ];
}

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  {
    treeshake: {
      moduleSideEffects: false,
    },
    input: "src/conductor/initialise.ts",
    output: {
      file: `dist/${EVALUATOR}.js`,
      format: "iife",
      name: "PySlangWorker",
      sourcemap: true,
      // pyodide's own loader uses a dynamic import() for a Node-only path;
      // a single-file iife bundle can't code-split it out, so inline it.
      inlineDynamicImports: true,
      banner: NODE_MODULE_BROWSER_SHIM_BANNER,
    },
    plugins: plugins(),
  },
  {
    treeshake: {
      moduleSideEffects: false,
    },
    input: "src/conductor/evaluator.ts",
    output: {
      file: `dist/${EVALUATOR}.cjs`,
      format: "cjs",
      exports: "default",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: plugins(),
  },
];

export default config;
