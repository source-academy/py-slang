# There is no type Any. (py-slang rejects `from typing import Any` before the checker is asked; the
# checker rejects an Any that gets in nevertheless.) A type parameter does what Any would do.
from typing import Any
x: Any = 1                                         # ERROR: The type Any is not available
def f(a: Any) -> Any:                              # ERROR: The type Any is not available
    return a
xs: list[Any] = []                                 # ERROR: The type Any is not available
def identity[A](a: A) -> A:
    return a
y: int = identity(1)
