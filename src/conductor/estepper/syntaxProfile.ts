/**
 * The e-stepper's {@link SyntaxProfile}: the substitution stepper's Python profile plus the
 * Python §3/§4 constructs the substitution stepper does not reach (loops, subscripts, scope
 * declarations, spread arguments). `EnvBlock` and `Ref` are rendered by the e-stepper host itself;
 * the fallback templates here only matter for a host that does not know them.
 */

import type { SyntaxProfile, SyntaxTemplatePart } from "@sourceacademy/common-stepper";

import { pythonSyntaxProfile } from "../stepper/syntaxProfile";

const keyword = (token: string): SyntaxTemplatePart => ({ token, cls: "identifier" });

export const eStepperSyntaxProfile: SyntaxProfile = {
  ...pythonSyntaxProfile,
  templates: {
    ...pythonSyntaxProfile.templates,
    MemberExpression: [{ child: "object" }, "[", { child: "property" }, "]"],
    AssignmentStatement: [{ child: "target" }, " = ", { child: "value" }],
    SpreadElement: [{ token: "*", cls: "operator" }, { child: "argument" }],
    WhileStatement: [keyword("while "), { child: "test" }, keyword(":"), { child: "body" }],
    ForStatement: [
      keyword("for "),
      { child: "target" },
      keyword(" in "),
      { child: "iter" },
      keyword(":"),
      { child: "body" },
    ],
    // One loop iteration in progress: the rest of its body, then the loop for the next iteration.
    LoopIteration: [{ lines: "statements" }],
    BreakStatement: [keyword("break")],
    ContinueStatement: [keyword("continue")],
    GlobalStatement: [keyword("global "), { prop: "names" }],
    NonlocalStatement: [keyword("nonlocal "), { prop: "names" }],
    EnvBlock: [
      { token: "⟦", cls: "operator" },
      { prop: "envId", cls: "identifier" },
      { token: "⟧", cls: "operator" },
    ],
    Ref: [{ prop: "objectId", cls: "literal" }],
  },
  expressionPrecedence: {
    ...pythonSyntaxProfile.expressionPrecedence,
    MemberExpression: 20,
    Ref: 20,
    EnvBlock: 20,
  },
};
