"""Metacircular-evaluator helper (Source Academy Python ``mce`` group)."""

import ast as _ast
import io as _io
import tokenize as _tokenize

from .linked_list import head, llist, tail


def apply_in_underlying_python(fun, args_list):
    """Apply ``fun`` to the elements of the linked list ``args_list``."""
    args = []
    while args_list is not None:
        args.append(head(args_list))
        args_list = tail(args_list)
    return fun(*args)


# The JavaScript edition names this primitive after its host language; keep the
# alias available for programs converted from the JS edition.
apply_in_underlying_javascript = apply_in_underlying_python


# ---------------------------------------------------------------------------
# parse / tokenize
#
# `parse` mirrors the parse trees that py-slang builds (src/stdlib/parser.ts):
# a program is a tagged linked list, e.g. ``parse("x = 1")`` is
# ``llist("assignment", llist("name", "x"), llist("literal", 1))``.
# Differences from CPython's own `ast` that the tree hides:
#   * every ``x = e`` is an "assignment" (there are no declarations or blocks);
#   * a sequence with exactly one statement is replaced by that statement, and
#     the empty program is ``llist("sequence", None)``;
#   * a lambda body is wrapped in a "return_statement".
# ---------------------------------------------------------------------------

_BINARY_OPERATORS = {
    _ast.Add: "+",
    _ast.Sub: "-",
    _ast.Mult: "*",
    _ast.Div: "/",
    _ast.FloorDiv: "//",
    _ast.Mod: "%",
    _ast.Pow: "**",
}
_COMPARISON_OPERATORS = {
    _ast.Eq: "==",
    _ast.NotEq: "!=",
    _ast.Lt: "<",
    _ast.LtE: "<=",
    _ast.Gt: ">",
    _ast.GtE: ">=",
    _ast.Is: "is",
    _ast.IsNot: "is not",
}
_UNARY_OPERATORS = {_ast.Not: "not", _ast.USub: "-unary", _ast.UAdd: "+unary"}
_BITWISE_OPERATORS = (
    _ast.BitOr,
    _ast.BitAnd,
    _ast.BitXor,
    _ast.LShift,
    _ast.RShift,
)


def _sequence(statements):
    """A list of statements as one node: a lone statement stands for itself."""
    if len(statements) == 1:
        return _transform(statements[0])
    return llist("sequence", llist(*[_transform(s) for s in statements]))


def _name_node(name):
    return llist("name", name)


def _parameters(arguments):
    if arguments.posonlyargs or arguments.kwonlyargs or arguments.kwarg:
        raise SyntaxError(
            "Keyword parameters are not supported in parse tree generation"
        )
    if arguments.defaults:
        raise SyntaxError(
            "Default values of parameters are not supported in parse tree generation"
        )
    names = [_name_node(a.arg) for a in arguments.args]
    if arguments.vararg:
        names.append(llist("rest_element", _name_node(arguments.vararg.arg)))
    return llist(*names)


def _check_not_bitwise(op):
    if isinstance(op, (*_BITWISE_OPERATORS, _ast.Invert)):
        raise SyntaxError(
            "Bitwise operators are not supported in parse tree generation"
        )


def _assignment(target, value):
    """target = value, where value is already a parse tree."""
    if isinstance(target, _ast.Subscript):
        return llist(
            "list_assignment",
            _transform(target.value),
            _transform(target.slice),
            value,
        )
    return llist("assignment", _transform(target), value)


