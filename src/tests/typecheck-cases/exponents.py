# The type of ** follows Python §4's operator table.
def power(b: int, n: int) -> int:
    return b ** n                                  # ERROR: Type "int | float" is not assignable to return type "int"
def power_float(b: int, n: int) -> float:
    return b ** n
def square(x: int) -> int:
    return x ** 2
def root(x: float) -> float:
    return x ** 0.5
def inverse(x: int) -> float:
    return x ** -1
