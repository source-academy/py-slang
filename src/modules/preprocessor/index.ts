import type { PyContext } from '../../cse-machine/py_context';
import type { IOptions } from '../../runner/pyRunner';
import type { PreprocessResult } from '../moduleTypes';
import parseProgramsAndConstructImportGraph from './linker';
import loadSourceModules from '../loader';
import { analyzeImports } from './analyzer';
import { StmtNS } from '../../ast-types';
import { bundleAndBind } from './bundler'; 
import { ModuleConnectionError } from '../errors';

export async function preprocessFileImports(
  program: StmtNS.Stmt,
  entrypointFilePath: string,
  context: PyContext,
  options: IOptions
): Promise<PreprocessResult> {

  const linkerResult = await parseProgramsAndConstructImportGraph(
    program,
    entrypointFilePath,
    context,
    options.importOptions,
    options.shouldAddFileName
  );

  if (!linkerResult.ok) {
    return linkerResult;
  }

  const { sourceModulesToImport, imports } = linkerResult;

  try {
    await loadSourceModules(sourceModulesToImport, context, options.importOptions?.loadTabs ?? false);

    analyzeImports(imports, context);

    if (context.errors.length > 0) {
        return {
            ok: false,
            error: context.errors[context.errors.length - 1],
            verboseErrors: false
        }
    }

    bundleAndBind(context, linkerResult);

    return {
      ok: true,
      sourceModulesToImport,
      imports,
      verboseErrors: false
    };
  } catch (error) {
    const newError = new ModuleConnectionError();
    context.errors.push(newError);
    return {
      ok: false,
      error: newError,
      verboseErrors: false
    };
  }
}