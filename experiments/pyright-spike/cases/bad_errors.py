# Each line marked E should be reported.
def factorial(n: int) -> int:
    return 1 if n == 0 else n * factorial(n - 1)

def describe(n: int) -> str:
    if n > 0:
        return "positive"
    # falls off the end -> returns None
    # E(line 5) : declared str but can return None (reported on the def's return annotation)

factorial("five")                                  # E
factorial(1, 2)                                    # E
x: int = "hello"                                   # E
y = 1 + "a"                                        # E
head(llist(1, 2)) + "s"                            # E
head(5)                                            # E
xs = llist(1, 2, 3)
head(xs)                                           # E  (xs may be None)
map(lambda x: x + 1, llist("a", "b"))              # E
pair(1, 2)[0]                                      # E  (pairs are opaque, not indexable)
undefined_name + 1                                 # E
factorial(3)(4)                                    # E
def apply(f: Callable[[int], int], v: int) -> int:
    return f(v)
apply(lambda s: s.upper(), 3)                      # E
set_head(pair(1, 2), "x")                          # E? (invariance; depends on inference)
