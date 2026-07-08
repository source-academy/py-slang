import { ExprNS, StmtNS } from "../../ast-types";
import {
  FreeVariableUnboundError,
  IndexError,
  MissingRequiredPositionalError,
  NameError,
  RecursionError,
  TooManyPositionalArgumentsError,
  TypeError,
  UnboundLocalError,
} from "../../errors/errors";
import { Token, TokenType } from "../../tokenizer";
import { isStatementSequence } from "./closure";
import { Context } from "./context";
import { Control, ControlItem } from "./control";
import { currentEnvironment, Environment } from "./environment";
import { AssertionError, handleRuntimeError } from "./error";

export function getProgramEnvironment(context: Context): Environment | null {
  return context.runtime.environments.find(env => env.name === "programEnvironment") ?? null;
}
import { BigIntValue, ComplexValue, NumberValue, Value } from "./stash";
import {
  BranchInstr,
  ForInstr,
  Instr,
  InstrType,
  Node,
  StatementSequence,
  WhileInstr,
} from "./types";

export const isNode = (command: ControlItem): command is Node => {
  return !isInstr(command);
};

type PropertySetter = Map<string, Transformer>;
type Transformer = (item: ControlItem) => ControlItem;

const setToTrue = (item: ControlItem): ControlItem => {
  item.isEnvDependent = true;
  return item;
};

const setToFalse = (item: ControlItem): ControlItem => {
  item.isEnvDependent = false;
  return item;
};

const propertySetter: PropertySetter = new Map<string, Transformer>([
  // AST Nodes
  [
    "FileInput",
    (item: ControlItem) => {
      const node = item as StmtNS.FileInput;
      item.isEnvDependent = node.statements.some(stmt => isEnvDependent(stmt));
      return item;
    },
  ],
  ["FunctionDef", setToTrue],
  ["Lambda", setToFalse],
  ["Assign", setToTrue],
  [
    "Return",
    (item: ControlItem) => {
      const node = item as StmtNS.Return;
      item.isEnvDependent = node.value ? isEnvDependent(node.value) : false;
      return item;
    },
  ],
  [
    "SimpleExpr",
    (item: ControlItem) => {
      const node = item as StmtNS.SimpleExpr;
      item.isEnvDependent = isEnvDependent(node.expression);
      return item;
    },
  ],
  [
    "If",
    (item: ControlItem) => {
      const node = item as StmtNS.If;
      const elseIsDependent = node.elseBlock ? node.elseBlock.some(isEnvDependent) : false;
      item.isEnvDependent =
        isEnvDependent(node.condition) ||
        node.body.some(stmt => isEnvDependent(stmt)) ||
        elseIsDependent;
      return item;
    },
  ],
  ["FromImport", setToTrue],
  ["Global", setToFalse],
  ["NonLocal", setToFalse],
  ["Pass", setToFalse],
  ["Break", setToFalse],
  ["Continue", setToFalse],
  ["Variable", setToFalse],
  [
    "Call",
    (item: ControlItem) => {
      const node = item as ExprNS.Call;
      item.isEnvDependent =
        isEnvDependent(node.callee) || node.args.some(arg => isEnvDependent(arg));
      return item;
    },
  ],
  [
    "Starred",
    (item: ControlItem) => {
      const node = item as ExprNS.Starred;
      item.isEnvDependent = isEnvDependent(node.value);
      return item;
    },
  ],
  ["Literal", setToFalse],
  ["BigIntLiteral", setToFalse],
  ["None", setToFalse],
  ["Complex", setToFalse],
  [
    "Call",
    (item: ControlItem) => {
      const node = item as ExprNS.Grouping;
      item.isEnvDependent = isEnvDependent(node.expression);
      return item;
    },
  ],
  [
    "Binary",
    (item: ControlItem) => {
      const node = item as ExprNS.Binary;
      item.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
      return item;
    },
  ],
  [
    "Unary",
    (item: ControlItem) => {
      const node = item as ExprNS.Unary;
      item.isEnvDependent = isEnvDependent(node.right);
      return item;
    },
  ],
  [
    "Compare",
    (item: ControlItem) => {
      const node = item as ExprNS.Compare;
      item.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
      return item;
    },
  ],
  [
    "Ternary",
    (item: ControlItem) => {
      const node = item as ExprNS.Ternary;
      item.isEnvDependent =
        isEnvDependent(node.predicate) ||
        isEnvDependent(node.consequent) ||
        isEnvDependent(node.alternative);
      return item;
    },
  ],
  [
    "List",
    (item: ControlItem) => {
      const node = item as ExprNS.List;
      item.isEnvDependent = node.elements.some(elem => isEnvDependent(elem));
      return item;
    },
  ],
  [
    "Subscript",
    (item: ControlItem) => {
      const node = item as ExprNS.Subscript;
      item.isEnvDependent = isEnvDependent(node.value) || isEnvDependent(node.index);
      return item;
    },
  ],
  [
    "StatementSequence",
    (item: ControlItem) => {
      const node = item as StatementSequence;
      item.isEnvDependent = node.body.some(stmt => isEnvDependent(stmt));
      return item;
    },
  ],
  [InstrType.RESET, setToFalse],
  [InstrType.END_OF_FUNCTION_BODY, setToFalse],
  [InstrType.UNARY_OP, setToFalse],
  [InstrType.BINARY_OP, setToFalse],
  [InstrType.BOOL_OP, setToFalse],
  [InstrType.POP, setToFalse],
  [InstrType.CONTINUE_MARKER, setToFalse],
  [InstrType.ASSIGNMENT, setToFalse],
  [InstrType.ENVIRONMENT, setToFalse],
  [InstrType.APPLICATION, setToFalse],
  [
    InstrType.BRANCH,
    (item: ControlItem) => {
      const instr = item as BranchInstr;
      item.isEnvDependent = isEnvDependent(instr.consequent) || isEnvDependent(instr.alternate);
      return item;
    },
  ],
  [
    "InstrType.FOR",
    (item: ControlItem) => {
      const instr = item as ForInstr;
      item.isEnvDependent = isEnvDependent({ kind: "StatementSequence", body: instr.body });
      return item;
    },
  ],
  [
    "InstrType.WHILE",
    (item: ControlItem) => {
      const instr = item as WhileInstr;
      item.isEnvDependent = isEnvDependent(instr.body) || isEnvDependent(instr.test);
      return item;
    },
  ],
]);

