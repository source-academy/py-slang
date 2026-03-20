import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import { StmtNS } from "../ast-types";
import Stmt = StmtNS.Stmt;

export function toPythonAst(text: string): Stmt {
  const script = text + "\n";
  return parse(script);
}

export function toPythonAstAndResolve(text: string): Stmt {
  const script = text + "\n";
  const ast = toPythonAst(text);
  const resolver = new Resolver(script, ast);
  resolver.resolve(ast);
  return ast;
}
