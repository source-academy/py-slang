# Clean: §1-style recursion and higher-order functions.
def factorial(n: int) -> int:
    return 1 if n == 0 else n * factorial(n - 1)

def fib(n: int) -> int:
    if n <= 1:
        return n
    else:
        return fib(n - 1) + fib(n - 2)

def compose(f: Callable[[int], int], g: Callable[[int], int]) -> Callable[[int], int]:
    return lambda x: f(g(x))

def sum_term(term: Callable[[int], float], a: int, next: Callable[[int], int], b: int) -> float:
    return 0 if a > b else term(a) + sum_term(term, next(a), next, b)

def average_damp(f: Callable[[float], float]) -> Callable[[float], float]:
    return lambda x: (x + f(x)) / 2

# A lambda bound to a name gets its parameter types from the name's declared type.
square: Callable[[int], int] = lambda x: x * x
print(factorial(5), fib(10), compose(square, square)(3))
print(sum_term(lambda x: 1 / x, 1, lambda x: x + 1, 10))
print(average_damp(math_sqrt)(4.0))
