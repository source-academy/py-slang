
import type { PyContext } from '../../cse-machine/py_context';
import { Token } from '../../tokenizer';
import { memoizedGetModuleManifestAsync } from '../loader/loaders';
import type { FileGetter, LinkerResult } from '../moduleTypes';
import { StmtNS } from '../../ast-types';
import { SourceError } from '../../errors/base';
import FileInput = StmtNS.FileInput;
import FromImport = StmtNS.FromImport;
import { TokenType } from '../../tokens';
import { ModuleNotFoundError } from '../errors';

export interface ImportResolutionOptions {}
export const defaultResolutionOptions: ImportResolutionOptions = {}

export interface LinkerOptions {
  resolverOptions: ImportResolutionOptions
}
export const defaultLinkerOptions: LinkerOptions = {
  resolverOptions: defaultResolutionOptions
}

export default async function parseProgramsAndConstructImportGraph(
  program: StmtNS.Stmt,
  entrypointFilePath: string,
  context: PyContext,
  options: Partial<LinkerOptions> = defaultLinkerOptions,
  shouldAddFileName?: boolean
): Promise<LinkerResult> {
  const sourceModulesToImport = new Set<string>()
  const imports: Map<string, Array<{ name: string, alias: string | null }>> = new Map()

  const manifest = await memoizedGetModuleManifestAsync();
  const availableModuleNames = Object.keys(manifest);

  if (program instanceof FileInput) {
    for (const stmt of program.statements) {
      if (stmt instanceof FromImport) {
        const moduleName = stmt.module.lexeme;
        if (availableModuleNames.includes(moduleName)) {
          sourceModulesToImport.add(moduleName);

          let currentModuleImports: Array<{ name: string, alias: string | null }> = imports.get(moduleName) || [];
          imports.set(moduleName, currentModuleImports);
          
          for (let i = 0; i < stmt.names.length; i++) {
            const nameToken = stmt.names[i];
            let aliasToken: Token | null = null;

            if (i + 1 < stmt.names.length && stmt.names[i + 1].type === TokenType.AS) {
                aliasToken = stmt.names[i + 2];
                i += 2;
            }
            currentModuleImports.push({ name: nameToken.lexeme, alias: aliasToken ? aliasToken.lexeme : null });
          }
        } else {
          context.errors.push(new ModuleNotFoundError(moduleName, stmt));
          continue;
        }
      }
    }
  }

  return {
    ok: true,
    topoOrder: [entrypointFilePath],
    programs: {},
    sourceModulesToImport,
    imports,
    verboseErrors: false
  }
}
