import type { PyContext } from '../../cse-machine/py_context';
import { UndefinedImportError } from '../errors';
import type { ModuleFunctions } from '../moduleTypes';

/**
 * Analyzes the imported names against the currently loaded modules.
 * If an imported name does not exist in the module, it adds an error to the context.
 *
 * @param imports A map from module names to the specific names imported from them.
 * @param context The current PyContext, containing loadedModules.
 */
export function analyzeImports(imports: Map<string, Array<{ name: string; alias: string | null }>>, context: PyContext): void {
  for (const [moduleName, importedItems] of imports.entries()) {
    const loadedModule: ModuleFunctions | undefined = context.nativeStorage.loadedModules[moduleName];

    if (!loadedModule) {
      continue;
    }

    for (const item of importedItems) {
      const name = item.name;
      if (name === '*') {
        // 'import *' means all exports are implicitly requested
        // The analyzer cannot validate individual names here, so we skip.
        continue;
      }
      if (!(Object.prototype.hasOwnProperty.call(loadedModule, name))) {
        // throws error if a specific imported name is not found in the loaded module
        context.errors.push(new UndefinedImportError(name, moduleName));
      }
    }
  }
}

export interface ImportAnalysisOptions {}
