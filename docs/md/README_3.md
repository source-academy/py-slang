Python §3 is a small programming language, designed for the third chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).

## What names are predeclared in Python §3?

On the right, you see all predeclared names of Python §3, in alphabetical
order. Click on a name to see how it is defined and used. They come in
these groups:
  <ul>
    <li>
      <a href="../MISC/index.html">MISC</a>: Miscellaneous constants and functions
    </li>
    <li>
      <a href="../MATH/index.html">MATH</a>: Mathematical constants and functions
    </li>
    <li>
      <a href="../LINKED LISTS/index.html">LINKED LISTS</a>: Support for linked lists
    </li>
    <li>
      <a href="../PAIR MUTATORS/index.html">PAIR MUTATORS</a>: Mutating pairs
    </li>
    <li>
      <a href="../LISTS/index.html">LISTS</a>: Support for lists
    </li>
    <li>
      <a href="../STREAMS/index.html">STREAMS</a>: Support for streams
    </li>
  </ul>

## What can you do in Python §3?

### Assignment statements

Variables can be assigned to with identical syntax to variable declaration:

<PRE><CODE>x = 1
print(x) // x is 1
x = x + 1
print(x)  // now x is 2
</CODE></PRE>

The difference from variable declaration is that in assignments, the variable must
already exist, and that the assignment does not create a new variable but changes
the value of the existing variable. In the example above, the first line creates a
variable `x` and assigns it to 1. The third line changes the value of `x` to 2.

Read more on variable declaration and assignment in
<a href="https://sourceacademy.org/sicpjs/3.1.1">section 3.1.1 Local State Variables</a>
of the textbook.

### While loops

A while loop repeatedly evaluates a predicate and if the predicate returns `True`,
evaluates a given block. The evaluation terminates when the predicate returns `False`.
Example:

<PRE><CODE>x = 0
while x &lt; 10:
    print(x)
    x = x + 1</CODE></PRE>

will display the numbers from 0 to 9.

While loops are not covered in the textbook.

### For loops

For loops repeat their body over a range of values, which starts from 0 by
default. The variable associated with the for loop takes on each value in
the range, and the body of the loop is evaluated once for each value. For
example, the same program can be written as:

<PRE><CODE>for x in range(10):
    print(x)</CODE></PRE>

You can also specify a different starting point for the range, for example:

<PRE><CODE>for x in range(5, 10):
    print(x)</CODE></PRE>
will display the numbers from 5 to 9.

Lastly, you can specify a step size for the range, for example:

<PRE><CODE>for x in range(0, 10, 2):
    print(x)</CODE></PRE>
will display the even numbers from 0 to 8.

For loops are not covered in the textbook.

### Lists, list access and list assignment

Lists are created using literal list expressions, as follows:

<CODE>my_list = [10, 20, 30];</CODE>

The constant `my_list` now refers to a list with three elements.
The elements in such a literal list expressions have implicit
keys. The first element has key 0, the second has key 1, the third
has key 2 and so on.

A list can be accessed using list access expressions, with
a given key:

<CODE>my_list[0] + my_list[1] + my_list[2]; // 60</CODE>

Like pairs, lists can be changed in Source §3. This is done
using list assignment:

<CODE>my_list[1] = 200;</CODE>

List assignment and list access in Python §3 are restricted
to integers (numbers with no fractional component) larger than or
equal to 0 and less than 2<SUP>32</SUP>-1. We call such numbers <EM>list indices</EM>.

Accessing a list at a list index that has not been assigned yet (using a
literal list expression or a list assignment) will result in an error. For
example, the following will result in an error:

<CODE>my_list[3]; // error: list index out of range</CODE>

Lists are not covered in the textbook.

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../python_3.pdf">Specification of Python §3</a>. Feel free to
take a peek!