export { propertySetter };

/**
 * Checks whether the evaluation of the given control item depends on the current environment.
 * The item is also considered environment dependent if its evaluation introduces
 * environment dependent items
 * @param item The control item to be checked
 * @return `true` if the item is environment depedent, else `false`.
 */
export function isEnvDependent(item: ControlItem | null | undefined): boolean {
  if (item === null || item === undefined) {
    return false;
  }
  // If result is already calculated, return it
  if (item.isEnvDependent !== undefined) {
    return item.isEnvDependent;
  }
  let setter: Transformer | undefined;
  if (isNode(item)) {
    const key = item.kind;
    setter = propertySetter.get(key);
  } else if (isInstr(item)) {
    setter = propertySetter.get(item.instrType);
  }

  if (setter) {
    return setter(item)?.isEnvDependent ?? false;
  }

  return false;
}

export const isInstr = (item: ControlItem): item is Instr & { isEnvDependent?: boolean } => {
  return "instrType" in item;
};

export const envChanging = (command: ControlItem): boolean => {
  return isEnvDependent(command);
};

export function pyDefineVariable(
  context: Context,
  name: string,
  value: Value,
  env: Environment = currentEnvironment(context),
) {
  Object.defineProperty(env.head, name, {
    value: value,
    writable: true,
    enumerable: true,
  });
}

export function pyGetVariable(code: string, context: Context, name: string, node: Node): Value {
  const env = currentEnvironment(context);
  if (env.closure && env.closure.localVariables.has(name)) {
    if (!env.head.hasOwnProperty(name)) {
      handleRuntimeError(context, new UnboundLocalError(code, name, node as ExprNS.Variable));
    }
  }

  let currentEnv: Environment | null = env;
  while (currentEnv) {
    if (Object.prototype.hasOwnProperty.call(currentEnv.head, name)) {
      return currentEnv.head[name];
    } else {
      currentEnv = currentEnv.tail;
    }
  }

  // Not bound anywhere in the chain — but it may still be a legitimate implicit closure
  // read of an enclosing function's own local (no `nonlocal` needed for reads), whose
  // binding construct just hasn't executed yet (e.g. a `def`/assignment that appears later
  // in that enclosing scope's body). Distinguish this from a genuinely undefined name, the
  // same way pyGetNonlocalVariable already does for explicit `nonlocal` targets.
  let ancestorEnv: Environment | null = env.tail;
  while (ancestorEnv) {
    if (ancestorEnv.closure && ancestorEnv.closure.localVariables.has(name)) {
      handleRuntimeError(
        context,
        new FreeVariableUnboundError(code, name, node as ExprNS.Variable),
      );
    }
    ancestorEnv = ancestorEnv.tail;
  }

  if (context.nativeStorage.builtins.has(name)) {
    return context.nativeStorage.builtins.get(name)!;
  }
  handleRuntimeError(context, new NameError(code, name, node as ExprNS.Variable));
}

