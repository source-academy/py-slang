import { Value } from '../cse-machine/stash'

const MAX_LIST_DISPLAY_LENGTH = 100

/**
 * Converts a number to a string that mimics Python's float formatting behavior.
 */
function toPythonFloat(num: number): string {
  if (Object.is(num, -0)) {
    return '-0.0'
  }
  if (num === 0) {
    return '0.0'
  }

  if (num === Infinity) {
    return 'inf'
  }
  if (num === -Infinity) {
    return '-inf'
  }

  if (Number.isNaN(num)) {
    return 'nan'
  }

  if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
    return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2')
  }
  if (Number.isInteger(num)) {
    return num.toFixed(1).toString()
  }
  return num.toString()
}

/**
 * Escapes a string for Python's repr representation.
 */
function escape(str: string): string {
  let escaped = JSON.stringify(str)
  if (!(str.includes("'") && !str.includes('"'))) {
    escaped = `'${escaped.slice(1, -1).replace(/'/g, "\\'").replace(/\\"/g, '"')}'`
  }
  return escaped
}

/**
 * Port of js-slang's stringify for py-slang.
 * Provides structured (indented) output for nested lists.
 */
export const stringify = (
  value: Value,
  indent: number | string = 2,
  splitlineThreshold = 80
): string => {
  if (typeof indent === 'string') {
    throw new Error('stringify with arbitrary indent string not supported')
  }
  let indentN: number = indent
  if (indent > 10) {
    indentN = 10
  }
  return lineTreeToString(stringDagToLineTree(valueToStringDag(value), indentN, splitlineThreshold))
}

interface TerminalStringDag {
  type: 'terminal'
  str: string
  length: number
}

interface MultilineStringDag {
  type: 'multiline'
  lines: string[]
  length: number
}

interface PairStringDag {
  type: 'pair'
  head: StringDag
  tail: StringDag
  length: number
}

interface ArrayLikeStringDag {
  type: 'arraylike'
  prefix: string
  elems: StringDag[]
  suffix: string
  length: number
}

interface KvPairStringDag {
  type: 'kvpair'
  key: string
  value: StringDag
  length: number
}

type StringDag =
  | TerminalStringDag
  | MultilineStringDag
  | PairStringDag
  | ArrayLikeStringDag
  | KvPairStringDag

