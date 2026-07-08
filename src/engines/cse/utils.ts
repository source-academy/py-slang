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
  const tempTokenZero = new Token(TokenType.BIGINT, "0", 0, 0, 0);
  tempTokenZero.synthetic = true;
  const tempTokenOne = new Token(TokenType.BIGINT, "1", 0, 0, 0);
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

export function generateForIncrement(variableName: string, value: bigint): StmtNS.Stmt {
  const token = new Token(TokenType.NAME, variableName, 0, 0, -1);
  token.synthetic = true;
  const variable = new ExprNS.Variable(token, token, token);

  const literalToken = new Token(TokenType.BIGINT, value.toString(), 0, 0, -1);
  literalToken.synthetic = true;
  const literal = new ExprNS.BigIntLiteral(literalToken, literalToken, value.toString());
  return new StmtNS.Assign(token, literalToken, variable, literal);
}
