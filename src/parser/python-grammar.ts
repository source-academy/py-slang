// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x) { return x[0]; }

import { ExprNS, StmtNS } from '../ast-types';
let Lexer = undefined;
let ParserRules = [
    {"name": "file_input", "symbols": ["_", "statements", "_", EOF], "postprocess": 
        (d) => {
          const startToken = d[1][0]?.startToken || toAstToken({ type: 'ENDMARKER', value: '', line: 0, col: 0, offset: 0 });
          const endToken = d[1][d[1].length - 1]?.endToken || startToken;
          return new StmtNS.FileInput(startToken, endToken, d[1], []);
        }
            },
    {"name": "statements", "symbols": [], "postprocess": () => []},
    {"name": "statements", "symbols": ["statements", "statement"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "statements", "symbols": ["statements", newline], "postprocess": (d) => d[0]},
    {"name": "statement", "symbols": ["simple_stmt"], "postprocess": id},
    {"name": "statement", "symbols": ["compound_stmt"], "postprocess": id},
    {"name": "simple_stmt", "symbols": ["small_stmt", newline], "postprocess": (d) => d[0]},
    {"name": "small_stmt", "symbols": ["assign_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["pass_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["flow_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["import_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["global_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["nonlocal_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["assert_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["expr_stmt"], "postprocess": id},
    {"name": "assign_stmt", "symbols": [identifier, "_", {"literal":":"}, "_", "test", "_", {"literal":"="}, "_", "test"], "postprocess": 
        (d) => {
          const name = toAstToken(d[0]);
          const value = d[8];
          const ann = d[4];
          return new StmtNS.AnnAssign(name, value.endToken, name, value, ann);
        }
            },
    {"name": "assign_stmt", "symbols": [identifier, "_", {"literal":":"}, "_", "test"], "postprocess": 
        (d) => {
          const name = toAstToken(d[0]);
          const ann = d[4];
          const value = new ExprNS.None(name, name, "None");
          return new StmtNS.AnnAssign(name, ann.endToken, name, value, ann);
        }
            },
    {"name": "assign_stmt", "symbols": [identifier, "_", {"literal":"="}, "_", "test"], "postprocess": 
        (d) => {
          const name = toAstToken(d[0]);
          const value = d[4];
          return new StmtNS.Assign(name, value.endToken, name, value);
        }
            },
    {"name": "pass_stmt", "symbols": [kw_pass], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new StmtNS.Pass(token, token);
        }
            },
    {"name": "flow_stmt", "symbols": ["break_stmt"], "postprocess": id},
    {"name": "flow_stmt", "symbols": ["continue_stmt"], "postprocess": id},
    {"name": "flow_stmt", "symbols": ["return_stmt"], "postprocess": id},
    {"name": "break_stmt", "symbols": [kw_break], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new StmtNS.Break(token, token);
        }
            },
    {"name": "continue_stmt", "symbols": [kw_continue], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new StmtNS.Continue(token, token);
        }
            },
    {"name": "return_stmt", "symbols": [kw_return, "_", "test"], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new StmtNS.Return(token, d[2].endToken, d[2]);
        }
            },
    {"name": "return_stmt", "symbols": [kw_return], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new StmtNS.Return(token, token, null);
        }
            },
    {"name": "import_stmt", "symbols": [kw_from, "_", identifier, "_", kw_import, "_", "import_names"], "postprocess": 
        (d) => {
          const fromToken = toAstToken(d[0]);
          const module = toAstToken(d[2]);
          const names = d[6];
          return new StmtNS.FromImport(fromToken, names[names.length - 1], module, names);
        }
            },
    {"name": "import_names", "symbols": [identifier], "postprocess": (d) => [toAstToken(d[0])]},
    {"name": "import_names", "symbols": [{"literal":"("}, "_", "name_list", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "name_list", "symbols": [identifier], "postprocess": (d) => [toAstToken(d[0])]},
    {"name": "name_list", "symbols": ["name_list", "_", {"literal":","}, "_", identifier], "postprocess": (d) => d[0].concat([toAstToken(d[4])])},
    {"name": "global_stmt", "symbols": [kw_global, "_", identifier], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          const name = toAstToken(d[2]);
          return new StmtNS.Global(token, name, name);
        }
            },
    {"name": "nonlocal_stmt", "symbols": [kw_nonlocal, "_", identifier], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          const name = toAstToken(d[2]);
          return new StmtNS.NonLocal(token, name, name);
        }
            },
    {"name": "assert_stmt", "symbols": [kw_assert, "_", "test"], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new StmtNS.Assert(token, d[2].endToken, d[2]);
        }
            },
    {"name": "expr_stmt", "symbols": ["test"], "postprocess": 
        (d) => {
          const expr = d[0];
          return new StmtNS.SimpleExpr(expr.startToken, expr.endToken, expr);
        }
            },
    {"name": "compound_stmt", "symbols": ["if_stmt"], "postprocess": id},
    {"name": "compound_stmt", "symbols": ["while_stmt"], "postprocess": id},
    {"name": "compound_stmt", "symbols": ["for_stmt"], "postprocess": id},
    {"name": "compound_stmt", "symbols": ["funcdef"], "postprocess": id},
    {"name": "if_stmt", "symbols": [kw_if, "_", "test", "_", {"literal":":"}, "_", "suite", "elif_chain"], "postprocess": 
        (d) => {
          const ifToken = toAstToken(d[0]);
          const condition = d[2];
          const body = d[6];
          const elseBlock = d[7];
          const endToken = elseBlock ? elseBlock[elseBlock.length - 1]?.endToken : body[body.length - 1]?.endToken;
          return new StmtNS.If(ifToken, endToken, condition, body, elseBlock);
        }
            },
    {"name": "elif_chain", "symbols": [kw_elif, "_", "test", "_", {"literal":":"}, "_", "suite", "elif_chain"], "postprocess": 
        (d) => {
          const elifToken = toAstToken(d[0]);
          const condition = d[2];
          const body = d[6];
          const elseBlock = d[7];
          const endToken = elseBlock ? elseBlock[elseBlock.length - 1]?.endToken : body[body.length - 1]?.endToken;
          return [new StmtNS.If(elifToken, endToken, condition, body, elseBlock)];
        }
            },
    {"name": "elif_chain", "symbols": [kw_else, "_", {"literal":":"}, "_", "suite"], "postprocess": 
        (d) => d[4]
            },
    {"name": "elif_chain", "symbols": [], "postprocess": () => null},
    {"name": "while_stmt", "symbols": [kw_while, "_", "test", "_", {"literal":":"}, "_", "suite"], "postprocess": 
        (d) => {
          const whileToken = toAstToken(d[0]);
          const condition = d[2];
          const body = d[6];
          const endToken = body[body.length - 1]?.endToken || whileToken;
          return new StmtNS.While(whileToken, endToken, condition, body);
        }
            },
    {"name": "for_stmt", "symbols": [kw_for, "_", identifier, "_", kw_in, "_", "test", "_", {"literal":":"}, "_", "suite"], "postprocess": 
        (d) => {
          const forToken = toAstToken(d[0]);
          const target = toAstToken(d[2]);
          const iter = d[6];
          const body = d[10];
          const endToken = body[body.length - 1]?.endToken || forToken;
          return new StmtNS.For(forToken, endToken, target, iter, body);
        }
            },
    {"name": "funcdef", "symbols": [kw_def, "_", identifier, "_", "parameters", "_", {"literal":":"}, "_", "suite"], "postprocess": 
        (d) => {
          const defToken = toAstToken(d[0]);
          const name = toAstToken(d[2]);
          const params = d[4];
          const body = d[8];
          const endToken = body[body.length - 1]?.endToken || name;
          return new StmtNS.FunctionDef(defToken, endToken, name, params, body, []);
        }
            },
    {"name": "parameters", "symbols": [{"literal":"("}, "_", {"literal":")"}], "postprocess": () => []},
    {"name": "parameters", "symbols": [{"literal":"("}, "_", "varargslist", "_", {"literal":")"}], "postprocess": (d) => d[2]},
    {"name": "varargslist", "symbols": [identifier], "postprocess": (d) => [toAstToken(d[0])]},
    {"name": "varargslist", "symbols": ["varargslist", "_", {"literal":","}, "_", identifier], "postprocess": (d) => d[0].concat([toAstToken(d[4])])},
    {"name": "suite", "symbols": ["simple_stmt"], "postprocess": (d) => [d[0]]},
    {"name": "suite", "symbols": [newline, INDENT, "suite_stmts", DEDENT], "postprocess": (d) => d[2]},
    {"name": "suite_stmts", "symbols": ["statement"], "postprocess": (d) => [d[0]]},
    {"name": "suite_stmts", "symbols": ["suite_stmts", "statement"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "suite_stmts", "symbols": ["suite_stmts", newline], "postprocess": (d) => d[0]},
    {"name": "test", "symbols": ["or_test", "_", kw_if, "_", "or_test", "_", kw_else, "_", "test"], "postprocess": 
        (d) => {
          const consequent = d[0];
          const predicate = d[4];
          const alternative = d[8];
          return new ExprNS.Ternary(consequent.startToken, alternative.endToken, predicate, consequent, alternative);
        }
            },
    {"name": "test", "symbols": ["or_test"], "postprocess": id},
    {"name": "test", "symbols": ["lambdef"], "postprocess": id},
    {"name": "lambdef", "symbols": [kw_lambda, "_", "varargslist", "_", {"literal":":"}, "_", "test"], "postprocess": 
        (d) => {
          const lambdaToken = toAstToken(d[0]);
          const params = d[2];
          const body = d[6];
          return new ExprNS.Lambda(lambdaToken, body.endToken, params, body);
        }
            },
    {"name": "lambdef$string$1", "symbols": [{"literal":":"}, {"literal":":"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "lambdef", "symbols": [kw_lambda, "_", "varargslist", "_", "lambdef$string$1", "_", "suite"], "postprocess": 
        (d) => {
          const lambdaToken = toAstToken(d[0]);
          const params = d[2];
          const body = d[6];
          const endToken = body[body.length - 1]?.endToken || lambdaToken;
          return new ExprNS.MultiLambda(lambdaToken, endToken, params, body, []);
        }
            },
    {"name": "lambdef", "symbols": [kw_lambda, "_", {"literal":":"}, "_", "test"], "postprocess": 
        (d) => {
          const lambdaToken = toAstToken(d[0]);
          const body = d[4];
          return new ExprNS.Lambda(lambdaToken, body.endToken, [], body);
        }
            },
    {"name": "lambdef$string$2", "symbols": [{"literal":":"}, {"literal":":"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "lambdef", "symbols": [kw_lambda, "_", "lambdef$string$2", "_", "suite"], "postprocess": 
        (d) => {
          const lambdaToken = toAstToken(d[0]);
          const body = d[4];
          const endToken = body[body.length - 1]?.endToken || lambdaToken;
          return new ExprNS.MultiLambda(lambdaToken, endToken, [], body, []);
        }
            },
    {"name": "or_test", "symbols": ["and_test", "_", kw_or, "_", "or_test"], "postprocess": 
        (d) => {
          const left = d[0];
          const operator = toAstToken(d[2]);
          const right = d[4];
          return new ExprNS.BoolOp(left.startToken, right.endToken, left, operator, right);
        }
            },
    {"name": "or_test", "symbols": ["and_test"], "postprocess": id},
    {"name": "and_test", "symbols": ["not_test", "_", kw_and, "_", "and_test"], "postprocess": 
        (d) => {
          const left = d[0];
          const operator = toAstToken(d[2]);
          const right = d[4];
          return new ExprNS.BoolOp(left.startToken, right.endToken, left, operator, right);
        }
            },
    {"name": "and_test", "symbols": ["not_test"], "postprocess": id},
    {"name": "not_test", "symbols": [kw_not, "_", "not_test"], "postprocess": 
        (d) => {
          const operator = toAstToken(d[0]);
          const right = d[2];
          return new ExprNS.Unary(operator, right.endToken, operator, right);
        }
            },
    {"name": "not_test", "symbols": ["comparison"], "postprocess": id},
    {"name": "comparison", "symbols": ["arith_expr", "_", "comp_op", "_", "comparison"], "postprocess": 
        (d) => {
          const left = d[0];
          const operator = d[2];
          const right = d[4];
          return new ExprNS.Compare(left.startToken, right.endToken, left, operator, right);
        }
            },
    {"name": "comparison", "symbols": ["arith_expr"], "postprocess": id},
    {"name": "comp_op", "symbols": [less], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [greater], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [doubleequal], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [greaterequal], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [lessequal], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [notequal], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [kw_in], "postprocess": (d) => toAstToken(d[0])},
    {"name": "comp_op", "symbols": [kw_not, "_", kw_in], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          token.type = 'NOTIN';
          return token;
        }
            },
    {"name": "comp_op", "symbols": [kw_is], "postprocess": 
        (d) => toAstToken(d[0])
            },
    {"name": "comp_op", "symbols": [kw_is, "_", kw_not], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          token.type = 'ISNOT';
          return token;
        }
            },
    {"name": "arith_expr", "symbols": ["term", "_", "arith_op", "_", "arith_expr"], "postprocess": 
        (d) => {
          const left = d[0];
          const operator = d[2];
          const right = d[4];
          return new ExprNS.Binary(left.startToken, right.endToken, left, operator, right);
        }
            },
    {"name": "arith_expr", "symbols": ["term"], "postprocess": id},
    {"name": "arith_op", "symbols": [plus], "postprocess": (d) => toAstToken(d[0])},
    {"name": "arith_op", "symbols": [minus], "postprocess": (d) => toAstToken(d[0])},
    {"name": "term", "symbols": ["factor", "_", "term_op", "_", "term"], "postprocess": 
        (d) => {
          const left = d[0];
          const operator = d[2];
          const right = d[4];
          return new ExprNS.Binary(left.startToken, right.endToken, left, operator, right);
        }
            },
    {"name": "term", "symbols": ["factor"], "postprocess": id},
    {"name": "term_op", "symbols": [star], "postprocess": (d) => toAstToken(d[0])},
    {"name": "term_op", "symbols": [slash], "postprocess": (d) => toAstToken(d[0])},
    {"name": "term_op", "symbols": [percent], "postprocess": (d) => toAstToken(d[0])},
    {"name": "term_op", "symbols": [doubleslash], "postprocess": (d) => toAstToken(d[0])},
    {"name": "factor", "symbols": ["unary_op", "_", "factor"], "postprocess": 
        (d) => {
          const operator = d[0];
          const right = d[2];
          return new ExprNS.Unary(operator, right.endToken, operator, right);
        }
            },
    {"name": "factor", "symbols": ["power"], "postprocess": id},
    {"name": "unary_op", "symbols": [plus], "postprocess": (d) => toAstToken(d[0])},
    {"name": "unary_op", "symbols": [minus], "postprocess": (d) => toAstToken(d[0])},
    {"name": "power", "symbols": ["atom_expr", "_", doublestar, "_", "factor"], "postprocess": 
        (d) => {
          const left = d[0];
          const operator = toAstToken(d[2]);
          const right = d[4];
          return new ExprNS.Binary(left.startToken, right.endToken, left, operator, right);
        }
            },
    {"name": "power", "symbols": ["atom_expr"], "postprocess": id},
    {"name": "atom_expr", "symbols": ["atom", {"literal":"("}, "_", "test_list", "_", {"literal":")"}], "postprocess": 
        (d) => {
          const callee = d[0];
          const args = d[3];
          const endToken = args.length > 0 ? args[args.length - 1].endToken : callee.endToken;
          return new ExprNS.Call(callee.startToken, endToken, callee, args);
        }
            },
    {"name": "atom_expr", "symbols": ["atom", {"literal":"("}, "_", {"literal":")"}], "postprocess": 
        (d) => {
          const callee = d[0];
          return new ExprNS.Call(callee.startToken, callee.endToken, callee, []);
        }
            },
    {"name": "atom_expr", "symbols": ["atom"], "postprocess": id},
    {"name": "test_list", "symbols": ["test"], "postprocess": (d) => [d[0]]},
    {"name": "test_list", "symbols": ["test_list", "_", {"literal":","}, "_", "test"], "postprocess": (d) => d[0].concat([d[4]])},
    {"name": "test_list", "symbols": ["test", "_", {"literal":","}], "postprocess": (d) => [d[0]]},
    {"name": "atom", "symbols": [{"literal":"("}, "_", "test", "_", {"literal":")"}], "postprocess": 
        (d) => {
          const lparen = toAstToken({ type: 'LPAREN', value: '(', line: 0, col: 0, offset: 0 });
          const rparen = toAstToken({ type: 'RPAREN', value: ')', line: 0, col: 0, offset: 0 });
          return new ExprNS.Grouping(lparen, rparen, d[2]);
        }
            },
    {"name": "atom", "symbols": [identifier], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.Variable(token, token, token);
        }
            },
    {"name": "atom", "symbols": [float], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.Literal(token, token, parseFloat(token.lexeme));
        }
            },
    {"name": "atom", "symbols": [bigint], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.BigIntLiteral(token, token, token.lexeme);
        }
            },
    {"name": "atom", "symbols": [complex], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.Complex(token, token, token.lexeme);
        }
            },
    {"name": "atom", "symbols": ["string_literal"], "postprocess": 
        (d) => {
          const token = d[0];
          return new ExprNS.Literal(token, token, token.lexeme);
        }
            },
    {"name": "atom", "symbols": [kw_None], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.None(token, token, "None");
        }
            },
    {"name": "atom", "symbols": [kw_True], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.Literal(token, token, true);
        }
            },
    {"name": "atom", "symbols": [kw_False], "postprocess": 
        (d) => {
          const token = toAstToken(d[0]);
          return new ExprNS.Literal(token, token, false);
        }
            },
    {"name": "string_literal", "symbols": [stringTripleDouble], "postprocess": (d) => toAstToken(d[0])},
    {"name": "string_literal", "symbols": [stringTripleSingle], "postprocess": (d) => toAstToken(d[0])},
    {"name": "string_literal", "symbols": [stringDouble], "postprocess": (d) => toAstToken(d[0])},
    {"name": "string_literal", "symbols": [stringSingle], "postprocess": (d) => toAstToken(d[0])},
    {"name": "_", "symbols": []},
    {"name": "_", "symbols": [ws]},
    {"name": "__", "symbols": [ws]}
];
let ParserStart = "file_input";
export default { Lexer, ParserRules, ParserStart };