// Reads `name` starting from the module-level (programEnvironment), bypassing any
// enclosing function frames. Used when a function declares `global name`.
export function pyGetGlobalVariable(
  code: string,
  context: Context,
  name: string,
  node: Node,
): Value {
  let currentEnv: Environment | null = getProgramEnvironment(context);
  while (currentEnv) {
    if (Object.prototype.hasOwnProperty.call(currentEnv.head, name)) {
      return currentEnv.head[name];
    }
    currentEnv = currentEnv.tail;
  }
  if (context.nativeStorage.builtins.has(name)) {
    return context.nativeStorage.builtins.get(name)!;
  }
  handleRuntimeError(context, new NameError(code, name, node as ExprNS.Variable));
}

// Walks the environment chain (starting from the scope enclosing the current one) to
// find the environment that *owns* `name` as a local variable — i.e. whose closure's
// static scan (scanForAssignments) recorded a binding construct for it — rather than the
// first environment that happens to already have the property set. This matters because
// a binding construct (assignment/def/for-target) in the owning function may not have
// executed yet (e.g. it's textually after the nested `nonlocal` reference, or inside an
// `if`/`for`/`while` that hasn't run), in which case CPython still resolves to that
// scope's (as-yet-unbound) cell rather than skipping past it to an unrelated outer scope
// that happens to share the name.
function findNonlocalOwningEnvironment(context: Context, name: string): Environment | null {
  const programEnv = getProgramEnvironment(context);
  let currentEnv: Environment | null = currentEnvironment(context).tail;
  while (currentEnv !== null && currentEnv !== programEnv) {
    if (currentEnv.closure && currentEnv.closure.localVariables.has(name)) {
      return currentEnv;
    }
    currentEnv = currentEnv.tail;
  }
  return null;
}

// Reads `name` from the nearest enclosing function scope (not global scope).
// Used when a function declares `nonlocal name`.
export function pyGetNonlocalVariable(
  code: string,
  context: Context,
  name: string,
  node: Node,
): Value {
  const owningEnv = findNonlocalOwningEnvironment(context, name);
  if (owningEnv) {
    if (Object.prototype.hasOwnProperty.call(owningEnv.head, name)) {
      return owningEnv.head[name];
    }
    // `name` is a free variable captured from an enclosing scope (via `nonlocal`), not a
    // local of the *current* function — CPython raises NameError with "free variable ...
    // in enclosing scope" wording here, distinct from UnboundLocalError (which is for a
    // name that's local to the function actually doing the reading).
    handleRuntimeError(context, new FreeVariableUnboundError(code, name, node as ExprNS.Variable));
  }
  handleRuntimeError(context, new NameError(code, name, node as ExprNS.Variable));
}

// Writes `value` to the nearest enclosing function scope that owns `name`.
// Used when a function declares `nonlocal name` and assigns to it.
export function pySetNonlocalVariable(
  code: string,
  context: Context,
  name: string,
  value: Value,
  node: Node,
): void {
  const owningEnv = findNonlocalOwningEnvironment(context, name);
  if (owningEnv) {
    pyDefineVariable(context, name, value, owningEnv);
    return;
  }
  handleRuntimeError(context, new NameError(code, name, node as ExprNS.Variable));
}

/**
 * Check whether the stack has exceeded the max recursion limit
 * (It only accepts instructions since a new function call can only be pushed onto the control
 *  after the `InstrType.APPLICATION` instruction is pushed)
 *
 * It checks the number of `InstrType.RESET` in the control stack, which corresponds to the number of function calls currently on the stack.
 * If this number exceeds the specified recursion limit, it throws a `RecursionError`.
 *
 * @param code The code being executed, used for error reporting
 * @param instr The executed instruction
 * @param context The execution context
 * @param control The control stack
 * @param recursionLimit The maximum allowed recursion depth before throwing an error
 */
