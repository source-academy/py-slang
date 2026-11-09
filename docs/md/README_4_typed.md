Python §4 Typed is Python §4 with type annotations. Your program is checked for type errors
before it runs, using <a href="https://github.com/microsoft/pyright">Pyright</a>. A program with a
type error does not run: you see all its type errors, each with the line and column where it
occurs. Like <a href="../python_4/">Python §4</a>, it is designed for the fourth chapter of the textbook
<a href="https://sourceacademy.org/sicpy">Structure and Interpretation
of Computer Programs, Python Adaptation</a> (SICPy).

The definitive description of the language is the PDF
<a href="../python_4_typed.pdf"><strong>Specification of Python §4 Typed</strong></a>: the grammar, the type
rules and the libraries with their types.

## What names are predeclared in Python §4 Typed?

On the right, you see all predeclared names of Python §4, in alphabetical order. Click on a
name to see its type, and how it is defined and used. They come in these groups:
  <ul>
    <li>
      <a href="../MISC_typed/index.html">MISC</a>: Miscellaneous constants and functions
    </li>
    <li>
      <a href="../MATH_typed/index.html">MATH</a>: Mathematical constants and functions
    </li>
    <li>
      <a href="../LINKED LIST_typed/index.html">LINKED LIST</a>: Support for linked lists
    </li>
    <li>
      <a href="../PAIR MUTATOR_typed/index.html">PAIR MUTATOR</a>: Mutating pairs
    </li>
    <li>
      <a href="../LIST_typed/index.html">LIST</a>: Support for lists
    </li>
    <li>
      <a href="../STREAM_typed/index.html">STREAM</a>: Support for streams
    </li>
    <li>
      <a href="../MCE_typed/index.html">MCE</a>: Support for the meta-circular evaluator
    </li>
  </ul>

The <a href="#types-of-the-predeclared-names">types of the predeclared names</a> are listed below, except
for `print`, `len`, `abs`, `max`, `min`, `round`, `input`, `repr`, `str` and `complex`, which have the types
that <a href="https://docs.python.org/3/library/functions.html">Python's standard library</a> gives them
(`bool` is not a number, as above). The types of `tokenize`, `parse` and `apply_in_underlying_python` are
not fixed yet.

## What can you do in Python §4 Typed?

You can use everything in <a href="../python_4/">Python §4</a>, and you annotate your program with
types. A program without its annotations is a Python §4 program, and it behaves in the same way.

## Types

The following types are available without imports.

| type | values |
|------|--------|
| `int`, `float`, `complex` | numbers |
| `bool` | `True`, `False` |
| `str` | strings |
| `None` | `None` |
| `list[T]` | lists whose elements have type `T` |
| `Pair[H, T]` | pairs whose head has type `H` and whose tail has type `T` |
| `LList[T]` | linked lists of elements of type `T`: `Pair[T, LList[T]] \| None` |
| `Stream[T]` | streams of elements of type `T`: `Pair[T, Callable[[], Stream[T]]] \| None` |
| `object` | any value: a function that has `object` as the type of a parameter, such as `is_none`, accepts every value. Unlike `Any`, which there is not, a program can do nothing with an `object` but pass it on or test it (`is_none(x)`, `is_pair(x)`, ...) |
| `Callable[[T1, ..., Tn], R]` | functions with `n` parameters of types `T1`, ..., `Tn` that return a value of type `R` |
| `T1 \| T2` | values of type `T1` or of type `T2` |

An `int` can be used where a `float` is expected, but `bool` is not a number: `True` cannot be used where
an `int` is expected, as in Python §4, where `True + 1` is an error. A pair is not a list as far as types
are concerned: `pair(1, 2)[0]` is a type error, and you access the head and tail of a pair with `head` and
`tail`. There is no type that stands for every type (no `Any`), and types need no import: a program that
imports from `typing` is rejected.

One limit follows from the types of pairs and lists: `head`, `tail`, `set_head`, `set_tail`, `length`,
`print_llist`, `llist_to_string` and `stream_length` need one head type, one tail type and one element type.
A variable that holds a pair or list of one type in one branch and of another in the other branch
(`xs = llist(1, 2) if c else llist("a")`, of type `LList[int] | LList[str]`) is therefore rejected by them:
`length expects xs to be LList[A], but got LList[int] | LList[str]`. Declare the variable with one type
instead, as in `xs: LList[int | str] = llist(1, 2) if c else llist("a")`.