export function valueToStringDag(value: Value): StringDag {
  const ancestors: Map<Value, number> = new Map()
  const memo: Map<Value, StringDag> = new Map()

  function convertPair(v: Value): [StringDag, boolean] {
    const memoResult = memo.get(v)
    if (memoResult !== undefined) {
      return [memoResult, false]
    }
    ancestors.set(v, ancestors.size)
    const elems = (v as any).value
    const [headDag, headIsCircular] = convert(elems[0])
    const [tailDag, tailIsCircular] = convert(elems[1])
    const isCircular = headIsCircular || tailIsCircular
    ancestors.delete(v)
    const result: StringDag = {
      type: 'pair',
      head: headDag,
      tail: tailDag,
      length: headDag.length + tailDag.length + 4
    }
    if (!isCircular) {
      memo.set(v, result)
    }
    return [result, isCircular]
  }

  function convertArrayLike(
    v: Value,
    elems: Value[],
    prefix: string,
    suffix: string
  ): [StringDag, boolean] {
    const memoResult = memo.get(v)
    if (memoResult !== undefined) {
      return [memoResult, false]
    }
    ancestors.set(v, ancestors.size)
    const converted = elems.map(convert)
    let length = prefix.length + suffix.length + Math.max(0, converted.length - 1) * 2
    let isCircular = false
    for (let i = 0; i < converted.length; i++) {
      length += converted[i][0].length
      isCircular ||= converted[i][1]
    }
    ancestors.delete(v)
    const result: StringDag = {
      type: 'arraylike',
      elems: converted.map(c => c[0]),
      prefix,
      suffix,
      length
    }
    if (!isCircular) {
      memo.set(v, result)
    }
    return [result, isCircular]
  }

  function convertRepr(repr: string): [StringDag, boolean] {
    const lines: string[] = repr.split('\n')
    return lines.length === 1
      ? [{ type: 'terminal', str: lines[0], length: lines[0].length }, false]
      : [{ type: 'multiline', lines, length: Infinity }, false]
  }

  function convert(v: Value): [StringDag, boolean] {
    if (v.type === 'none') {
      return [{ type: 'terminal', str: 'None', length: 4 }, false]
    } else if (ancestors.has(v)) {
      return [{ type: 'terminal', str: '...<circular>', length: 13 }, true]
    } else if (v.type === 'bool') {
      const s = v.value ? 'True' : 'False'
      return [{ type: 'terminal', str: s, length: s.length }, false]
    } else if (v.type === 'number') {
      const s = toPythonFloat(v.value)
      return [{ type: 'terminal', str: s, length: s.length }, false]
    } else if (v.type === 'bigint' || v.type === 'complex') {
      const s = v.value.toString()
      return [{ type: 'terminal', str: s, length: s.length }, false]
    } else if (v.type === 'string') {
      const s = escape(v.value)
      return [{ type: 'terminal', str: s, length: s.length }, false]
    } else if (v.type === 'list') {
      if (ancestors.size > MAX_LIST_DISPLAY_LENGTH) {
        return [{ type: 'terminal', str: '...<truncated>', length: 14 }, false]
      }
      if (v.value.length === 2) {
        return convertPair(v)
      } else {
        return convertArrayLike(v, v.value, '[', ']')
      }
    } else if (v.type === 'closure' || v.type === 'function') {
      let funcName = '(anonymous)'
      if (v.type === 'closure') {
        funcName = (v.closure.node as any).name?.lexeme || '(anonymous)'
      } else {
        funcName = (v as any).name || '(anonymous)'
      }
      const s = `<function ${funcName}>`
      return [{ type: 'terminal', str: s, length: s.length }, false]
    } else if (v.type === 'builtin') {
      const s = `<built-in function ${v.name}>`
      return [{ type: 'terminal', str: s, length: s.length }, false]
    } else {
      return convertRepr(`<${(v as any).type} object>`)
    }
  }

  return convert(value)[0]
}

interface BlockLineTree {
  type: 'block'
  prefixFirst: string
  prefixRest: string
  block: LineTree[]
  suffixRest: string
  suffixLast: string
}

interface LineLineTree {
  type: 'line'
  line: StringDag
}

type LineTree = BlockLineTree | LineLineTree

export function stringDagToLineTree(
  dag: StringDag,
  indent: number,
  splitlineThreshold: number
): LineTree {
  const indentSpacesMinusOne = ' '.repeat(Math.max(0, indent - 1))
  const bracketAndIndentSpacesMinusOne = '[' + indentSpacesMinusOne
  const memo: Map<StringDag, LineTree> = new Map()

  function format(dag: StringDag): LineTree {
    const memoResult = memo.get(dag)
    if (memoResult !== undefined) {
      return memoResult
    }
    let result: LineTree
    if (dag.type === 'terminal') {
      result = { type: 'line', line: dag }
    } else if (dag.type === 'multiline') {
      result = {
        type: 'block',
        prefixFirst: '',
        prefixRest: '',
        block: dag.lines.map(s => ({
          type: 'line',
          line: { type: 'terminal', str: s, length: s.length }
        })),
        suffixRest: '',
        suffixLast: ''
      }
    } else if (dag.type === 'pair') {
      const headTree = format(dag.head)
      const tailTree = format(dag.tail)
      if (
        dag.length - 2 > splitlineThreshold ||
        headTree.type !== 'line' ||
        tailTree.type !== 'line'
      ) {
        result = {
          type: 'block',
          prefixFirst: bracketAndIndentSpacesMinusOne,
          prefixRest: '',
          block: [headTree, tailTree],
          suffixRest: ',',
          suffixLast: ']'
        }
      } else {
        result = {
          type: 'line',
          line: dag
        }
      }
    } else if (dag.type === 'arraylike') {
      const elemTrees = dag.elems.map(format)
      if (
        dag.length - dag.prefix.length - dag.suffix.length > splitlineThreshold ||
        elemTrees.some(t => t.type !== 'line')
      ) {
        result = {
          type: 'block',
          prefixFirst: dag.prefix + ' '.repeat(Math.max(0, indent - dag.prefix.length)),
          prefixRest: ' '.repeat(Math.max(dag.prefix.length, indent)),
          block: elemTrees,
          suffixRest: ',',
          suffixLast: dag.suffix
        }
      } else {
        result = {
          type: 'line',
          line: dag
        }
      }
    } else if (dag.type === 'kvpair') {
      const valueTree = format(dag.value)
      if (dag.length > splitlineThreshold || valueTree.type !== 'line') {
        result = {
          type: 'block',
          prefixFirst: '',
          prefixRest: '',
          block: [
            { type: 'line', line: { type: 'terminal', str: JSON.stringify(dag.key), length: 0 } },
            valueTree
          ],
          suffixRest: ':',
          suffixLast: ''
        }
      } else {
        result = {
          type: 'line',
          line: dag
        }
      }
    } else {
      throw new Error('Unreachable')
    }
    memo.set(dag, result)
    return result
  }

  return format(dag)
}

