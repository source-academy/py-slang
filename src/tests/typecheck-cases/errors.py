# Each line that ends with `# ERROR` must have an error, with a message that contains the text after
# the colon; no other line may have an error.
def factorial(n: int) -> int:
    return 1 if n == 0 else n * factorial(n - 1)

def describe(n: int) -> str:                       # ERROR: must return value on all code paths
    if n > 0:
        return "positive"

factorial("five")                                  # ERROR: factorial expects n to be int, but got str
factorial(1, 2)                                    # ERROR: Expected 1 positional argument
x: int = "hello"                                   # ERROR: Type "str" is not assignable to declared type "int"
y = 1 + "a"                                        # ERROR: Operator "+" not supported for types "int" and "str"
head(llist(1, 2)) + "s"                            # ERROR: Operator "+" not supported for types "int" and "str"
head(5)                                            # ERROR: head expects p to be Pair[H, T], but got int
xs = llist(1, 2, 3)
head(xs)                                           # ERROR: The value can be None: test for that first
map(lambda x: x + 1, llist("a", "b"))              # ERROR: Operator "+" not supported for types "str" and "int"
pair(1, 2)[0]                                      # ERROR: A pair cannot be indexed (Pair[int, int]): use head(...) and tail(...)
undefined_name + 1                                 # ERROR: "undefined_name" is not defined
factorial(3)(4)                                    # ERROR: Object of type "int" is not callable
def apply(f: Callable[[int], int], v: int) -> int:
    return f(v)
apply(lambda s: s.upper(), 3)                      # ERROR: Cannot access attribute "upper" for class "int"
set_head(pair(1, 2), "x")                          # ERROR: set_head expects v to be H, but got str
tail(pair(1, llist(2)))[0]                         # ERROR: cannot be indexed
def mixed(c: bool) -> int:
    ys = llist(1, 2) if c else llist("a")
    zs: LList[int | str] = llist(1, 2) if c else llist("a")
    return length(zs) + length(ys)                 # ERROR: length expects xs to be LList[A], but got LList[int] | LList[str]
def second(ys: LList[int]) -> int:
    return 1 if is_none(ys) else 2 if is_none(tail(ys)) else head(tail(ys))  # ERROR: head expects p to be Pair[H, T], but got LList[int]
tail(5)                                            # ERROR: tail expects p to be Pair[H, T], but got int
def after_is_pair(x: object) -> int:
    return arity(tail(x)) if is_pair(x) else 0     # ERROR: arity expects f to be (...) -> object, but got LList[object]
def annotated(x: Pair[int, Callable[[], int]]) -> int:
    return arity(tail(x))
def narrowed_pair(xs: LList[int]) -> int:
    return head(xs) if is_pair(xs) else 0
def list_or_int(x: int | list[int]) -> int:
    return x[0] if is_list(x) else x
def str_or_pair(x: str | Pair[int, int]) -> int:
    if is_pair(x):
        return x + 1                               # ERROR: Operator "+" not supported for types "Pair[int, int]" and "int"
    return 0
def str_or_list(x: str | list[int]) -> int:
    if is_list(x):
        return 0
    return x + 1                                   # ERROR: Operator "+" not supported for types "str" and "int"
