import { PARSE_TREE_STRINGS, WasmExports } from ".";
import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";

interface BuilderVisitor<S, E> extends StmtNS.Visitor<S>, ExprNS.Visitor<E> {
  visit(stmt: StmtNS.Stmt): S;
  visit(stmt: ExprNS.Expr): E;
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): S | E;
}

export class MetacircularGenerator implements BuilderVisitor<[number, bigint], [number, bigint]> {
  private wasmExports: WasmExports;
  private memory: WebAssembly.Memory;
  private static readonly encoder = new TextEncoder();

  private list(...elements: [number, bigint][]): [number, bigint] {
    return elements.reduceRight(([tailTag, tailValue], [tag, value]) => {
      const pair = this.wasmExports.makePair(tag, BigInt(value), tailTag, BigInt(tailValue));
      return pair;
    }, this.wasmExports.makeNone());
  }

  private string(str: (typeof PARSE_TREE_STRINGS)[number]): [number, bigint] {
    const index = PARSE_TREE_STRINGS.indexOf(str);
    const offset = PARSE_TREE_STRINGS.slice(0, index).reduce((acc, s) => acc + s.length, 0);
    return this.wasmExports.makeString(offset, str.length);
  }

  private dynamicString(str: string): [number, bigint] {
    const bytes = MetacircularGenerator.encoder.encode(str);
    const offset = this.wasmExports.malloc(bytes.length);

    const dataView = new DataView(this.memory.buffer, offset, bytes.length);
    bytes.forEach((byte, i) => dataView.setUint8(i, byte));

    return this.wasmExports.makeString(offset, str.length);
  }

  constructor(wasmExports: WasmExports, memory: WebAssembly.Memory) {
    this.wasmExports = wasmExports;
    this.memory = memory;
  }