export const checkStackOverFlow = (
  code: string,
  instr: Instr,
  context: Context,
  control: Control,
  recursionLimit: number,
) => {
  if (control.getNumFunctionResets() > recursionLimit && !isStatementSequence(instr.srcNode)) {
    handleRuntimeError(context, new RecursionError(code, instr.srcNode));
  }
};

export function pythonMod(a: bigint, b: bigint): bigint;
export function pythonMod(a: number, b: number): number;
export function pythonMod(a: number | bigint, b: number | bigint): number | bigint {
  if (typeof a === "bigint" || typeof b === "bigint") {
    const big_a = BigInt(a);
    const big_b = BigInt(b);
    const mod = big_a % big_b;

    if ((mod < 0n && big_b > 0n) || (mod > 0n && big_b < 0n)) {
      return mod + big_b;
    } else {
      return mod;
    }
  }
  // both are numbers
  const mod = a % b;
  if ((mod < 0 && b > 0) || (mod > 0 && b < 0)) {
    return mod + b;
  } else {
    return mod;
  }
}

/**
 * TEMPORARY IMPLEMENTATION
 * This function is a simplified comparison between int and float
 * to mimic Python-like ordering semantics.
 *
 * TODO: In future, replace this with proper method dispatch to
 * __eq__, __lt__, __gt__, etc., according to Python's object model.
 *
 * numericCompare: Compares a Python-style big integer with a float,
 * returning -1, 0, or 1 for less-than, equal, or greater-than. Also handles
 * same-type (bigint/bigint or number/number) comparisons directly. Assumes
 * neither operand is NaN — callers that admit float operands are expected to
 * special-case NaN themselves (every comparison with a NaN operand is False
 * in Python, except `!=`).
 *
 * This logic follows CPython's approach in floatobject.c, ensuring Python-like semantics:
 *
 * 1. Special Values:
 *    - If float_num is inf, any finite int_num is smaller (returns -1).
 *    - If float_num is -inf, any finite int_num is larger (returns 1).
 *
 * 2. Compare by Sign:
 *    - Determine each number's sign (negative, zero, or positive). If they differ, return based on sign.
 *    - If both are zero, treat them as equal.
 *
 * 3. Safe Conversion:
 *    - If |int_num| <= 2^53, safely convert it to a double and do a normal floating comparison.
 *
 * 4. Handling Large Integers:
 *    - For int_num beyond 2^53, approximate the magnitudes via exponent/bit length.
 *    - Compare the integer's digit count with float_num's order of magnitude.
 *
 * 5. Close Cases:
 *    - If both integer and float have the same digit count, convert float_num to a "big-int-like" string
 *      (approximateBigIntString) and compare lexicographically to int_num's string.
 *
 * By layering sign checks, safe numeric range checks, and approximate comparisons,
 * we achieve a Python-like ordering of large integers vs floats.
 */
