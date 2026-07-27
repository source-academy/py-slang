/**
 * @sourceacademy/conductor only declares `import` conditions in its exports
 * map, so requiring its subpaths fails under tsx's CJS transform (jest solves
 * this with moduleNameMapper — see jest.config.js). Import this module FIRST
 * in any standalone experiment script that (transitively) pulls in the CSE
 * machine: it rewrites the subpath requests to the concrete dist files, which
 * Node >= 20.19 can require() directly despite being ESM.
 */
import Module from "module";
import path from "path";

const distRoot = path.join(__dirname, "../../node_modules/@sourceacademy/conductor/dist");

const aliases: Record<string, string> = {
  "@sourceacademy/conductor/common": path.join(distRoot, "common/index.js"),
  "@sourceacademy/conductor/conduit": path.join(distRoot, "conduit/index.js"),
  "@sourceacademy/conductor/module": path.join(distRoot, "conductor/module/index.js"),
  "@sourceacademy/conductor/runner": path.join(distRoot, "conductor/runner/index.js"),
  "@sourceacademy/conductor/types": path.join(distRoot, "conductor/types/index.js"),
};

const moduleInternals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const originalResolve = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  return originalResolve.call(this, aliases[request] ?? request, ...rest);
};
