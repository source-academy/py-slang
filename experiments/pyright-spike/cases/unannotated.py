# typed: rejected (a Python §4 program without annotations)
# Unannotated §4 code with bugs. Without annotations pyright infers parameters as Unknown;
# only errors that do not depend on parameter types are found.
def factorial(n):
    return 1 if n == 0 else n * factorial(n - 1)

def sum_llist(xs):
    return 0 if xs is None else head(xs) + sum_llist(tail(xs))

factorial("five")                                  # E? (parameter type unknown)
y = 1 + "a"                                        # E
head(5)                                            # E
sum_llist(42)                                      # E? (inferred from call-site? no)
factorial(1, 2)                                    # E
z = factorial(3) + "x"                             # E? (return type inferred as int?)
