# The environment stepper: a guide for students

The environment stepper ("e-stepper") shows how a Python §3 or §4 program runs, one small step at a
time, when the program uses **assignment and local state**. It is the tool for the environment model
of SICPy §3.1 onwards. Open the **E-Stepper** tab of the playground and press **Run**.

Like the substitution stepper, it rewrites your program: each step evaluates one small part, and
the rest of the program stays as it was. Unlike the substitution stepper, a call does not
copy the argument values into the function body. A call creates a **frame** that holds the
parameters and local names, and the body of the function is evaluated *in that frame*. The frames
and the data structures are drawn on the right, as in the CSE machine, and the program on the left
points into that drawing.

Use the slider or the buttons to move through the steps. With the pane in focus (click on the
explanation first), the keys **f** (next step) and **b** (previous step) work too, and **a** and **e**
jump to the previous and the next `breakpoint()` statement of your program, or to the first and the
last step if there is none. The line above the program explains what the step did.

## What you see

| On the left (the program) | On the right (the drawing) |
|---|---|
| The program, shrinking and changing as it runs | **Built-ins**, then **Global**, then one box for each function call that has something to remember (a *frame*) |
| Coloured brackets with a label like `E2` | The frame in the same colour, named after its function |
| Small badges like `#2` | Function objects (double circles) and lists, with the same badge |

### Highlights

On odd-numbered steps, the part of the program that is evaluated next is highlighted in red. On the
next step, the result is highlighted in green.

### Brackets: "this part runs in frame E2"

When a function is called, its body appears in the program inside a bracket with a label, for
example `E2`. The bracket says: this body is evaluated in frame `E2`. Names in it are looked up
in `E2` first. If `E2` does not have the name, the lookup continues in the frame that `E2`
extends: the one where the function was *defined*, not the one where it was called.

Brackets can be nested. This is the call stack: the innermost bracket is the call that is running
now. When the call returns, its bracket disappears and the value of the call takes its place. The
frame in the drawing stays; it is only greyed out if nothing can reach it any more (see *Grey* below).

Statements of a function body disappear from the bracket as they are executed.

### Labels: the names of frames

The frames in the drawing are named by their function, as in the CSE machine, and coloured: a
frame has the same colour as its bracket in the program. The brackets and the explanation line
name frames by a label (`E1`, `E2`, …, in the order in which the frames are created). The program's own frame is `Global`.
The functions that Python provides (`print`, `pair`, `math_sqrt`, …) live in **Built-ins**, the frame
that `Global` extends.

### Badges: references to objects

A function or a list is not copied when it is used. A name, a list element or a returned value
*refers* to the object. In the program, a reference is a badge with a number, for example `#2`. The
same badge is on the object in the drawing, so you can see which object a variable holds. Two
badges with the same number are the same object, not two equal ones.

For a function, the badge does not show the name that the function was defined with: after
`W1 = make_withdraw(100)`, the name `withdraw` says nothing about what `W1` holds, and two calls of
`make_withdraw` give two different function objects. Hold the mouse over the badge to see the
function's header, and over a badge or a bracket to highlight the object or frame in the drawing.

### Names are looked up in steps of their own

Each name in the program is replaced by its value in a step of its own, from left to right, for
example *Looked up amount in frame E2: 50*. The drawing highlights the binding that was read. So
`balance >= amount` takes three steps: the lookup of `balance`, the lookup of `amount`, then the
comparison. The names of built-in functions are looked up together with the call that uses them.

### Grey: objects that nothing refers to any more

A frame or object that the program and the global frame can no longer reach is drawn in grey, not
removed. After `make_withdraw(100)` returns, its frame stays as it was, because the function it
returned still extends it. After a call that returns a number, the frame of that call turns grey. Use *Clear
unreachable objects* in the drawing's toolbar to hide them.

### Frames that are not drawn