  visit(stmt: StmtNS.Stmt): [number, bigint];
  visit(stmt: ExprNS.Expr): [number, bigint];
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): [number, bigint] {
    return stmt.accept(this);
  }

  visitFileInputStmt(stmt: StmtNS.FileInput): [number, bigint] {
    if (stmt.statements.length === 0) {
      return this.list(this.string("sequence"), this.list(this.wasmExports.makeNone()));
    }

    if (stmt.statements.length === 1) {
      return this.visit(stmt.statements[0]);
    }

    const statementsList = this.list(...stmt.statements.map(s => this.visit(s)));
    return this.list(this.string("sequence"), statementsList);
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): [number, bigint] {
    return this.visit(stmt.expression);
  }

  visitGroupingExpr(expr: ExprNS.Grouping): [number, bigint] {
    return this.visit(expr.expression);
  }

  visitBinaryExpr(expr: ExprNS.Binary): [number, bigint] {
    const type = expr.operator.type;
    let op: (typeof PARSE_TREE_STRINGS)[number];

    if (type === TokenType.PLUS) op = '"+"';
    else if (type === TokenType.MINUS) op = '"-"';
    else if (type === TokenType.STAR) op = '"*"';
    else if (type === TokenType.SLASH) op = '"/"';
    else {
      throw new Error(`Unsupported binary operator in parse tree: ${type}`);
    }

    return this.list(
      this.string("binary_operator_combination"),
      this.string(op),
      this.visit(expr.left),
      this.visit(expr.right),
    );
  }

  visitCompareExpr(expr: ExprNS.Compare): [number, bigint] {
    const type = expr.operator.type;
    let op: (typeof PARSE_TREE_STRINGS)[number];

    if (type === TokenType.DOUBLEEQUAL) op = '"=="';
    else if (type === TokenType.NOTEQUAL) op = '"!="';
    else if (type === TokenType.LESS) op = '"<"';
    else if (type === TokenType.LESSEQUAL) op = '"<="';
    else if (type === TokenType.GREATER) op = '">"';
    else if (type === TokenType.GREATEREQUAL) op = '">="';
    else {
      throw new Error(`Unsupported comparison operator in parse tree: ${type}`);
    }

    return this.list(
      this.string("binary_operator_combination"),
      this.string(op),
      this.visit(expr.left),
      this.visit(expr.right),
    );
  }

  visitUnaryExpr(expr: ExprNS.Unary): [number, bigint] {
    const type = expr.operator.type;
    let op: (typeof PARSE_TREE_STRINGS)[number];

    if (type === TokenType.MINUS) op = '"-unary"';
    else if (type === TokenType.NOT) op = '"not"';
    else {
      throw new Error(`Unsupported unary operator in parse tree: ${type}`);
    }

    return this.list(
      this.string("unary_operator_combination"),
      this.string(op),
      this.visit(expr.right),
    );
  }

  visitBoolOpExpr(expr: ExprNS.BoolOp): [number, bigint] {
    const type = expr.operator.type;
    let op: (typeof PARSE_TREE_STRINGS)[number];

    if (type === TokenType.AND) op = '"and"';
    else if (type === TokenType.OR) op = '"or"';
    else {
      throw new Error(`Unsupported boolean operator in parse tree: ${type}`);
    }

    return this.list(
      this.string("logical_composition"),
      this.string(op),
      this.visit(expr.left),
      this.visit(expr.right),
    );
  }

  visitTernaryExpr(expr: ExprNS.Ternary): [number, bigint] {
    return this.list(
      this.string("conditional_expression"),
      this.visit(expr.predicate),
      this.visit(expr.consequent),
      this.visit(expr.alternative),
    );
  }

  visitNoneExpr(expr: ExprNS.None): [number, bigint] {
    return this.list(this.string("literal"), this.wasmExports.makeNone());
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): [number, bigint] {
    const value = BigInt(expr.value);
    const min = BigInt("-9223372036854775808"); // -(2^63)
    const max = BigInt("9223372036854775807"); // (2^63) - 1
    if (value < min || value > max) {
      throw new Error(`BigInt literal out of bounds: ${expr.value}`);
    }

    return this.list(this.string("literal"), this.wasmExports.makeInt(value));
  }

  visitLiteralExpr(expr: ExprNS.Literal): [number, bigint] {
    if (typeof expr.value === "number")
      return this.list(this.string("literal"), this.wasmExports.makeFloat(expr.value));
    else if (typeof expr.value === "boolean")
      return this.list(this.string("literal"), this.wasmExports.makeBool(expr.value ? 1 : 0));
    else if (typeof expr.value === "string") {
      return this.list(this.string("literal"), this.dynamicString(`"${expr.value}"`));
    } else {
      throw new Error(`Unsupported literal type: ${typeof expr.value}`);
    }
  }

  visitListExpr(expr: ExprNS.List): [number, bigint] {
    const elementsList = this.list(...expr.elements.map(e => this.visit(e)));
    return this.list(this.string("list_expression"), elementsList);
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): [number, bigint] {
    return this.list(this.string("object_access"), this.visit(expr.value), this.visit(expr.index));
  }

  visitStarredExpr(expr: ExprNS.Starred): [number, bigint] {
    return this.visit(expr.value);
  }

  visitAssignStmt(stmt: StmtNS.Assign): [number, bigint] {
    return this.list(
      stmt.target instanceof ExprNS.Variable
        ? this.string("assignment")
        : this.string("object_assignment"),
      this.visit(stmt.target),
      this.visit(stmt.value),
    );
  }

  visitVariableExpr(expr: ExprNS.Variable): [number, bigint] {
    return this.list(this.string("name"), this.dynamicString(`"${expr.name.lexeme}"`));
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): [number, bigint] {
    // find any variable declarations in the function body which are not declared as nonlocal
    const hasVarDecls =
      stmt.body.filter((stmt, _, arr) => {
        if (!(stmt instanceof StmtNS.Assign)) return false;

        const { target } = stmt;
        return (
          target instanceof ExprNS.Variable &&
          !arr.some(s => s instanceof StmtNS.NonLocal && s.name.lexeme === target.name.lexeme)
        );
      }).length > 0;

    const body = this.visitFileInputStmt(
      new StmtNS.FileInput(stmt.startToken, stmt.endToken, stmt.body, []),
    );

    return this.list(
      this.string("function_declaration"),
      this.list(this.string("name"), this.dynamicString(`"${stmt.name.lexeme}"`)),
      this.list(
        ...stmt.parameters.map(p => {
          if (p.isStarred) {
            throw new Error("Starred parameters are not supported in parse tree generation");
          }
          return this.dynamicString(`"${p.lexeme}"`);
        }),
      ),
      hasVarDecls ? this.list(this.string("block"), body) : body,
    );
  }

  visitLambdaExpr(expr: ExprNS.Lambda): [number, bigint] {
    return this.list(
      this.string("lambda_expression"),
      this.list(
        ...expr.parameters.map(p => {
          if (p.isStarred) {
            throw new Error("Starred parameters are not supported in parse tree generation");
          }
          return this.dynamicString(`"${p.lexeme}"`);
        }),
      ),
      this.list(this.string("return_statement"), this.visit(expr.body)),
    );
  }

  visitBreakStmt(stmt: StmtNS.Break): [number, bigint] {
    return this.list(this.string("break_statement"));
  }

  visitContinueStmt(stmt: StmtNS.Continue): [number, bigint] {
    return this.list(this.string("continue_statement"));
  }

  visitReturnStmt(stmt: StmtNS.Return): [number, bigint] {
    const valueTree =
      stmt.value != null
        ? this.visit(stmt.value)
        : this.list(this.string("literal"), this.wasmExports.makeNone());

    return this.list(this.string("return_statement"), valueTree);
  }

  visitIfStmt(stmt: StmtNS.If): [number, bigint] {
    const condition = this.visit(stmt.condition);
    const thenBody = this.visitFileInputStmt(
      new StmtNS.FileInput(stmt.startToken, stmt.endToken, stmt.body, []),
    );

    const elseBody =
      stmt.elseBlock && stmt.elseBlock.length > 0
        ? this.visitFileInputStmt(
            new StmtNS.FileInput(stmt.startToken, stmt.endToken, stmt.elseBlock, []),
          )
        : this.wasmExports.makeNone();

    return this.list(this.string("conditional_statement"), condition, thenBody, elseBody);
  }

  visitWhileStmt(stmt: StmtNS.While): [number, bigint] {
    const condition = this.visit(stmt.condition);
    const body = this.visitFileInputStmt(
      new StmtNS.FileInput(stmt.startToken, stmt.endToken, stmt.body, []),
    );

    return this.list(this.string("while_loop"), condition, body);
  }

  visitForStmt(stmt: StmtNS.For): [number, bigint] {
    if (
      !(stmt.iter instanceof ExprNS.Call) ||
      !(stmt.iter.callee instanceof ExprNS.Variable) ||
      stmt.iter.callee.name.lexeme !== "range"
    ) {
      throw new Error("Only range() is supported in for loops");
    } else if (stmt.iter.args.length === 0) {
      throw new Error("range() requires at least one argument");
    } else if (stmt.iter.args.length > 3) {
      throw new Error("range() accepts at most 3 arguments");
    }

    return this.list(
      this.string("for_loop"),
      this.list(this.string("name"), this.dynamicString(`"${stmt.target.lexeme}"`)),
      this.list(this.string("range_args"), ...stmt.iter.args.map(a => this.visit(a))),
      this.visitFileInputStmt(new StmtNS.FileInput(stmt.startToken, stmt.endToken, stmt.body, [])),
    );
  }

  visitCallExpr(expr: ExprNS.Call): [number, bigint] {
    const callee = this.visit(expr.callee);
    const argsList = this.list(...expr.args.map(a => this.visit(a)));

    return this.list(this.string("application"), callee, argsList);
  }

  visitNonLocalStmt(stmt: StmtNS.NonLocal): [number, bigint] {
    return this.list(
      this.string("nonlocal_declaration"),
      this.list(this.string("name"), this.dynamicString(`"${stmt.name.lexeme}"`)),
    );
  }

  visitPassStmt(stmt: StmtNS.Pass): [number, bigint] {
    return this.list(this.string("pass_statement"));
  }

  // UNSUPPORTED / NAME- OR STRING-DEPENDENT NODES
  visitIndentCreation(stmt: StmtNS.Indent): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitDedentCreation(stmt: StmtNS.Dedent): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitFromImportStmt(stmt: StmtNS.FromImport): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitGlobalStmt(stmt: StmtNS.Global): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitComplexExpr(expr: ExprNS.Complex): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitAssertStmt(stmt: StmtNS.Assert): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): [number, bigint] {
    throw new Error("Method not implemented.");
  }
}