export function numericCompare(val1: number | bigint, val2: number | bigint): number {
  // Handle same type comparisons first
  if (typeof val1 === "bigint" && typeof val2 === "bigint") {
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
    return 0;
  }
  if (typeof val1 === "number" && typeof val2 === "number") {
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
    return 0;
  }
  if (typeof val1 === "number" && typeof val2 === "bigint") {
    // for swapped order, swap the result of comparison here
    return -numericCompare(val2, val1);
  }

  const int_val = val1 as bigint;
  const float_val = val2 as number;
  // int_num.value < float_num.value => -1
  // int_num.value = float_num.value => 0
  // int_num.value > float_num.value => 1

  // If float_num is positive Infinity, then int_num is considered smaller.
  if (float_val === Infinity) {
    return -1;
  }
  if (float_val === -Infinity) {
    return 1;
  }

  const signInt = int_val < 0n ? -1 : int_val > 0n ? 1 : 0;
  const signFlt = Math.sign(float_val); // -1, 0, or 1

  if (signInt < signFlt) return -1; // e.g. int<0, float>=0 => int < float
  if (signInt > signFlt) return 1; // e.g. int>=0, float<0 => int > float

  // Both have the same sign (including 0).
  // If both are zero, treat them as equal.
  if (signInt === 0 && signFlt === 0) {
    return 0;
  }

  // Both are either positive or negative.
  // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
  const absInt = int_val < 0n ? -int_val : int_val;
  const MAX_SAFE = 9007199254740991; // 2^53 - 1

  if (absInt <= MAX_SAFE) {
    // Safe conversion to double.
    const intAsNum = Number(int_val);
    const diff = intAsNum - float_val;
    if (diff === 0) return 0;
    return diff < 0 ? -1 : 1;
  }

  // For large integers exceeding 2^53, need to distinguish more carefully.
  // Determine the order of magnitude of float_num.value (via log10) and compare it with
  // the number of digits of int_num.value. An approximate comparison can indicate whether
  // int_num.value is greater or less than float_num.value.

  // First, check if float_num.value is nearly zero (but not zero).
  if (float_val === 0) {
    // Although signFlt would be 0 and handled above, just to be safe:
    return signInt;
  }

  const absFlt = Math.abs(float_val);
  // Determine the order of magnitude.
  const exponent = Math.floor(Math.log10(absFlt));

  // Get the decimal string representation of the absolute integer.
  const intStr = absInt.toString();
  const intDigits = intStr.length;

  // If exponent + 1 is less than intDigits, then |int_num.value| has more digits
  // and is larger (if positive) or smaller (if negative) than float_num.value.
  // Conversely, if exponent + 1 is greater than intDigits, int_num.value has fewer digits.
  const integerPartLen = exponent + 1;
  if (integerPartLen < intDigits) {
    // length of int_num.value is larger => all positive => int_num.value > float_num.value
    //                => all negative => int_num.value < float_num.value
    return signInt > 0 ? 1 : -1;
  } else if (integerPartLen > intDigits) {
    // length of int_num.value is smaller => all positive => int_num.value < float_num.value
    //                => all negative => int_num.value > float_num.value
    return signInt > 0 ? -1 : 1;
  } else {
    // If the number of digits is the same, they may be extremely close.
    // Method: Convert float_num.value into an approximate BigInt string and perform a lexicographical comparison.
    const floatApproxStr = approximateBigIntString(absFlt, 30);

    const aTrim = intStr.replace(/^0+/, "");
    const bTrim = floatApproxStr.replace(/^0+/, "");

    // If lengths differ after trimming, the one with more digits is larger.
    if (aTrim.length > bTrim.length) {
      return signInt > 0 ? 1 : -1;
    } else if (aTrim.length < bTrim.length) {
      return signInt > 0 ? -1 : 1;
    } else {
      // Same length: use lexicographical comparison.
      const cmp = aTrim.localeCompare(bTrim);
      if (cmp === 0) {
        return 0;
      }
      // cmp>0 => aTrim > bTrim => aVal > bVal
      return cmp > 0 ? (signInt > 0 ? 1 : -1) : signInt > 0 ? -1 : 1;
    }
  }
}

function approximateBigIntString(num: number, precision: number): string {
  // Use scientific notation to obtain a string in the form "3.333333333333333e+49"
  const s = num.toExponential(precision);
  // Split into mantissa and exponent parts.
  // The regular expression matches strings of the form: /^([\d.]+)e([+\-]\d+)$/
  const match = s.match(/^([\d.]+)e([+\-]\d+)$/);
  if (!match) {
    // For extremely small or extremely large numbers, toExponential() should follow this format.
    // As a fallback, return Math.floor(num).toString()
    return Math.floor(num).toString();
  }
  let mantissaStr = match[1]; // "3.3333333333..."
  const exp = parseInt(match[2], 10); // e.g. +49

  // Remove the decimal point
  mantissaStr = mantissaStr.replace(".", "");
  // Get the current length of the mantissa string
  const len = mantissaStr.length;
  // Calculate the required integer length: for exp ≥ 0, we want the integer part
  // to have (1 + exp) digits.
  const integerLen = 1 + exp;
  if (integerLen <= 0) {
    // This indicates num < 1 (e.g., exponent = -1, mantissa = "3" results in 0.xxx)
    // For big integer comparison, such a number is very small, so simply return "0"
    return "0";
  }

  if (len < integerLen) {
    // The mantissa is not long enough; pad with zeros at the end.
    return mantissaStr.padEnd(integerLen, "0");
  }
  // If the mantissa is too long, truncate it (this is equivalent to taking the floor).
  // Rounding could be applied if necessary, but truncation is sufficient for comparison.
  return mantissaStr.slice(0, integerLen);
}

