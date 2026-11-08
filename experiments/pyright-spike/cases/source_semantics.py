# Places where Source Python is stricter than CPython. "S" marks lines py-slang rejects at
# runtime; we record whether pyright (standard mode) catches them.
if 1:                                              # S  non-bool condition
    pass
x = 1 if "s" else 2                                # S  non-bool ternary condition
b = True + 1                                       # S  bool is not a number in Source
c = 1 == "a"                                       # legal in py-slang too (False)
d = not 0                                          # S  `not` on a non-bool
e = 3 and 4                                        # S  and/or on non-bools
