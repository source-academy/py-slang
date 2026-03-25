import { ExprNS, StmtNS } from "../ast-types";
import { NameError, UnboundLocalError } from "../errors/errors";
import { builtInConstants, builtIns } from "../stdlib";
import { Context } from "./context";
import { Control, ControlItem } from "./control";
import { currentEnvironment, Environment } from "./environment";
import { AssertionError } from "./error";
import { Value } from "./stash";
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
  [InstrType.MARKER, setToFalse],
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
      item.isEnvDependent =
        isEnvDependent(instr.body) ||
        isEnvDependent(instr.init) ||
        isEnvDependent(instr.test) ||
        isEnvDependent(instr.update);
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
    const key = "type" in item && typeof item.type === "string" ? item.type : item.constructor.name;
    setter = propertySetter.get(key);
  } else if (isInstr(item)) {
    setter = propertySetter.get(item.instrType);
  }

  if (setter) {
    return setter(item)?.isEnvDependent ?? false;
  }

  return false;
}

function isInstr(item: ControlItem): item is Instr & { isEnvDependent?: boolean } {
  return (item as Instr).instrType !== undefined;
}

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
      throw new UnboundLocalError(code, name, node as ExprNS.Variable);
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
  if (builtIns.has(name)) {
    return builtIns.get(name)!;
  }
  if (builtInConstants.has(name)) {
    return builtInConstants.get(name)!;
  }
  if (context.nativeStorage.builtins.has(name)) {
    return context.nativeStorage.builtins.get(name)!
  }
  throw new NameError(code, name, node as ExprNS.Variable);
}

export const checkStackOverFlow = (_context: Context, _control: Control) => {
  // TODO
};

// export const isSimpleFunction = (node: ) => {
//   if (node.body.type !== 'BlockStatement' && node.body.type !== 'StatementSequence') {
//     return true
//   } else {
//     const block = node.body
//     return block.body.length === 1 && block.body[0].type === 'ReturnStatement'
//   }
// }

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

export default function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export function scanForAssignments(node: Node | Node[]): Set<string> {
  const assignments = new Set<string>();
  const visitor = (curNode: Node) => {
    if (!curNode || typeof curNode !== "object") {
      return;
    }

    const nodeType = curNode.constructor.name;

    if (nodeType === "Assign") {
      const assignNode = curNode as StmtNS.Assign;
      if (assignNode.target instanceof ExprNS.Subscript) {
        throw new Error("Subscript assignment is not yet supported");
      }
      assignments.add(assignNode.target.name.lexeme);
    } else if (nodeType === "FunctionDef" || nodeType === "Lambda") {
      // detach here, nested functions have their own scope
      return;
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

export function typeTranslator(type: string): string {
  switch (type) {
    case "bigint":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "bool":
      return "bool";
    case "string":
      return "string";
    case "complex":
      return "complex";
    default:
      return "unknown";
  }
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