A second limit is about `object`. After `is_pair(x)` has narrowed a value of type `object`, the checker
does not know the types in the pair: it accepts `head(x)` as any type, but takes `tail(x)` to be a linked
list, so `arity(tail(x))` is rejected (`…but got LList[object]`) even if the tail is a function. After
`is_list(x)` it accepts the elements of `x` as any type. Annotate the parameter with the type that you
expect (`x: Pair[int, Callable[[], int]]`) instead of `object`, and the checker checks them.

## Annotating your program

Every function definition annotates each of its parameters and its return type; a function that does not
return a value has the return type `None`:

```python
def length(xs: LList[int]) -> int:
    return 0 if is_none(xs) else 1 + length(tail(xs))
```

The parameters of a lambda expression are not annotated: their types come from where the lambda is used,
for example as an argument of a function whose parameter has a function type
(`map(lambda x: x * 2, llist(1, 2, 3))`), or as the value of a name with a declared function type
(`square: Callable[[int], int] = lambda x: x * x`). An assignment can declare the type of a name,
as in `count: int = 0`; an empty list needs a declared type, as in `xs: list[int] = []`.

In the branches of an `if`, the type of a name is narrowed by the condition: if `xs` is a `LList[int]`,
it is `None` where `is_none(xs)` is true, and a pair where it is false, so that `head(xs)` is allowed there.

## Generic functions and type aliases

A function that works for values of any type has type parameters, which stand for any type; at each call
they are replaced by the types of the arguments. A `type` statement gives a name to a type.

```python
def map_llist[A, B](f: Callable[[A], B], xs: LList[A]) -> LList[B]:
    return None if is_none(xs) else pair(f(head(xs)), map_llist(f, tail(xs)))

type Rational = Pair[int, int]
```

## What do type errors look like?

```python
def square(x: int) -> int:
    return x * x

square("five")           # square expects x to be int, but got str
head(pair(1, 2)[0])      # A pair cannot be indexed (Pair[int, int]): use head(...) and tail(...)
if 1: pass               # A condition must be a bool, but this is an int
head(llist(1, 2))        # head expects p to be Pair[H, T], but got LList[int]. The value can be None:
                         # test for that first, for example with is_none(...)
```

## Can you use the Source Academy modules?

Yes, for these modules, whose types are known: `binary_tree`, `curve`, `matrix`, `repeat`, `rune`,
`scrabble` and `sound`. Their functions are checked like your own: a call that gives a function an argument
of the wrong type is a type error. The types that a module defines (`Rune` of `rune`, `Sound` of `sound`)
are imported like its functions, to annotate with them:

```python
from rune import heart, scale, show, Rune

def smaller(r: Rune) -> Rune:
    return scale(0.5, r)

show(smaller(heart))
```

A type is only for annotations: you cannot use `Rune` as a value. A module whose types are not known cannot
be imported yet.

A number that you give to a function of a module can be an `int` or a `float`; a number that a module gives
back is a `float`. A function of a module that works for any type (`repeat`, and the functions of
`binary_tree`) gives back the type that it was given, but an `int` that passes through it comes back as a
`float`: a program that uses it where an `int` is required, as the index of a list, passes the check and
fails when it runs.

## Types of the modules

The types that each module defines, and the names that it has, with their types. `int | float` for a
number that you give to a module, and `float` for a number that it gives back, as described above.

<!-- MODULES -->

## Types of the predeclared names

`TypeIs[T]` means `bool`, and in addition narrows the type of the argument to `T`, and `NoReturn` is the result
of a function that never returns (`error`; you cannot write it in a program either). In the `TypeIs` of `is_pair` and `is_list`, `object` stands for the types of the components and elements,
which the checker does not know: it accepts any type there, so that narrowing a union keeps its pairs and
its lists.
`tail` and `stream_tail` have two declarations: the first is for linked lists and streams, so that the tail of
an `LList[int]` is an `LList[int]`, and the second is for any other pair.

<!-- PRELUDE -->

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../python_4_typed.pdf">Specification of Python §4 Typed</a>. Feel free to
take a peek!