def _transform(node):
    if node is None:
        return None
    if isinstance(node, _ast.Module):
        return _sequence(node.body)
    if isinstance(node, _ast.Expr):
        return _transform(node.value)
    if isinstance(node, _ast.Constant):
        if node.value is Ellipsis or isinstance(node.value, bytes):
            raise SyntaxError("Cannot transform unknown type: Constant")
        return llist("literal", node.value)
    if isinstance(node, _ast.Name):
        return _name_node(node.id)
    if isinstance(node, _ast.BinOp):
        _check_not_bitwise(node.op)
        if type(node.op) not in _BINARY_OPERATORS:
            raise SyntaxError("Cannot transform unknown type: BinOp")
        return llist(
            "binary_operator_combination",
            _BINARY_OPERATORS[type(node.op)],
            _transform(node.left),
            _transform(node.right),
        )
    if isinstance(node, _ast.BoolOp):
        operator = "and" if isinstance(node.op, _ast.And) else "or"
        result = _transform(node.values[0])
        for value in node.values[1:]:
            result = llist("logical_composition", operator, result, _transform(value))
        return result
    if isinstance(node, _ast.Compare):
        if len(node.ops) != 1:
            raise SyntaxError("Chained comparisons are not supported")
        if type(node.ops[0]) not in _COMPARISON_OPERATORS:
            raise SyntaxError(
                "Membership operators are not supported in parse tree generation"
            )
        return llist(
            "binary_operator_combination",
            _COMPARISON_OPERATORS[type(node.ops[0])],
            _transform(node.left),
            _transform(node.comparators[0]),
        )
    if isinstance(node, _ast.UnaryOp):
        _check_not_bitwise(node.op)
        return llist(
            "unary_operator_combination",
            _UNARY_OPERATORS[type(node.op)],
            _transform(node.operand),
        )
    if isinstance(node, _ast.Assign):
        if len(node.targets) != 1:
            raise SyntaxError("Cannot transform unknown type: Assign")
        return _assignment(node.targets[0], _transform(node.value))
    if isinstance(node, _ast.AugAssign):
        _check_not_bitwise(node.op)
        value = llist(
            "binary_operator_combination",
            _BINARY_OPERATORS[type(node.op)],
            _transform(node.target),
            _transform(node.value),
        )
        return _assignment(node.target, value)
    if isinstance(node, _ast.AnnAssign):
        return llist(
            "annotated_assignment",
            _transform(node.target),
            _transform(node.annotation),
            _transform(node.value),
        )
    if isinstance(node, _ast.If):
        return llist(
            "conditional_statement",
            _transform(node.test),
            _sequence(node.body),
            _sequence(node.orelse) if node.orelse else llist("pass_statement"),
        )
    if isinstance(node, _ast.IfExp):
        return llist(
            "conditional_expression",
            _transform(node.test),
            _transform(node.body),
            _transform(node.orelse),
        )
    if isinstance(node, _ast.While):
        if node.orelse:
            raise SyntaxError("Cannot transform unknown type: While")
        return llist("while_loop", _transform(node.test), _sequence(node.body))
    if isinstance(node, _ast.For):
        if node.orelse or not isinstance(node.target, _ast.Name):
            raise SyntaxError("Cannot transform unknown type: For")
        iterable = node.iter
        if not (
            isinstance(iterable, _ast.Call)
            and isinstance(iterable.func, _ast.Name)
            and iterable.func.id == "range"
        ):
            raise SyntaxError("Only range() is supported in for loops")
        if not 1 <= len(iterable.args) <= 3 or iterable.keywords:
            raise SyntaxError("range() takes one to three arguments")
        return llist(
            "for_loop",
            _name_node(node.target.id),
            llist("range_args", *[_transform(a) for a in iterable.args]),
            _sequence(node.body),
        )
    if isinstance(node, _ast.FunctionDef):
        if node.decorator_list:
            raise SyntaxError("Cannot transform unknown type: FunctionDef")
        return llist(
            "function_definition",
            _name_node(node.name),
            _parameters(node.args),
            _sequence(node.body),
        )
    if isinstance(node, _ast.Lambda):
        return llist(
            "lambda_expression",
            _parameters(node.args),
            _transform(node.body),
        )
    if isinstance(node, _ast.Return):
        if node.value is None:
            raise SyntaxError(
                "return without a value is not supported in parse tree generation"
            )
        return llist("return_statement", _transform(node.value))
    if isinstance(node, _ast.Call):
        if node.keywords:
            raise SyntaxError("Cannot transform unknown type: Call")
        return llist(
            "application",
            _transform(node.func),
            llist(*[_transform(a) for a in node.args]),
        )
    if isinstance(node, _ast.List):
        return llist("list_expression", llist(*[_transform(e) for e in node.elts]))
    if isinstance(node, _ast.Subscript):
        if isinstance(node.slice, _ast.Slice):
            raise SyntaxError("Cannot transform unknown type: Slice")
        return llist("list_access", _transform(node.value), _transform(node.slice))
    if isinstance(node, _ast.Starred):
        return llist("starred_expression", _transform(node.value))
    if isinstance(node, _ast.ImportFrom):
        return llist("import_from", node.module, llist(*[a.name for a in node.names]))
    if isinstance(node, _ast.Global):
        return llist("global_statement", llist(*[_name_node(n) for n in node.names]))
    if isinstance(node, _ast.Nonlocal):
        return llist("nonlocal_statement", llist(*[_name_node(n) for n in node.names]))
    if isinstance(node, _ast.Assert):
        if node.msg:
            raise SyntaxError(
                "Assertion messages are not supported in parse tree generation"
            )
        return llist("assert_statement", _transform(node.test))
    if isinstance(node, _ast.Pass):
        return llist("pass_statement")
    if isinstance(node, _ast.Break):
        return llist("break_statement")
    if isinstance(node, _ast.Continue):
        return llist("continue_statement")
    raise SyntaxError("Cannot transform unknown type: " + type(node).__name__)


def parse(program):
    """The parse tree of the program text, as a tagged linked list."""
    if not isinstance(program, str):
        raise TypeError("parse expects a string, got " + type(program).__name__)
    return _transform(_ast.parse(program + "\n"))


def tokenize(program):
    """The tokens of the program text, as a linked list of strings."""
    if not isinstance(program, str):
        raise TypeError("tokenize expects a string, got " + type(program).__name__)
    skipped = (_tokenize.COMMENT, _tokenize.NL, _tokenize.ENDMARKER)
    tokens = []
    for token in _tokenize.generate_tokens(_io.StringIO(program).readline):
        if token.type in skipped or (
            token.type == _tokenize.NEWLINE and token.string == ""
        ):
            continue
        tokens.append("" if token.type == _tokenize.INDENT else token.string)
    return llist(*tokens)
