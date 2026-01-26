import * as _ from 'lodash'

import type { PyContext } from '../../cse-machine/py_context'
import * as interpreter from 'js-slang/dist/cse-machine/interpreter'
import * as parser from 'js-slang/dist/parser/parser'
import * as stdlib from 'js-slang/dist/stdlib'
import * as types from 'js-slang/dist/types'
import * as assert from 'js-slang/dist/utils/assert'
import * as stringify from 'js-slang/dist/utils/stringify'

/**
 * Returns a function that simulates the job of Node's `require`. The require
 * provider is then used by Source modules to access the context and js-slang standard
 * library
 */
export const getRequireProvider = (context: PyContext) => (x: string) => {
  const pathSegments = x.split('/')

  const recurser = (obj: Record<string, any>, segments: string[]): any => {
    if (segments.length === 0) return obj
    const currObj = obj[segments[0]]
    if (currObj !== undefined) return recurser(currObj, segments.splice(1))
    throw new Error(`Dynamic require of ${x} is not supported`)
  }

  const exports = {
    'js-slang': {
      dist: {
        stdlib,
        types,
        utils: {
          assert,
          stringify
        },
        parser: {
          parser
        },
        'cse-machine': {
          interpreter
        }
      },
      context
    },
    lodash: _
  }

  return recurser(exports, pathSegments)
}

export type RequireProvider = ReturnType<typeof getRequireProvider>