A frame needs a reason to be drawn. A call of a function that has no parameters and no local
names would create an empty frame; it is not drawn, and the body is evaluated in the frame the
function extends instead. The explanation says so ("the new frame would have no bindings, so the
body runs in the global environment"). The global frame is the only frame that can be empty and be drawn.
It starts empty and grows as the program assigns names or defines functions.

## Loops

A loop does not run "inside" one step. The e-stepper unrolls it, so that the program always shows all
that is left to do, and you can follow the loop one iteration at a time.

### `while`

`while test: body` is first **unfolded** into the `if` statement of the textbook rule: the loop stays
in the program, in full, at the end of the body.

```python
while test:                    if test:
    body              ==>          body
                                   while test:
                                       body
```

The step explains it ("Unfolding the while loop"). Then the program behaves like any `if`: the
names of `test` are looked up one by one, the test is evaluated, and the `if` chooses.

- If the test is `True`, the body runs, statement by statement, in the current frame. When the body is
  finished ("Finished the loop body, back to the loop"), the `while` statement that ended the body is
  next, and it is unfolded again with the *new* values of the names. A loop with *n* iterations is
  unfolded *n* + 1 times.
- If the test is `False`, the whole `if` disappears from the program ("the loop ends").

### `for`

In Python §3 and §4, a `for` loop must use `range`: `for x in range(n)`, `range(a, b)` or
`range(a, b, step)`.

1. The arguments of `range` are evaluated first. Then the loop is shown with all three numbers,
   for example `for x in range(0, 2, 1):` ("Evaluated range: from 0 to 2 in steps of 1").
2. Each iteration starts with a test whether the current number is still in the range. If it is,
   the program gets the assignment `x = 0` (the first iteration), the body, and then the loop for the
   rest of the range, `for x in range(1, 2, 1):`. If it is not, the loop disappears.
3. The assignment of the loop variable is a step of its own, like any assignment: the binding of
   `x` is created in, or updated in, the frame that the loop runs in. As in Python, a loop has no
   frame of its own: `x` and the names assigned in the body are the frame's names, and stay there
   after the loop. In a function, that is the frame of the call; in the main program, it is the global frame.

### `break`, `continue` and `return`

- **`break`** ends the loop: the rest of the body, and the unfolded loop after it, disappear
  ("Evaluated break: the loop ends").
- **`continue`** skips the rest of the body, and the loop goes on with the next unfolding (`while`)
  or the next number in the range (`for`).
- **`return`** in a loop ends the call, as anywhere in a function body: the loop disappears with the
  rest of the body, and the bracket of the call is replaced by the returned value.

### Many iterations

Every iteration takes a few dozen steps, since each name is looked up in a step of its own, so a
loop of a hundred iterations needs thousands of steps. The stepper stops at the step limit
(1000 steps by default; you can change it in the control bar). To see how a loop works, step through
a few iterations with small numbers, and use `break` or a smaller `range` for the rest.

## Example

```python
def make_withdraw(balance):
    def withdraw(amount):
        nonlocal balance
        if balance >= amount:
            balance = balance - amount
            return balance
        else:
            return 'Insufficient funds'
    return withdraw

W1 = make_withdraw(100)
W1(50)
```

1. At the start, only `Built-ins` and an empty `Global` are drawn.
2. The `def` statements are executed: the program loses them, and `Global` gets `make_withdraw`,
   which refers to a function object (`#1`).
3. `W1 = make_withdraw(100)` creates the frame `E1` with `balance: 100`. The body of
   `make_withdraw` appears in a bracket labelled `E1`. The inner `def` makes the function object `#2`,
   whose arrow points to `E1`, the frame in which it was defined.
4. `return withdraw` turns the call into `#2`; the assignment gives `Global` the binding
   `W1` to `#2`. The bracket of `E1` is gone, but `E1` stays: `#2` still extends it.
5. `W1(50)` creates the frame `E2` with `amount: 50`, which extends **`E1`**, where `withdraw` was
   defined, and not `Global`, where it was called. `E2` does not have a binding for `balance`:
   `nonlocal balance` says that the name belongs to the enclosing frame.
6. The names `balance` and `amount` are looked up in steps of their own: `balance` in `E1`
   (100) and `amount` in `E2` (50). The comparison gives `True`.
7. `balance = balance - amount` changes the binding of `balance` **in `E1`**, from 100 to 50. This
   is the step that the substitution model cannot show.
8. `return balance` gives 50, and the bracket of `E2` disappears. `E2` turns grey. `E1` stays, with
   `balance: 50`: a second `W1(50)` would find it there.

## See also

- [Design note and reduction rules](https://github.com/source-academy/py-slang/blob/main/docs/e-stepper.md)
- [Specification of the Python §4 environment stepper](../python_4_estepper.pdf)
