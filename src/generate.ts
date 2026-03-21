/*
 * Script to autogenerate our things.
 *
 * So far it's just the AST data types that need generating.
 * */

import { AstWriter } from "./generate-ast";
const writer = new AstWriter({
  additionalImports: ['import { PyComplexNumber } from "./types";'],
  typeAliases: [
    "export type FunctionParam = Token & { isStarred: boolean };",
    "export type AssignTarget = ExprNS.Variable | ExprNS.Subscript;",
  ],
  fieldOverrides: {
    "Complex.value": {
      fieldType: "PyComplexNumber",
      constructorType: "string",
      transform: "PyComplexNumber.fromString(value)",
    },
  },
});
writer.main();
