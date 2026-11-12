def is_even(n: int) -> bool:
    return n == 0 or is_odd(n - 1)

def is_odd(n: int) -> bool:
    return n != 0 and is_even(n - 1)

print(is_even(10))

def head_is_positive(xs: LList[int]) -> bool:
    return is_pair(xs) and head(xs) > 0

def both_empty(xs: LList[int], ys: LList[int]) -> bool:
    return not (is_pair(xs) or is_pair(ys)) and (is_none(xs) and is_none(ys))