export function stringDagToSingleLine(dag: StringDag): string {
  function print(dag: StringDag, total: string[]): string[] {
    if (dag.type === 'multiline') {
      throw new Error('Tried to format multiline string as single line string')
    } else if (dag.type === 'terminal') {
      total.push(dag.str)
    } else if (dag.type === 'pair') {
      total.push('[')
      print(dag.head, total)
      total.push(', ')
      print(dag.tail, total)
      total.push(']')
    } else if (dag.type === 'kvpair') {
      total.push(JSON.stringify(dag.key))
      total.push(': ')
      print(dag.value, total)
    } else if (dag.type === 'arraylike') {
      total.push(dag.prefix)
      if (dag.elems.length > 0) {
        print(dag.elems[0], total)
      }
      for (let i = 1; i < dag.elems.length; i++) {
        total.push(', ')
        print(dag.elems[i], total)
      }
      total.push(dag.suffix)
    }
    return total
  }

  return print(dag, []).join('')
}

export function lineTreeToString(tree: LineTree): string {
  let total = ''
  const stringDagToLineMemo: Map<StringDag, string> = new Map()
  const stringDagToMultilineMemo: Map<LineTree, Map<number, [number, number]>> = new Map()

  function print(tree: LineTree, lineSep: string) {
    const multilineMemoResult = stringDagToMultilineMemo.get(tree)
    if (multilineMemoResult !== undefined) {
      const startEnd = multilineMemoResult.get(lineSep.length)
      if (startEnd !== undefined) {
        total += total.substring(startEnd[0], startEnd[1])
        return
      }
    }
    const start = total.length
    if (tree.type === 'line') {
      if (!stringDagToLineMemo.has(tree.line)) {
        stringDagToLineMemo.set(tree.line, stringDagToSingleLine(tree.line))
      }
      total += stringDagToLineMemo.get(tree.line)!
    } else if (tree.type === 'block') {
      total += tree.prefixFirst
      const indentedLineSepFirst = lineSep + ' '.repeat(tree.prefixFirst.length)
      const indentedLineSepRest = lineSep + tree.prefixRest
      print(tree.block[0], indentedLineSepFirst)
      for (let i = 1; i < tree.block.length; i++) {
        total += tree.suffixRest
        total += indentedLineSepRest
        print(tree.block[i], indentedLineSepRest)
      }
      total += tree.suffixLast
    }
    const end = total.length
    if (multilineMemoResult === undefined) {
      const newmap = new Map<number, [number, number]>()
      newmap.set(lineSep.length, [start, end])
      stringDagToMultilineMemo.set(tree, newmap)
    } else {
      multilineMemoResult.set(lineSep.length, [start, end])
    }
  }

  print(tree, '\n')
  return total
}
