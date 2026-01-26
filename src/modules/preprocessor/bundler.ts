import { PyContext } from '../../cse-machine/py_context';
import { JSValue } from '../../cse-machine/py_closure';
import { getGlobalEnvironment } from '../../cse-machine/py_environment';
import { pyDefineVariable } from '../../cse-machine/py_utils';
import { LinkerResult } from '../moduleTypes';
import { Value } from '../../cse-machine/stash';
import { CseError } from '../../cse-machine/error';

/**
 * Binds imported foreign values (JS functions/constants) to the global environment.
 * This function runs after the loader and analyzer, but before the CSE machine.
 *
 * @param context The PyContext containing loaded modules and the runtime environment.
 * @param linkerResult The result from the linker, containing import information.
 */
export function bundleAndBind(context: PyContext, linkerResult: LinkerResult): void {
  if (!linkerResult.ok) {
    return;
  }

  const globalEnv = getGlobalEnvironment(context);

  if (!globalEnv) {
    context.errors.push(new CseError('Internal Error: Global environment not found during bundling.'));
    return;
  }

  const { imports } = linkerResult;

  imports.forEach((importedItems, moduleName) => {
    const loadedModule = context.nativeStorage.loadedModules[moduleName];

    if (!loadedModule) {
      context.errors.push(new CseError(`Internal Error: Module '${moduleName}' not found after loading.`));
      return;
    }

    importedItems.forEach(({ name, alias }) => {
      const bindingName = alias || name;
      const rawJsValue: Value = loadedModule[name];

      if (rawJsValue === undefined) {
          context.errors.push(new CseError(`Internal Error: Member '${name}' not found in module '${moduleName}'.`));
          return;
      }

      const jsValue = new JSValue(rawJsValue, bindingName);
      pyDefineVariable(context, bindingName, jsValue, globalEnv);
    });
  });
}