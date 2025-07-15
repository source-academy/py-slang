import { Context } from './cse-machine/context';
import { importBuiltins } from './stdlib/index';
import { importPrelude } from './stdlib/preludes';
import { Chapter } from './stdlib/index';

// Re-export Chapter type for external use
export { Chapter };

// External builtins that might be loaded from external sources
const externalBuiltIns: Record<string, any> = {
  // Add external builtins here when needed
};

// External symbols that might be loaded from modules
const externalSymbols: Record<string, any> = {
  // Add external symbols here when needed
};

/**
 * Creates a context for a specific chapter and variant
 * @param chapter The chapter number (1-4) or 'LIBRARY_PARSER'
 * @param variant The variant (not used in current implementation)
 * @returns A new Context with all necessary builtins and preludes loaded
 */
export function createContext(chapter: Chapter, variant: string = 'default'): Context {
  const context = new Context();
  
  // Import builtins for the specific chapter
  importBuiltins(context, chapter);
  
  // Import external builtins
  importExternalBuiltIns(context, externalBuiltIns);
  
  // Import preludes and load them into the environment
  const preludeCode = importPrelude(context, typeof chapter === 'number' ? chapter : 4);
  if (preludeCode) {
    context.prelude = preludeCode;
    // Load the prelude code into the environment
    loadPreludeIntoEnvironment(context, preludeCode);
  }
  
  // Import external symbols
  importExternalSymbols(context, externalSymbols);
  
  return context;
}

/**
 * Imports external builtins into the context
 */
function importExternalBuiltIns(context: Context, externalBuiltIns: Record<string, any>) {
  for (const [name, func] of Object.entries(externalBuiltIns)) {
    context.nativeStorage.builtins.set(name, func);
  }
}

/**
 * Imports external symbols into the context
 */
function importExternalSymbols(context: Context, externalSymbols: Record<string, any>) {
  for (const [name, value] of Object.entries(externalSymbols)) {
    context.nativeStorage.builtins.set(name, value);
  }
}

/**
 * Creates an empty context without any builtins or preludes
 * Useful for testing or when you want to load everything manually
 */
export function createEmptyContext(chapter: Chapter, variant: string = 'default'): Context {
  return new Context();
}

/**
 * Loads modules from a server (similar to js-slang's module loading)
 * @param context The context to load modules into
 * @param serverUrl The URL of the module server
 */
export async function loadModulesFromServer(context: Context, serverUrl: string) {
  try {
    // This would implement the actual module loading logic
    // For now, it's a placeholder
    console.log(`Loading modules from ${serverUrl}`);
  } catch (error) {
    console.error('Failed to load modules from server:', error);
  }
}

/**
 * Loads a specific module by name
 * @param context The context to load the module into
 * @param moduleName The name of the module to load
 */
export async function loadModule(context: Context, moduleName: string) {
  try {
    // This would implement the actual module loading logic
    // For now, it's a placeholder
    console.log(`Loading module: ${moduleName}`);
  } catch (error) {
    console.error(`Failed to load module ${moduleName}:`, error);
  }
}

/**
 * Loads prelude code into the environment by parsing and evaluating it
 * @param context The context to load the prelude into
 * @param preludeCode The prelude code to load
 */
function loadPreludeIntoEnvironment(context: Context, preludeCode: string) {
  try {
    // Import the necessary modules for parsing and evaluation
    const { parsePythonToEstreeAst } = require('./index');
    const { runCSEMachine } = require('./runner/pyRunner');
    
    // Parse the prelude code
    const preludeAst = parsePythonToEstreeAst(preludeCode, 1, true);
    
    // Run the prelude code in the context
    const result = runCSEMachine(preludeCode, preludeAst, context, { isPrelude: true });
    
    console.log('Prelude loaded successfully');
  } catch (error) {
    console.error('Failed to load prelude into environment:', error);
  }
} 