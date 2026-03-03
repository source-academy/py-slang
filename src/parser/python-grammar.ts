// @ts-nocheck
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x) { return x[0]; }

import { StmtNS, ExprNS } from '../ast-types';
import pythonLexer from './lexer';
import { toAstToken } from './token-bridge';

const nil = () => null;
const list = ([x]) => [x];
const cons = ([xs, x]) => [...xs, x];
const drop = () => [];
let Lexer = pythonLexer;
let ParserRules = [
    {"name": "file", "symbols": ["stmts"], "postprocess":  ([stmts]) => {
          const filtered = (stmts || []).filter(Boolean);
          const start = filtered[0]
            ? filtered[0].startToken
            : toAstToken({type:'newline',value:'',line:1,col:1,offset:0});
          const end = filtered.length > 0
            ? filtered[filtered.length-1].endToken
            : start;
          return new StmtNS.FileInput(start, end, filtered, []);
        } },
    {"name": "stmts", "symbols": [], "postprocess": drop},
    {"name": "stmts", "symbols": ["stmts", "stmt"], "postprocess": ([xs, x]) => x ? [...xs, x] : xs},
    {"name": "stmts", "symbols": ["stmts", (pythonLexer.has("newline") ? {type: "newline"} : newline)], "postprocess": id},
    {"name": "stmts", "symbols": ["stmts", (pythonLexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id},
    {"name": "stmt", "symbols": ["simple_stmt"], "postprocess": id},
    {"name": "stmt", "symbols": ["compound_stmt"], "postprocess": id},
    {"name": "simple_stmt", "symbols": ["small_stmt", (pythonLexer.has("newline") ? {type: "newline"} : newline)], "postprocess": id},
    {"name": "small_stmt", "symbols": ["pass_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["break_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["continue_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["return_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["assign_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["import_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["global_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["nonlocal_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["assert_stmt"], "postprocess": id},
    {"name": "small_stmt", "symbols": ["expr_stmt"], "postprocess": id},
    {"name": "pass_stmt", "symbols": [(pythonLexer.has("kw_pass") ? {type: "kw_pass"} : kw_pass)], "postprocess": ([t]) => { const tok = toAstToken(t); return new StmtNS.Pass(tok, tok); }},
    {"name": "break_stmt", "symbols": [(pythonLexer.has("kw_break") ? {type: "kw_break"} : kw_break)], "postprocess": ([t]) => { const tok = toAstToken(t); return new StmtNS.Break(tok, tok); }},
    {"name": "continue_stmt", "symbols": [(pythonLexer.has("kw_continue") ? {type: "kw_continue"} : kw_continue)], "postprocess": ([t]) => { const tok = toAstToken(t); return new StmtNS.Continue(tok, tok); }},
    {"name": "return_stmt", "symbols": [(pythonLexer.has("kw_return") ? {type: "kw_return"} : kw_return), "_", "test"], "postprocess": ([kw,, expr]) => new StmtNS.Return(toAstToken(kw), expr.endToken, expr)},
    {"name": "return_stmt", "symbols": [(pythonLexer.has("kw_return") ? {type: "kw_return"} : kw_return)], "postprocess": ([t]) => { const tok = toAstToken(t); return new StmtNS.Return(tok, tok, null); }},
    {"name": "assign_stmt", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier), "_", {"literal":":"}, "_", "test", "_", {"literal":"="}, "_", "test"], "postprocess": ([n,,,, ann,,,, v]) => new StmtNS.AnnAssign(toAstToken(n), v.endToken, toAstToken(n), v, ann)},
    {"name": "assign_stmt", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier), "_", {"literal":":"}, "_", "test"], "postprocess":  ([n,,,, ann]) => {
          const nameTok = toAstToken(n);
          const dummyVal = new ExprNS.None(ann.endToken, ann.endToken);
          return new StmtNS.AnnAssign(nameTok, ann.endToken, nameTok, dummyVal, ann);
        } },
    {"name": "assign_stmt", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier), "_", {"literal":"="}, "_", "test"], "postprocess": ([n,,,, v]) => new StmtNS.Assign(toAstToken(n), v.endToken, toAstToken(n), v)},
    {"name": "import_stmt", "symbols": [(pythonLexer.has("kw_from") ? {type: "kw_from"} : kw_from), "_", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier), "_", (pythonLexer.has("kw_import") ? {type: "kw_import"} : kw_import), "_", "import_names"], "postprocess": ([kw,, mod,,,, names]) => new StmtNS.FromImport(toAstToken(kw), names[names.length-1], toAstToken(mod), names)},
    {"name": "import_names", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([t]) => [toAstToken(t)]},
    {"name": "import_names", "symbols": [{"literal":"("}, "_", "name_list", "_", {"literal":")"}], "postprocess": ([,, ns]) => ns},
    {"name": "name_list", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([t]) => [toAstToken(t)]},
    {"name": "name_list", "symbols": ["name_list", "_", {"literal":","}, "_", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([ns,,,, t]) => [...ns, toAstToken(t)]},
    {"name": "global_stmt", "symbols": [(pythonLexer.has("kw_global") ? {type: "kw_global"} : kw_global), "_", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([kw,, n]) => new StmtNS.Global(toAstToken(kw), toAstToken(n), toAstToken(n))},
    {"name": "nonlocal_stmt", "symbols": [(pythonLexer.has("kw_nonlocal") ? {type: "kw_nonlocal"} : kw_nonlocal), "_", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([kw,, n]) => new StmtNS.NonLocal(toAstToken(kw), toAstToken(n), toAstToken(n))},
    {"name": "assert_stmt", "symbols": [(pythonLexer.has("kw_assert") ? {type: "kw_assert"} : kw_assert), "_", "test"], "postprocess": ([kw,, e]) => new StmtNS.Assert(toAstToken(kw), e.endToken, e)},
    {"name": "expr_stmt", "symbols": ["test"], "postprocess": ([e]) => new StmtNS.SimpleExpr(e.startToken, e.endToken, e)},
    {"name": "compound_stmt", "symbols": ["if_stmt"], "postprocess": id},
    {"name": "compound_stmt", "symbols": ["while_stmt"], "postprocess": id},
    {"name": "compound_stmt", "symbols": ["for_stmt"], "postprocess": id},
    {"name": "compound_stmt", "symbols": ["funcdef"], "postprocess": id},
    {"name": "if_stmt", "symbols": [(pythonLexer.has("kw_if") ? {type: "kw_if"} : kw_if), "_", "test", "_", {"literal":":"}, "_", "suite", "elif_chain"], "postprocess":  ([kw,, test,,,, body, else_]) =>
        new StmtNS.If(toAstToken(kw),
          (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
          test, body, else_) },
    {"name": "elif_chain", "symbols": [(pythonLexer.has("kw_elif") ? {type: "kw_elif"} : kw_elif), "_", "test", "_", {"literal":":"}, "_", "suite", "elif_chain"], "postprocess":  ([kw,, test,,,, body, else_]) => [new StmtNS.If(toAstToken(kw),
        (else_ && else_.length > 0) ? else_[else_.length-1].endToken : body[body.length-1].endToken,
        test, body, else_)] },
    {"name": "elif_chain", "symbols": [(pythonLexer.has("kw_else") ? {type: "kw_else"} : kw_else), "_", {"literal":":"}, "_", "suite"], "postprocess": ([,,,, body]) => body},
    {"name": "elif_chain", "symbols": [], "postprocess": nil},
    {"name": "while_stmt", "symbols": [(pythonLexer.has("kw_while") ? {type: "kw_while"} : kw_while), "_", "test", "_", {"literal":":"}, "_", "suite"], "postprocess":  ([kw,, test,,,, body]) =>
        new StmtNS.While(toAstToken(kw), body[body.length-1].endToken, test, body) },
    {"name": "for_stmt", "symbols": [(pythonLexer.has("kw_for") ? {type: "kw_for"} : kw_for), "_", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier), "_", (pythonLexer.has("kw_in") ? {type: "kw_in"} : kw_in), "_", "test", "_", {"literal":":"}, "_", "suite"], "postprocess":  ([kw,, target,,,, iter,,,, body]) =>
        new StmtNS.For(toAstToken(kw), body[body.length-1].endToken, toAstToken(target), iter, body) },
    {"name": "funcdef", "symbols": [(pythonLexer.has("kw_def") ? {type: "kw_def"} : kw_def), "_", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier), "_", "params", "_", {"literal":":"}, "_", "suite"], "postprocess":  ([kw,, name,, params,,,, body]) =>
        new StmtNS.FunctionDef(toAstToken(kw), body[body.length-1].endToken,
          toAstToken(name), params, body, []) },
    {"name": "params", "symbols": [{"literal":"("}, "_nl", {"literal":")"}], "postprocess": drop},
    {"name": "params", "symbols": [{"literal":"("}, "_nl", "param_list", "_nl", {"literal":")"}], "postprocess": ([,, ps]) => ps},
    {"name": "param_list", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([t]) => [toAstToken(t)]},
    {"name": "param_list", "symbols": ["param_list", "_nl", {"literal":","}, "_nl", (pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([ps,,,, t]) => [...ps, toAstToken(t)]},
    {"name": "suite", "symbols": ["simple_stmt"], "postprocess": list},
    {"name": "suite", "symbols": [(pythonLexer.has("newline") ? {type: "newline"} : newline), (pythonLexer.has("indent") ? {type: "indent"} : indent), "suite_stmts", (pythonLexer.has("dedent") ? {type: "dedent"} : dedent)], "postprocess": ([,, stmts]) => stmts},
    {"name": "suite_stmts", "symbols": ["_", "stmt"], "postprocess": ([, s]) => [s]},
    {"name": "suite_stmts", "symbols": ["suite_stmts", "_", "stmt"], "postprocess": ([xs,, s]) => [...xs, s]},
    {"name": "suite_stmts", "symbols": ["suite_stmts", (pythonLexer.has("newline") ? {type: "newline"} : newline)], "postprocess": id},
    {"name": "test", "symbols": ["or_test", "_", (pythonLexer.has("kw_if") ? {type: "kw_if"} : kw_if), "_", "or_test", "_", (pythonLexer.has("kw_else") ? {type: "kw_else"} : kw_else), "_", "test"], "postprocess": ([cons,,,, test,,,, alt]) => new ExprNS.Ternary(cons.startToken, alt.endToken, test, cons, alt)},
    {"name": "test", "symbols": ["or_test"], "postprocess": id},
    {"name": "test", "symbols": ["lambdef"], "postprocess": id},
    {"name": "lambdef", "symbols": [(pythonLexer.has("kw_lambda") ? {type: "kw_lambda"} : kw_lambda), "_", "param_list", "_", {"literal":":"}, "_", "test"], "postprocess": ([kw,, params,,,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, params, body)},
    {"name": "lambdef", "symbols": [(pythonLexer.has("kw_lambda") ? {type: "kw_lambda"} : kw_lambda), "_", "param_list", "_", {"literal":"::"}, "_", "suite"], "postprocess":  ([kw,, params,,,, body]) =>
        new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, params, body, []) },
    {"name": "lambdef", "symbols": [(pythonLexer.has("kw_lambda") ? {type: "kw_lambda"} : kw_lambda), "_", {"literal":":"}, "_", "test"], "postprocess": ([kw,,,, body]) => new ExprNS.Lambda(toAstToken(kw), body.endToken, [], body)},
    {"name": "lambdef", "symbols": [(pythonLexer.has("kw_lambda") ? {type: "kw_lambda"} : kw_lambda), "_", {"literal":"::"}, "_", "suite"], "postprocess":  ([kw,,,, body]) =>
        new ExprNS.MultiLambda(toAstToken(kw), body[body.length-1].endToken, [], body, []) },
    {"name": "or_test", "symbols": ["and_test", "_", (pythonLexer.has("kw_or") ? {type: "kw_or"} : kw_or), "_", "or_test"], "postprocess": ([left,, op,, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right)},
    {"name": "or_test", "symbols": ["and_test"], "postprocess": id},
    {"name": "and_test", "symbols": ["not_test", "_", (pythonLexer.has("kw_and") ? {type: "kw_and"} : kw_and), "_", "and_test"], "postprocess": ([left,, op,, right]) => new ExprNS.BoolOp(left.startToken, right.endToken, left, toAstToken(op), right)},
    {"name": "and_test", "symbols": ["not_test"], "postprocess": id},
    {"name": "not_test", "symbols": [(pythonLexer.has("kw_not") ? {type: "kw_not"} : kw_not), "_", "not_test"], "postprocess": ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg)},
    {"name": "not_test", "symbols": ["comparison"], "postprocess": id},
    {"name": "comparison", "symbols": ["arith", "_", "comp_op", "_", "comparison"], "postprocess": ([left,, op,, right]) => new ExprNS.Compare(left.startToken, right.endToken, left, op, right)},
    {"name": "comparison", "symbols": ["arith"], "postprocess": id},
    {"name": "comp_op", "symbols": [(pythonLexer.has("less") ? {type: "less"} : less)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("greater") ? {type: "greater"} : greater)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("doubleequal") ? {type: "doubleequal"} : doubleequal)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("greaterequal") ? {type: "greaterequal"} : greaterequal)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("lessequal") ? {type: "lessequal"} : lessequal)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("notequal") ? {type: "notequal"} : notequal)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("kw_in") ? {type: "kw_in"} : kw_in)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("kw_not") ? {type: "kw_not"} : kw_not), "_", (pythonLexer.has("kw_in") ? {type: "kw_in"} : kw_in)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("kw_is") ? {type: "kw_is"} : kw_is)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "comp_op", "symbols": [(pythonLexer.has("kw_is") ? {type: "kw_is"} : kw_is), "_", (pythonLexer.has("kw_not") ? {type: "kw_not"} : kw_not)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "arith", "symbols": ["term", "_", "arith_op", "_", "arith"], "postprocess": ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right)},
    {"name": "arith", "symbols": ["term"], "postprocess": id},
    {"name": "arith_op", "symbols": [(pythonLexer.has("plus") ? {type: "plus"} : plus)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "arith_op", "symbols": [(pythonLexer.has("minus") ? {type: "minus"} : minus)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "term", "symbols": ["factor", "_", "term_op", "_", "term"], "postprocess": ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, op, right)},
    {"name": "term", "symbols": ["factor"], "postprocess": id},
    {"name": "term_op", "symbols": [(pythonLexer.has("star") ? {type: "star"} : star)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "term_op", "symbols": [(pythonLexer.has("slash") ? {type: "slash"} : slash)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "term_op", "symbols": [(pythonLexer.has("percent") ? {type: "percent"} : percent)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "term_op", "symbols": [(pythonLexer.has("doubleslash") ? {type: "doubleslash"} : doubleslash)], "postprocess": ([t]) => toAstToken(t)},
    {"name": "factor", "symbols": [(pythonLexer.has("plus") ? {type: "plus"} : plus), "_", "factor"], "postprocess": ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg)},
    {"name": "factor", "symbols": [(pythonLexer.has("minus") ? {type: "minus"} : minus), "_", "factor"], "postprocess": ([op,, arg]) => new ExprNS.Unary(toAstToken(op), arg.endToken, toAstToken(op), arg)},
    {"name": "factor", "symbols": ["power"], "postprocess": id},
    {"name": "power", "symbols": ["atom_expr", "_", (pythonLexer.has("doublestar") ? {type: "doublestar"} : doublestar), "_", "factor"], "postprocess": ([left,, op,, right]) => new ExprNS.Binary(left.startToken, right.endToken, left, toAstToken(op), right)},
    {"name": "power", "symbols": ["atom_expr"], "postprocess": id},
    {"name": "atom_expr", "symbols": ["atom_expr", (pythonLexer.has("lsqb") ? {type: "lsqb"} : lsqb), "_", "test", "_", (pythonLexer.has("rsqb") ? {type: "rsqb"} : rsqb)], "postprocess": ([obj, ,, idx,, rsqb]) => new ExprNS.Subscript(obj.startToken, toAstToken(rsqb), obj, idx)},
    {"name": "atom_expr", "symbols": ["atom_expr", {"literal":"("}, "_", "args", "_", {"literal":")"}], "postprocess": ([callee,,, args,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, args)},
    {"name": "atom_expr", "symbols": ["atom_expr", {"literal":"("}, "_", {"literal":")"}], "postprocess": ([callee,,, rparen]) => new ExprNS.Call(callee.startToken, toAstToken(rparen), callee, [])},
    {"name": "atom_expr", "symbols": ["atom"], "postprocess": id},
    {"name": "args", "symbols": ["test"], "postprocess": list},
    {"name": "args", "symbols": ["args", "_", {"literal":","}, "_", "test"], "postprocess": ([as,,,, a]) => [...as, a]},
    {"name": "args", "symbols": ["test", "_", {"literal":","}], "postprocess": list},
    {"name": "atom", "symbols": [{"literal":"("}, "_", "test", "_", {"literal":")"}], "postprocess": ([,, e]) => new ExprNS.Grouping(e.startToken, e.endToken, e)},
    {"name": "atom", "symbols": [(pythonLexer.has("lsqb") ? {type: "lsqb"} : lsqb), "_", (pythonLexer.has("rsqb") ? {type: "rsqb"} : rsqb)], "postprocess": ([l,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), [])},
    {"name": "atom", "symbols": [(pythonLexer.has("lsqb") ? {type: "lsqb"} : lsqb), "_", "args", "_", (pythonLexer.has("rsqb") ? {type: "rsqb"} : rsqb)], "postprocess": ([l,, elems,, r]) => new ExprNS.List(toAstToken(l), toAstToken(r), elems)},
    {"name": "atom", "symbols": [(pythonLexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Variable(tok, tok, tok); }},
    {"name": "atom", "symbols": [(pythonLexer.has("float") ? {type: "float"} : float)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, parseFloat(t.value)); }},
    {"name": "atom", "symbols": [(pythonLexer.has("bigint") ? {type: "bigint"} : bigint)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); }},
    {"name": "atom", "symbols": [(pythonLexer.has("hex") ? {type: "hex"} : hex)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); }},
    {"name": "atom", "symbols": [(pythonLexer.has("octal") ? {type: "octal"} : octal)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); }},
    {"name": "atom", "symbols": [(pythonLexer.has("binary") ? {type: "binary"} : binary)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.BigIntLiteral(tok, tok, t.value); }},
    {"name": "atom", "symbols": [(pythonLexer.has("complex") ? {type: "complex"} : complex)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Complex(tok, tok, t.value); }},
    {"name": "atom", "symbols": ["string"], "postprocess": id},
    {"name": "atom", "symbols": [(pythonLexer.has("kw_None") ? {type: "kw_None"} : kw_None)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.None(tok, tok); }},
    {"name": "atom", "symbols": [(pythonLexer.has("kw_True") ? {type: "kw_True"} : kw_True)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, true); }},
    {"name": "atom", "symbols": [(pythonLexer.has("kw_False") ? {type: "kw_False"} : kw_False)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, false); }},
    {"name": "string", "symbols": [(pythonLexer.has("stringTripleDouble") ? {type: "stringTripleDouble"} : stringTripleDouble)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); }},
    {"name": "string", "symbols": [(pythonLexer.has("stringTripleSingle") ? {type: "stringTripleSingle"} : stringTripleSingle)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); }},
    {"name": "string", "symbols": [(pythonLexer.has("stringDouble") ? {type: "stringDouble"} : stringDouble)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); }},
    {"name": "string", "symbols": [(pythonLexer.has("stringSingle") ? {type: "stringSingle"} : stringSingle)], "postprocess": ([t]) => { const tok = toAstToken(t); return new ExprNS.Literal(tok, tok, t.value); }},
    {"name": "_", "symbols": []},
    {"name": "_", "symbols": [(pythonLexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "__", "symbols": [(pythonLexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "_nl", "symbols": [], "postprocess": id},
    {"name": "_nl", "symbols": ["_nl", (pythonLexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id},
    {"name": "_nl", "symbols": ["_nl", (pythonLexer.has("newline") ? {type: "newline"} : newline)], "postprocess": id},
    {"name": "_nl", "symbols": ["_nl", (pythonLexer.has("indent") ? {type: "indent"} : indent)], "postprocess": id},
    {"name": "_nl", "symbols": ["_nl", (pythonLexer.has("dedent") ? {type: "dedent"} : dedent)], "postprocess": id}
];
let ParserStart = "file";
export default { Lexer, ParserRules, ParserStart };
