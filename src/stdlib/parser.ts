import { ExprNS, FunctionParam, StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { handleRuntimeError } from "../engines/cse/error";
import { appInstr } from "../engines/cse/instrCreator";
import { BuiltinValue, ListValue, NoneValue, StringValue, Value } from "../engines/cse/stash";
import { operatorTranslator } from "../engines/cse/types";
import { TypeError } from "../errors/errors";
import { parse } from "../parser";
import pythonLexer from "../parser/lexer";
import { GroupName, minArgMap, Validate } from "./utils";

const None: NoneValue = { type: "none" };

function pair(h: Value, t: Value): ListValue {
  return { type: "list", value: [h, t] };
}

function vector_to_linked_list(arr: Value[]): ListValue | NoneValue {
  let res: ListValue | NoneValue = None;
  for (let i = arr.length - 1; i >= 0; i--) {
    res = pair(arr[i], res);
  }
  return res;
}

function isDeclaration(node: StmtNS.Stmt | null | undefined): boolean {
  if (!node) return false;
  const type = node.kind;
  return type === "FunctionDef" || type === "Assign" || type === "AnnAssign";
}

function hasDeclaration(statements: StmtNS.Stmt[]): boolean {
  return statements.some(isDeclaration);
}

function makeSequenceIfNeeded(
  statements: StmtNS.Stmt[] | StmtNS.Stmt | null | undefined,
  declaredNames: Set<string>,
): Value {
  if (!statements) return None;
  if (!Array.isArray(statements)) return transform(statements, declaredNames);
  if (statements.length === 0) {
    return None;
  }
  if (statements.length === 1) {
    return transform(statements[0], declaredNames);
  }
  return vector_to_linked_list([
    { type: "string", value: "sequence" },
    vector_to_linked_list(statements.map(stmt => transform(stmt, declaredNames))),
  ]);
}

function makeBlockIfNeeded(statements: StmtNS.Stmt[], declaredNames: Set<string>): Value {
  return hasDeclaration(statements)
    ? vector_to_linked_list([
        { type: "string", value: "block" },
        makeSequenceIfNeeded(statements, declaredNames),
      ])
    : makeSequenceIfNeeded(statements, declaredNames);
}

function transformParam(p: FunctionParam): Value {
  const nameNode = vector_to_linked_list([
    { type: "string", value: "name" },
    { type: "string", value: p.lexeme },
  ]);
  if (p.isStarred) {
    return vector_to_linked_list([{ type: "string", value: "rest_element" }, nameNode]);
  }
  return nameNode;
}

function transform(
  node: ExprNS.Expr | StmtNS.Stmt | null | undefined,
  declaredNames: Set<string>,
): Value {
  if (!node) return None;
  const type = node.kind;
  switch (type) {
    case "FileInput":
      return makeSequenceIfNeeded((node as StmtNS.FileInput).statements, declaredNames);
    case "SimpleExpr":
      return transform((node as StmtNS.SimpleExpr).expression, declaredNames);
    case "Literal": {
      const lit = node as ExprNS.Literal;
      let val: Value;
      if (typeof lit.value === "number") val = { type: "number", value: lit.value };
      else if (typeof lit.value === "boolean") val = { type: "bool", value: lit.value };
      else if (typeof lit.value === "string") val = { type: "string", value: lit.value };
      else val = None;
      return vector_to_linked_list([{ type: "string", value: "literal" }, val]);
    }
    case "BigIntLiteral":
      return vector_to_linked_list([
        { type: "string", value: "literal" },
        { type: "bigint", value: BigInt((node as ExprNS.BigIntLiteral).value) },
      ]);
    case "Complex":
      return vector_to_linked_list([
        { type: "string", value: "literal" },
        { type: "complex", value: (node as ExprNS.Complex).value },
      ]);
    case "None":
      return vector_to_linked_list([{ type: "string", value: "literal" }, None]);
    case "Variable":
      return vector_to_linked_list([
        { type: "string", value: "name" },
        { type: "string", value: (node as ExprNS.Variable).name.lexeme },
      ]);
    case "Binary":
      return vector_to_linked_list([
        { type: "string", value: "binary_operator_combination" },
        {
          type: "string",
          value: operatorTranslator((node as ExprNS.Binary).operator.type),
        },
        transform((node as ExprNS.Binary).left, declaredNames),
        transform((node as ExprNS.Binary).right, declaredNames),
      ]);
    case "BoolOp":
      return vector_to_linked_list([
        { type: "string", value: "logical_composition" },
        {
          type: "string",
          value: operatorTranslator((node as ExprNS.BoolOp).operator.type),
        },
        transform((node as ExprNS.BoolOp).left, declaredNames),
        transform((node as ExprNS.BoolOp).right, declaredNames),
      ]);
    case "Compare":
      return vector_to_linked_list([
        { type: "string", value: "comparison" },
        {
          type: "string",
          value: operatorTranslator((node as ExprNS.Compare).operator.type),
        },
        transform((node as ExprNS.Compare).left, declaredNames),
        transform((node as ExprNS.Compare).right, declaredNames),
      ]);
    case "Unary":
      return vector_to_linked_list([
        { type: "string", value: "unary_operator_combination" },
        {
          type: "string",
          value: operatorTranslator((node as ExprNS.Unary).operator.type),
        },
        transform((node as ExprNS.Unary).right, declaredNames),
      ]);
    case "Assign": {
      const assign = node as StmtNS.Assign;
      const isDecl =
        assign.target instanceof ExprNS.Variable && !declaredNames.has(assign.target.name.lexeme);
      if (isDecl && assign.target instanceof ExprNS.Variable) {
        declaredNames.add(assign.target.name.lexeme);
      }
      return vector_to_linked_list([
        { type: "string", value: isDecl ? "declaration" : "assignment" },
        transform(assign.target, declaredNames),
        transform(assign.value, declaredNames),
      ]);
    }
    case "AnnAssign":
      return vector_to_linked_list([
        { type: "string", value: "annotated_assignment" },
        transform((node as StmtNS.AnnAssign).target, declaredNames),
        transform((node as StmtNS.AnnAssign).ann, declaredNames),
        transform((node as StmtNS.AnnAssign).value, declaredNames),
      ]);
    case "Grouping":
      return transform((node as ExprNS.Grouping).expression, declaredNames);
    case "If":
      return vector_to_linked_list([
        { type: "string", value: "conditional_statement" },
        transform((node as StmtNS.If).condition, declaredNames),
        makeSequenceIfNeeded((node as StmtNS.If).body, declaredNames),
        makeSequenceIfNeeded((node as StmtNS.If).elseBlock, declaredNames),
      ]);
    case "Ternary":
      return vector_to_linked_list([
        { type: "string", value: "conditional_expression" },
        transform((node as ExprNS.Ternary).predicate, declaredNames),
        transform((node as ExprNS.Ternary).consequent, declaredNames),
        transform((node as ExprNS.Ternary).alternative, declaredNames),
      ]);
    case "While":
      return vector_to_linked_list([
        { type: "string", value: "while_loop" },
        transform((node as StmtNS.While).condition, declaredNames),
        makeSequenceIfNeeded((node as StmtNS.While).body, declaredNames),
      ]);
    case "For": {
      const forNode = node as StmtNS.For;
      return vector_to_linked_list([
        { type: "string", value: "for_loop" },
        vector_to_linked_list([
          { type: "string", value: "name" },
          { type: "string", value: forNode.target.lexeme },
        ]),
        transform(forNode.iter, declaredNames),
        makeSequenceIfNeeded(forNode.body, declaredNames),
      ]);
    }
    case "FunctionDef": {
      const fn = node as StmtNS.FunctionDef;
      return vector_to_linked_list([
        { type: "string", value: "function_declaration" },
        vector_to_linked_list([
          { type: "string", value: "name" },
          { type: "string", value: fn.name.lexeme },
        ]),
        vector_to_linked_list(fn.parameters.map(transformParam)),
        makeBlockIfNeeded(fn.body, declaredNames),
      ]);
    }
    case "Lambda": {
      const lam = node as ExprNS.Lambda;
      return vector_to_linked_list([
        { type: "string", value: "lambda_expression" },
        vector_to_linked_list(lam.parameters.map(transformParam)),
        vector_to_linked_list([
          { type: "string", value: "return_statement" },
          transform(lam.body, declaredNames),
        ]),
      ]);
    }
    case "MultiLambda": {
      const lam = node as ExprNS.MultiLambda;
      return vector_to_linked_list([
        { type: "string", value: "lambda_expression" },
        vector_to_linked_list(lam.parameters.map(transformParam)),
        makeBlockIfNeeded(lam.body, declaredNames),
      ]);
    }
    case "Return":
      return vector_to_linked_list([
        { type: "string", value: "return_statement" },
        transform((node as StmtNS.Return).value, declaredNames),
      ]);
    case "Call":
      return vector_to_linked_list([
        { type: "string", value: "application" },
        transform((node as ExprNS.Call).callee, declaredNames),
        vector_to_linked_list((node as ExprNS.Call).args.map(arg => transform(arg, declaredNames))),
      ]);
    case "List":
      return vector_to_linked_list([
        { type: "string", value: "array_expression" },
        vector_to_linked_list(
          (node as ExprNS.List).elements.map(el => transform(el, declaredNames)),
        ),
      ]);
    case "Subscript":
      return vector_to_linked_list([
        { type: "string", value: "object_access" },
        transform((node as ExprNS.Subscript).value, declaredNames),
        transform((node as ExprNS.Subscript).index, declaredNames),
      ]);
    case "Starred":
      return vector_to_linked_list([
        { type: "string", value: "starred_expression" },
        transform((node as ExprNS.Starred).value, declaredNames),
      ]);
    case "FromImport":
      return vector_to_linked_list([
        { type: "string", value: "import_from" },
        { type: "string", value: (node as StmtNS.FromImport).module.lexeme },
        vector_to_linked_list(
          (node as StmtNS.FromImport).names.map(n => ({ type: "string", value: n.name.lexeme })),
        ),
      ]);
    case "Global":
      return vector_to_linked_list([
        { type: "string", value: "global_statement" },
        { type: "string", value: (node as StmtNS.Global).name.lexeme },
      ]);
    case "NonLocal":
      return vector_to_linked_list([
        { type: "string", value: "nonlocal_statement" },
        { type: "string", value: (node as StmtNS.NonLocal).name.lexeme },
      ]);
    case "Assert":
      return vector_to_linked_list([
        { type: "string", value: "assert_statement" },
        transform((node as StmtNS.Assert).value, declaredNames),
      ]);
    case "Pass":
      return vector_to_linked_list([{ type: "string", value: "pass_statement" }]);
    case "Break":
      return vector_to_linked_list([{ type: "string", value: "break_statement" }]);
    case "Continue":
      return vector_to_linked_list([{ type: "string", value: "continue_statement" }]);
    default:
      throw new Error("Cannot transform unknown type: " + type);
  }
}

class ParserBuiltins {
  @Validate(1, 1, "parse", false)
  static parse(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (args[0].type !== "string") {
      handleRuntimeError(context, new TypeError(source, command, context, args[0].type, "string"));
    }
    const x = args[0].value;
    const program = parse(x + "\n");
    const declaredNames = new Set<string>();
    return transform(program, declaredNames);
  }

  @Validate(2, 2, "apply_in_underlying_python", false)
  static async apply_in_underlying_python(
    args: Value[],
    source: string,
    command: ExprNS.Call,
    context: Context,
  ): Promise<Value | undefined> {
    const func = args[0];
    const argList = args[1];
    const argArray: Value[] = [];
    let current = argList;
    while (current && current.type === "list" && current.value.length === 2) {
      argArray.push(current.value[0]);
      current = current.value[1];
    }

    if (func.type === "builtin") {
      return func.func(argArray, source, command, context);
    }
    context.stash.push(func);
    argArray.forEach(arg => context.stash.push(arg));
    context.control.push(appInstr(argArray.length, command));
  }

  @Validate(1, 1, "tokenize", false)
  static tokenize(args: Value[], source: string, command: ExprNS.Call, context: Context): Value {
    if (args[0].type !== "string") {
      handleRuntimeError(context, new TypeError(source, command, context, args[0].type, "string"));
    }
    const x = args[0].value;
    pythonLexer.reset(x);
    const tokens: StringValue[] = [];
    let tok;
    while ((tok = pythonLexer.next())) {
      tokens.push({ type: "string", value: tok.value });
    }
    return vector_to_linked_list(tokens);
  }
}

const parserBuiltins = new Map<string, BuiltinValue>();
for (const builtin of Object.getOwnPropertyNames(ParserBuiltins)) {
  const member = (ParserBuiltins as unknown as Record<string, unknown>)[builtin];
  if (typeof member === "function" && !builtin.startsWith("_")) {
    const fn = member as BuiltinValue["func"];
    parserBuiltins.set(builtin, {
      type: "builtin",
      func: fn,
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}

export default {
  name: GroupName.MCE,
  prelude: "",
  builtins: parserBuiltins,
};
