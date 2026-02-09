import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError } from '../errors'
import type { ModuleBundle } from '../moduleTypes'

/** Default modules static url. Exported for testing. */
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  console.log('Modules Static URL set to', url)
  MODULES_STATIC_URL = url
}

function wrapImporter<T>(func: (p: string) => Promise<T>) {
  return async (p: string): Promise<T> => {
    try {
      const result = await timeoutPromise(func(p), 10000)
      return result
    } catch (error: any) {
      // Before calling this function, the import analyzer should've been used to make sure
      // that the module being imported already exists, so the following errors should
      // be thrown only if the modules server is unreachable
      if (
        (typeof window !== 'undefined' && error instanceof TypeError) ||
        error.code === 'MODULE_NOT_FOUND' ||
        (process.env.NODE_ENV === 'test' && error.code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME')
      ) {
        throw new ModuleConnectionError()
      }
      throw error
    }
  }
}

function getDocsImporter(): (p: string) => Promise<{ default: object }> {
  async function nodeJsImporter(p: string) {
    try {
      const fs = require('fs');
      const { fileURLToPath } = require('url');
      const filePath = fileURLToPath(p);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(fileContent);
      return { default: json };
    } catch (e) {
      throw new ModuleConnectionError();
    }
  }

  async function fallbackImporter(p: string) {
    const resp = await fetch(p)
    if (resp.status !== 200 && resp.status !== 304) {
      throw new ModuleConnectionError()
    }

    const result = await resp.json()
    return { default: result }
  }

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return nodeJsImporter;
  }

  return fallbackImporter
}

export const docsImporter = wrapImporter<{ default: any }>(getDocsImporter())

function getBundleAndTabImporter(): (p: string) => Promise<{ default: ModuleBundle }> {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return p => import(p)
  }

  // Both window (main thread) and self (web worker) exist in browsers, so check either.
  if (typeof window !== 'undefined' || typeof self !== 'undefined') {
    return new Function('path', 'return import(`${path}?q=${Date.now()}`)') as any
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return p => Promise.resolve(require(p))
}

/*
  Browsers natively support esm's import() but Node does not. So we need
  to change which import function we use based on the environment.

  For the browser, we use the function constructor to hide the import calls from
  webpack so that webpack doesn't try to compile them away.
*/
export const bundleAndTabImporter = wrapImporter(getBundleAndTabImporter())
