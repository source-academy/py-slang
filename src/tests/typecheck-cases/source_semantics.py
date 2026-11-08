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
while "s":                                         # ERROR: A condition must be a bool, but this is a str
    pass
# Known gap: the left operand of and/or must be a bool in Python §4, and the checker does not look
# at it (`3 and 4` has no error).
k = 3 and 4
