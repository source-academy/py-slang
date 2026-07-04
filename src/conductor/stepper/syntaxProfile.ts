/**
 * The Python {@link SyntaxProfile}: the data the host renderer uses to display Python surface syntax.
 *
 * The stepper host is language-agnostic — it renders a structural (estree-shaped) AST and knows no
 * language's grammar. Each language ships a profile describing how to render its node types; the host
 * is a generic interpreter of these profiles. So Python's surface syntax (`lambda`/`def`/`a if c else
 * b`, `:`-introduced indented suites, no semicolons/braces) lives **here**, in the language plugin,
 * not in the host. A new language becomes renderable by shipping its own profile — the host is never
 * edited.
 *
 * A template is an ordered list of parts (see `SyntaxTemplatePart`): literal tokens, child-node
 * references (`child`/`list`/`block`/`lines`), node properties (`prop`), and conditional groups
 * (`when`). The precedence maps let the host insert parentheses generically (e.g. `(1 + 2) * 3`).
 */

import type { SyntaxProfile } from "@sourceacademy/common-stepper";

export const pythonSyntaxProfile: SyntaxProfile = {
  templates: {
    // Program / statements
    Program: [{ lines: "body" }],
    ExpressionStatement: [{ child: "expression" }],
    VariableDeclaration: [{ list: "declarations", sep: ", " }],
    VariableDeclarator: [{ child: "id" }, " = ", { child: "init" }],
    FunctionDeclaration: [
      { token: "def ", cls: "identifier" },
      // The function name is part of the `def` keyword group, coloured like Source's `function map`.
      { prop: "id.name", cls: "identifier" },
      "(",
      { list: "params", sep: ", " },
      "):",
      { child: "body" },
    ],
    BlockStatement: [{ block: "body" }],
    ReturnStatement: [{ token: "return ", cls: "operator" }, { child: "argument" }],
    IfStatement: [
      { token: "if ", cls: "identifier" },
      { child: "test" },
      { token: ":", cls: "identifier" },
      { child: "consequent" },
      { when: "alternate", parts: [{ token: "else:", cls: "identifier" }, { child: "alternate" }] },
    ],
    PassStatement: [{ token: "pass", cls: "identifier" }],
    // `breakpoint()` renders as the plain call it came from (see `translate.ts`), so a student sees the
    // same text they typed; it is a no-op statement that also marks a stepper breakpoint.
    DebuggerStatement: ["breakpoint()"],

    // Atoms
    Literal: [{ prop: "raw", cls: "literal" }],
    // Plain names are uncoloured (white), like Source — only keywords/operators are coloured. A
    // function name shown as a value collapses to a bold mu-term (see `functionValues` below).
    Identifier: [{ prop: "name" }],

    // Expressions
    BinaryExpression: [
      { child: "left" },
      " ",
      { prop: "operator", cls: "operator" },
      " ",
      { child: "right", isRight: true },
    ],
    LogicalExpression: [
      { child: "left" },
      " ",
      { prop: "operator", cls: "operator" },
      " ",
      { child: "right", isRight: true },
    ],
    UnaryExpression: [{ prop: "operator", cls: "operator" }, { child: "argument" }],
    ConditionalExpression: [
      { child: "consequent" },
      { token: " if ", cls: "conditional" },
      { child: "test" },
      { token: " else ", cls: "conditional" },
      { child: "alternate" },
    ],
    CallExpression: [{ child: "callee" }, "(", { list: "arguments", sep: ", " }, ")"],
    // Python lambdas never parenthesise their parameters: `lambda x, y: body` / `lambda: body`.
    ArrowFunctionExpression: [
      { token: "lambda", cls: "identifier" },
      { list: "params", sep: ", ", prefix: " " },
      { token: ": ", cls: "identifier" },
      { child: "body" },
    ],
    ArrayExpression: ["[", { list: "elements", sep: ", " }, "]"],
  },

  // Parenthesisation precedence (higher binds tighter). Mirrors Python's grammar; the host wraps a
  // child in parentheses when it binds looser than its parent (e.g. `(1 + 2) * 3`).
  operatorPrecedence: {
    or: 2,
    and: 4,
    "==": 8,
    "!=": 8,
    "<": 9,
    ">": 9,
    "<=": 9,
    ">=": 9,
    "+": 11,
    "-": 11,
    "*": 12,
    "/": 12,
    "//": 12,
    "%": 12,
    "**": 13,
  },
  expressionPrecedence: {
    Identifier: 20,
    ArrayExpression: 20,
    Literal: 18,
    CallExpression: 18,
    UnaryExpression: 15,
    BinaryExpression: 14,
    LogicalExpression: 13,
    ConditionalExpression: 4,
    // Loose: a lambda/def used where a tighter context expects an operand is parenthesised
    // (e.g. an immediately-applied `(lambda x: x)(4)`), but not in a plain binding.
    ArrowFunctionExpression: 1,
    FunctionDeclaration: 1,
  },

  // Function values in the substitution model. A named one (a `def`, or a `lambda` bound to a name)
  // is substituted into the program carrying a `name`; the host then renders it collapsed as that
  // name — a bold mu-term you hover to reveal the body — instead of expanding the whole body inline
  // at every use, exactly like Source. An anonymous `lambda` (no `name`) keeps rendering inline.
  functionValues: [
    { type: "ArrowFunctionExpression", nameProp: "name" },
    { type: "FunctionDeclaration", nameProp: "name" },
  ],
};
