def is_even(n: int) -> bool:
    return n == 0 or is_odd(n - 1)

def is_odd(n: int) -> bool:
    return n != 0 and is_even(n - 1)

print(is_even(10))
