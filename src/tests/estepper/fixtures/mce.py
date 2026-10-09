# A compact metacircular evaluator in the style of SICP Python 4.1, for the e-stepper's §4 tests
# (py-slang#509): it evaluates the tagged lists that parse returns, and applies the primitive
# functions with apply_in_underlying_python. As in the textbook's evaluator, programs it evaluates
# test for the empty list with is_null (here bound to is_none).

def list_ref(xs, n):
    return head(xs) if n == 0 else list_ref(tail(xs), n - 1)

def map_llist(f, xs):
    return None if is_none(xs) else pair(f(head(xs)), map_llist(f, tail(xs)))

def is_tagged(component, tag):
    return is_pair(component) and head(component) == tag

def field(component, n):
    return list_ref(tail(component), n)

# Environments: a linked list of frames; a frame is a pair of a list of names and a list of values.

def lookup(name, env):
    if is_none(env):
        return error("unbound name: " + name)
    names = head(head(env))
    values = tail(head(env))
    while not is_none(names):
        if head(names) == name:
            return head(values)
        names = tail(names)
        values = tail(values)
    return lookup(name, tail(env))

def define(name, value, env):
    frame = head(env)
    set_head(frame, pair(name, head(frame)))
    set_tail(frame, pair(value, tail(frame)))

def make_function(parameters, body, env):
    return llist("compound_function", map_llist(lambda p: field(p, 0), parameters), body, env)

def evaluate(component, env):
    if is_tagged(component, "literal"):
        return field(component, 0)
    elif is_tagged(component, "name"):
        return lookup(field(component, 0), env)
    elif is_tagged(component, "application"):
        return apply(evaluate(field(component, 0), env), values_of(field(component, 1), env))
    elif is_tagged(component, "binary_operator_combination") or is_tagged(component, "comparison"):
        # The operator, then its operands.
        return apply(lookup(field(component, 0), env), values_of(tail(tail(component)), env))
    elif is_tagged(component, "unary_operator_combination"):
        operator = "-unary" if field(component, 0) == "-" else field(component, 0)
        return apply(lookup(operator, env), values_of(tail(tail(component)), env))
    elif is_tagged(component, "logical_composition"):
        left = evaluate(field(component, 1), env)
        if field(component, 0) == "and":
            return evaluate(field(component, 2), env) if left else left
        return left if left else evaluate(field(component, 2), env)
    elif is_tagged(component, "conditional_expression"):
        return (evaluate(field(component, 1), env)
                if evaluate(field(component, 0), env)
                else evaluate(field(component, 2), env))
    elif is_tagged(component, "lambda_expression"):
        return make_function(field(component, 0), field(component, 1), env)
    elif is_tagged(component, "function_declaration"):
        define(field(field(component, 0), 0),
               make_function(field(component, 1), field(component, 2), env),
               env)
        return None
    elif is_tagged(component, "declaration"):
        define(field(field(component, 0), 0), evaluate(field(component, 1), env), env)
        return None
    elif is_tagged(component, "return_statement"):
        return llist("return_value", evaluate(field(component, 0), env))
    elif is_tagged(component, "sequence"):
        return evaluate_sequence(field(component, 0), env)
    else:
        return error("unknown component: " + head(component))

def values_of(expressions, env):
    return map_llist(lambda e: evaluate(e, env), expressions)

def evaluate_sequence(statements, env):
    result = None
    while not is_none(statements):
        result = evaluate(head(statements), env)
        if is_tagged(result, "return_value"):
            return result
        statements = tail(statements)
    return result

def apply(fun, arguments):
    if is_tagged(fun, "compound_function"):
        env = pair(pair(field(fun, 0), arguments), field(fun, 2))
        result = evaluate(field(fun, 1), env)
        return field(result, 0) if is_tagged(result, "return_value") else None
    return apply_in_underlying_python(fun, arguments)

the_global_environment = pair(
    pair(llist("+", "-", "*", "/", "<", ">", "==", "-unary", "not",
               "pair", "head", "tail", "is_null", "llist", "abs", "max"),
         llist(lambda x, y: x + y, lambda x, y: x - y, lambda x, y: x * y,
               lambda x, y: x / y, lambda x, y: x < y, lambda x, y: x > y,
               lambda x, y: x == y, lambda x: -x, lambda x: not x,
               pair, head, tail, is_none, llist, abs, max)),
    None)

def parse_and_evaluate(program):
    return evaluate(parse(program), the_global_environment)
