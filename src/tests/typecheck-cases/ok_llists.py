# Clean: §2-style linked lists with recursion, narrowing via `is None`.
def sum_llist(xs: LList[int]) -> int:
    return 0 if xs is None else head(xs) + sum_llist(tail(xs))

def my_map(f: Callable[[int], str], xs: LList[int]) -> LList[str]:
    if xs is None:
        return None
    return pair(f(head(xs)), my_map(f, tail(xs)))

def accumulate(op: Callable[[int, int], int], initial: int, xs: LList[int]) -> int:
    return initial if xs is None else op(head(xs), accumulate(op, initial, tail(xs)))

xs = llist(1, 2, 3)
ys = map(lambda x: x * 2, xs)
evens = filter(lambda x: x % 2 == 0, enum_llist(1, 10))
total = reduce(lambda x, acc: x + acc, 0, evens)
strs = my_map(lambda n: str(n), xs)
print(sum_llist(ys), accumulate(lambda a, b: a + b, 0, xs), total, length(strs))
print(llist_ref(append(xs, ys), 4) + 1)
