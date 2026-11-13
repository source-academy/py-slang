# Where Python §4 is stricter than Python: a condition must be a bool, and a bool is not a number.
if 1:                                              # ERROR: A condition must be a bool, but this is an int
    pass
x = 1 if "s" else 2                                # ERROR: A condition must be a bool, but this is a str
b = True + 1                                       # ERROR: Operator "+" not supported for types "bool" and "int"
c = 1 == "a"
d = not 0                                          # ERROR: A condition must be a bool, but this is an int
f = 1 if None else 2                               # ERROR: A condition must be a bool, but this is a None
g = True < 1
h = 1 >= False
i = [1, 2][True]                                   # ERROR: No overloads for "__getitem__"
j = [0] * True                                     # ERROR: Operator "*" not supported
# Both operands of and/or must be bools (the right one is not checked when the program runs, so that
# `n == 0 or is_odd(n - 1)` is iterative: the checker is what makes it a bool).
k = 3 and True                                     # ERROR: A condition must be a bool, but this is an int
m = True and 4                                     # ERROR: A condition must be a bool, but this is an int
n = "a" or False                                   # ERROR: A condition must be a bool, but this is a str
o = False or None                                  # ERROR: A condition must be a bool, but this is a None
def not_bools(p: Pair[int, int], g: Callable[[], int], o: object) -> None:
    if p:                                          # ERROR: A condition must be a bool, but this is a Pair[int, int]
        pass
    q = not g                                      # ERROR: A condition must be a bool, but this is a () -> int
    r = True and p                                 # ERROR: A condition must be a bool, but this is a Pair[int, int]
    s = o or False                                 # ERROR: A condition must be a bool, but this is an object

while "s":                                         # ERROR: A condition must be a bool, but this is a str
    pass
