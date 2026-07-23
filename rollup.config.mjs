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
