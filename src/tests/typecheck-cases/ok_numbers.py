# Clean: the predicates of the numeric tower. An int is a float and a complex to the checker, but
# is_float(5) and is_complex(5) are False at run time, so a false branch keeps the int.
def kind(x: int | float | str) -> str:
    if is_float(x):
        return "number " + str(x + 0.5)
    elif is_string(x):
        return x
    else:
        return str(x + 1)
def half(x: int | float) -> float:
    return x / 2 if is_float(x) else x + 0.5
print(kind(2.5))
print(kind(5))
print(kind("a"))
print(half(3.0))
print(half(4))
