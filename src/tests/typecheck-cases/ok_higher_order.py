# Higher-order functions (SICP 1.3), with generic functions and nested definitions.
def accumulate(op: Callable[[int, int], int], initial: int, xs: LList[int]) -> int:
    return initial if is_none(xs) else op(head(xs), accumulate(op, initial, tail(xs)))

def compose[A, B, C](f: Callable[[B], C], g: Callable[[A], B]) -> Callable[[A], C]:
    return lambda x: f(g(x))

def repeated(f: Callable[[int], int], n: int) -> Callable[[int], int]:
    return f if n == 1 else compose(f, repeated(f, n - 1))

def sum_term(term: Callable[[int], float], a: int, nxt: Callable[[int], int], b: int) -> float:
    return 0.0 if a > b else term(a) + sum_term(term, nxt(a), nxt, b)

def fixed_point(f: Callable[[float], float], first_guess: float) -> float:
    tolerance: float = 0.00001
    def close_enough(v1: float, v2: float) -> bool:
        return abs(v1 - v2) < tolerance
    def try_guess(guess: float) -> float:
        nxt: float = f(guess)
        return nxt if close_enough(guess, nxt) else try_guess(nxt)
    return try_guess(first_guess)

print(accumulate(lambda x, y: x + y, 0, llist(1, 2, 3)))
print(repeated(lambda x: x * x, 2)(5))
print(sum_term(lambda x: 1 / x, 1, lambda x: x + 1, 10))
print(fixed_point(lambda x: math_cos(x), 1.0))
