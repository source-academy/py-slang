# Nothing may have a type that cannot be determined. (An empty list is reported where it is used.)
zs = []
zs = zs + [1]                                      # ERROR: The type of zs cannot be determined
ws: list[int] = []
ws = ws + [1]
print(len(zs))                                     # ERROR: The type of this argument cannot be determined
f = lambda x: x                                    # ERROR: The type of the parameter x cannot be determined
g: Callable[[int], int] = lambda x: x
h = map(lambda x: x + 1, llist(1, 2))