/**
 * Checks if a value is a number or bigint, which are the numeric types in our interpreter.
 * @param value The value to check
 * @returns `true` if the value is a number or bigint, else `false`
 */
export function isNumeric(value: Value): value is NumberValue | BigIntValue {
  return value.type === "number" || value.type === "bigint";
}

/**
 * Checks if a value is complex or numeric.
 * @param value The value to check
 * @returns `true` if the value is a number, bigint, or complex, else `false`
 */
export function isCoercedComplex(value: Value): value is NumberValue | BigIntValue | ComplexValue {
  return value.type === "number" || value.type === "bigint" || value.type === "complex";
}

export default function assert(
  context: Context,
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    handleRuntimeError(context, new AssertionError(message));
  }
}

// Returns the set of names declared with `global` anywhere in the given function body,
// without recursing into nested function definitions.
export function scanForGlobalDeclarations(node: Node | Node[]): Set<string> {
  const globals = new Set<string>();
  const visitor = (curNode: Node) => {
    if (!curNode || typeof curNode !== "object") return;
    const kind = (curNode as { kind?: string }).kind;
    if (kind === "Global") {
      globals.add((curNode as unknown as StmtNS.Global).name.lexeme);
      return;
    }
    if (kind === "FunctionDef" || kind === "Lambda") return;
    for (const key in curNode) {
      if (Object.prototype.hasOwnProperty.call(curNode, key)) {
        const child = (curNode as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          child.forEach(c => {
            if (c !== undefined && c !== null && typeof c === "object") visitor(c as Node);
          });
        } else if (
          child !== undefined &&
          child !== null &&
          typeof child === "object" &&
          (child as { kind?: string }).kind !== undefined
        ) {
          visitor(child as Node);
        }
      }
    }
  };
  if (Array.isArray(node)) node.forEach(visitor);
  else visitor(node);
  return globals;
}

// Returns the set of names declared with `nonlocal` anywhere in the given function body,
// without recursing into nested function definitions.
export function scanForNonlocalDeclarations(node: Node | Node[]): Set<string> {
  const nonlocals = new Set<string>();
  const visitor = (curNode: Node) => {
    if (!curNode || typeof curNode !== "object") return;
    const kind = (curNode as { kind?: string }).kind;
    if (kind === "NonLocal") {
      nonlocals.add((curNode as unknown as StmtNS.NonLocal).name.lexeme);
      return;
    }
    if (kind === "FunctionDef" || kind === "Lambda") return;
    for (const key in curNode) {
      if (Object.prototype.hasOwnProperty.call(curNode, key)) {
        const child = (curNode as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          child.forEach(c => {
            if (c !== undefined && c !== null && typeof c === "object") visitor(c as Node);
          });
        } else if (
          child !== undefined &&
          child !== null &&
          typeof child === "object" &&
          (child as { kind?: string }).kind !== undefined
        ) {
          visitor(child as Node);
        }
      }
    }
  };
  if (Array.isArray(node)) node.forEach(visitor);
  else visitor(node);
  return nonlocals;
}

export function scanForAssignments(
  node: Node | Node[],
  globalNames: Set<string> = new Set(),
  nonlocalNames: Set<string> = new Set(),
): Set<string> {
  const assignments = new Set<string>();
  const visitor = (curNode: Node) => {
    if (!curNode || typeof curNode !== "object") {
      return;
    }

    const nodeType = curNode.kind;

    if (nodeType === "Assign") {
      const assignNode = curNode as StmtNS.Assign;
      if (assignNode.target instanceof ExprNS.Variable) {
        const name = assignNode.target.name.lexeme;
        if (!globalNames.has(name) && !nonlocalNames.has(name)) {
          assignments.add(name);
        }
      }
    } else if (nodeType === "For") {
      // The loop target is a binding construct even if the loop body never
      // assigns anything else (e.g. `for i in range(3): pass`).
      const forNode = curNode as StmtNS.For;
      const name = forNode.target.lexeme;
      if (!globalNames.has(name) && !nonlocalNames.has(name)) {
        assignments.add(name);
      }
    } else if (nodeType === "FunctionDef") {
      // def f(...) creates a binding for the function name in the current scope
      const name = (curNode as StmtNS.FunctionDef).name.lexeme;
      if (!globalNames.has(name) && !nonlocalNames.has(name)) {
        assignments.add(name);
      }
      return; // don't recurse into the nested function's body
    } else if (nodeType === "Lambda") {
      return; // lambda is anonymous, no name binding in current scope
    }

    // Recurse through all other properties of the node
    for (const key in curNode) {
      if (Object.prototype.hasOwnProperty.call(curNode, key)) {
        const child = (curNode as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          child.forEach(visitor);
        } else if (child && typeof child === "object" && child.hasOwnProperty("type")) {
          visitor(child as Node);
        }
      }
    }
  };

  if (Array.isArray(node)) {
    node.forEach(visitor);
  } else {
    visitor(node);
  }

  return assignments;
}

export function operandTranslator(type: string) {
  switch (type) {
    case "__py_adder":
      return "+";
    case "__py_minuser":
      return "-";
    case "__py_multiplier":
      return "*";
    case "__py_divider":
      return "/";
    case "__py_modder":
      return "%";
    case "__py_powerer":
      return "**";
    default:
      return type;
  }
}

export function evaluateListAssignment(
  code: string,
  assignNode: StmtNS.Assign,
  context: Context,
  list: Value | undefined,
  index: Value | undefined,
  value: Value | undefined,
) {
  if (list === undefined || list.type !== "list") {
    handleRuntimeError(
      context,
      new TypeError(code, assignNode, context, list?.type || "unknown", "list"),
    );
  }
  if (index === undefined || index.type !== "bigint") {
    handleRuntimeError(
      context,
      new TypeError(code, assignNode, context, index?.type || "unknown", "int"),
    );
  }
  if (value === undefined) {
    handleRuntimeError(context, new TypeError(code, assignNode, context, "undefined", "any"));
  }
  let intIndex = Number(index.value);
  if (intIndex < 0) {
    intIndex = intIndex % list.value.length;
  }
  if (intIndex >= list.value.length) {
    handleRuntimeError(
      context,
      new IndexError(code, assignNode, context, intIndex, list.value.length),
    );
  }
  list.value[intIndex] = value;
}

export function evaluateForIterator(
  code: string,
  context: Context,
  forNode: StmtNS.For,
): { start: ExprNS.Expr; end: ExprNS.Expr; step: ExprNS.Expr } {
  const rangeArguments = (forNode.iter as ExprNS.Call).args;
  if (rangeArguments.length === 0) {
    handleRuntimeError(
      context,
      new MissingRequiredPositionalError(code, forNode.iter, "range", 0, rangeArguments, true),
    );
  }
  if (rangeArguments.length > 3) {
    handleRuntimeError(
      context,
      new TooManyPositionalArgumentsError(code, forNode.iter, "range", 3, rangeArguments, true),
    );
  }
  // Line is the real for-statement's line, not 0 — these bounds are logically part of
  // evaluating that statement, and the CSE Machine visualizer's currentLine tracking
  // relies on synthetic nodes carrying a meaningful line rather than none at all.
  const forLine = forNode.startToken.line;
  const tempTokenZero = new Token(TokenType.BIGINT, "0", forLine, 0, 0);
  tempTokenZero.synthetic = true;
  const tempTokenOne = new Token(TokenType.BIGINT, "1", forLine, 0, 0);
  tempTokenOne.synthetic = true;
  if (rangeArguments.length === 1) {
    return {
      start: new ExprNS.BigIntLiteral(tempTokenZero, tempTokenZero, "0"),
      end: rangeArguments[0],
      step: new ExprNS.BigIntLiteral(tempTokenOne, tempTokenOne, "1"),
    };
  }

  if (rangeArguments.length === 2) {
    return {
      start: rangeArguments[0],
      end: rangeArguments[1],
      step: new ExprNS.BigIntLiteral(tempTokenOne, tempTokenOne, "1"),
    };
  }

  return {
    start: rangeArguments[0],
    end: rangeArguments[1],
    step: rangeArguments[2],
  };
}

export function generateForIncrement(
  variableName: string,
  value: bigint,
  line: number,
): StmtNS.Stmt {
  const token = new Token(TokenType.NAME, variableName, line, 0, -1);
  token.synthetic = true;
  const variable = new ExprNS.Variable(token, token, token);

  const literalToken = new Token(TokenType.BIGINT, value.toString(), line, 0, -1);
  literalToken.synthetic = true;
  const literal = new ExprNS.BigIntLiteral(literalToken, literalToken, value.toString());
  return new StmtNS.Assign(token, literalToken, variable, literal);
}
