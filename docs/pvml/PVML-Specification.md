> Forked from the [SVML Specification](https://github.com/source-academy/js-slang/wiki/SVML-Specification)
> in the js-slang wiki. SVML is the compilation target for the Source language, executed by
> [Sinter](https://github.com/source-academy/sinter). PVML is py-slang's own compilation target
> for SICPy (the Python variant used in this project), executed by
> [Pynter](https://github.com/source-academy/pynter), a fork of Sinter kept separate so that
> Python-specific VM semantics don't risk destabilizing Sinter, which remains the fallback engine
> for the Source curriculum. As of this fork, PVML/Pynter are unmodified copies of SVML/Sinter;
> this document (and the copy) is the starting point for the two formats to diverge as needed.

# Python Virtual Machine Language

The Python Virtual Machine Language defines a virtual machine with a set of instructions,
and an associated JSON assembly and binary format.

It is intended as a compilation target for SICPy that is suitable
not only for efficient execution on normal PCs, but also low-power machines like
microcontrollers (e.g. Arduino).

## VM structure

### Function definitions

All code in a PVM program exists within functions. A function (distinct from a
function value) consists of

- the stack size for the function (number of entries)
- the environment size for the function (number of entries)
- the number of arguments expected by the function, which must be less than or equal to the environment size for the function
- the function's code

### Programs

A PVM program consists of functions. One function is designated as the entry
point of the program.

### Execution

Execution of a program begins by calling the entry point with zero arguments.
The result of the program is then the value returned from the entry point
function. (This avoids having special instructions to start and end a program.)

Instructions are executed sequentially, unless an instruction that transfers
execution to another location in the program is executed.

#### Calling convention

Functions are called using the `call` or `call.t` instructions. When a function
is called,

1. the arguments are popped off the caller's stack, as detailed in the entries for the `call` and `call.t` instructions
1. a new frame is created, based on the information in the function's header
1. the arguments passed by the caller are inserted into the new environment, with the first argument in slot 0 of the environment, the second in slot 1, and so on
1. execution is transferred to the first instruction of the function

When a function returns,

1. the function's return value is pushed onto the stack of the caller, as detailed in the entries for the `call` and `call.t` instructions
1. execution returns to the instruction in the caller immediately after the `call` or `call.t` instruction

#### Faults

Some instructions may produce faults. When a fault occurs, execution halts.

Implementations are recommended to track the reason for a fault, and provide
some mechanism for debugging a fault (such as providing a stack trace, etc).

Faults are documented within each instruction's entry.

### Frames

A frame consists of an operand stack (hereafter referred to as just a stack)
and an environment.

A frame is created each time a function is called. When the function returns,
its stack is destroyed; its environment may persist if there are new function
values created that refer to its environment as their parent environment.

#### Values in stacks and environments

All PVM instructions do one of the following:

- load values from an environment onto the executing function's environment
- store values into an environment from the stack
- operate on values on the stack only

All values on stacks and in environments are either booleans, numbers, or boxed
values (which may be any of the 7 PVM types, including booleans or numbers).
Implementations are not required to be able to differentiate booleans, numbers
or boxed values on stacks and in environments, but are required to track the
types of values stored within a boxed value; this is required to implement
instructions such as `add.g` that depend on the actual types of their operands.

#### Stack

A stack is used to store intermediate results and pass operands to
instructions.

When a function is called, an empty stack is created with size as specified in
the function's header.

Stacks are accessed in a strictly LIFO manner; all instructions only push or
pop from the top of the executing function's stack.

#### Environment

An environment is used to store local variables and function arguments.

When a function is called, a environment is created with size as specified in
the function's header. The arguments passed to the function are placed in the
first slots in the environment, with the first argument in slot 0, the second
in slot 1, and so on.

Environments are accessed only by the `ldl`, `ldp`, `stl` and `stp` instruction
families, which load and store values in environments.

### Data types

The PVM recognises these distinct types:

* undefined, a singleton
* null, also a singleton
* boolean, either `true` or `false`
* number
* string
* array
* function

#### Numbers

Implementations are recommended to implement number semantics following the
IEEE 754 double-precision floating point specification where possible. As an
allowance for platforms for which this would be too expensive, implementations
may implement number semantics following the single-precision floating point
specification instead.

#### Strings

Strings are arbitrary sequences of bytes (including the zero byte). PVM defines
no operations on strings other than concatenation, so character encoding does
not affect PVM string semantics.

#### Arrays

Arrays are maps from non-negative integer numbers (indexes) to any value.
Loading an unassigned index results in `undefined`.

Arrays have a `length` property, accessed by the primitive function
`array_length`, that returns one plus the highest index that has been assigned
to, or 0 if no index has been assigned to.

Note: assigning `undefined` to an array index is indistinguishable except for
the effect of the assignment on the array's `length`.

#### Function values

A function value is a tuple consisting of a pointer to the function's location
in the program, and the environment in which the function value was created.

## [Instruction set](PVML-Instruction-Set)

(click on the link)

## Program representations

There are two standard representations of a PVML program. VM implementations
are free to accept the representation that works best for them.

### JSON assembly format

A program is an array consisting of two values:

- the index of the entry point function in the following array
- an array of functions

A function is an array consisting of four values:

- the stack size for the function, as a number
- the environment size for the function, as a number
- the number of arguments expected by the function, as a number
- the function's code, an array of instructions

An instruction is an array consisting of:

- the opcode in position 0
- any arguments which may include numbers, boolean values, or strings

For instructions `new.c` and `jmp` which take `<address>`es, an array consisting of the following is specified instead:

- the index of the function
- the index of the instruction in the function (for `jmp`; ignored and optional for `new.c`)

For instructions `br.t` and `br` which take `<offset>`s, a number specifying the number of _instructions_ to skip is specified instead.

As a TypeScript type definition:


```typescript
type Offset = number; // instructions to skip
type Address = [
    number, // function index
    Offset  // instruction index within function; optional
];
type Instruction = [
    number,                     // opcode
    number | boolean | string | // arguments
        Offset | Address
];
type PVMFunction = [
    number,         // stack size
    number,         // environment size
    number,         // number of arguments
    Instruction[]   // code
];
type Program = [
    number,         // index of entry point function
    PVMFunction[]
];
```

### Binary format

- There is no padding between any values unless explicitly specified.
- All instruction opcodes are one byte long.
- All values are in little-endian.
- We use the integer and float type names from Rust to denote operand types in instruction entries.
  - E.g. `u8` refers to an 8-bit unsigned integer; `i32` refers to a 32-bit signed integer; `f32` refers to a 32-bit (single-precision) floating point.
- An `address` is a 32-bit unsigned integer `u32` that refers to an offset from the start of the program.
- An `offset` is a 32-bit signed integer `u8` that refers to an offset from the start of the _next_ instruction.
- A structure _aligned to N bytes_ means:
  - if `address % N == 0`, then the structure may begin there
  - otherwise, skip `N - address % N` bytes, and then begin the structure

A program is a `Program`.

#### `Program` structure

| Field       | Type          |
| ----------- | ------------- |
| Header      | `Header`      |
| Constant    | `Constant[]`  |
| Alignment   | to 4-bytes    |
| Functions   | `Function[]`  |

Each `Constant` and `Function` is aligned to 4 bytes.

#### `Header` structure

| Field               | Type          |
| ------------------- | ------------- |
| Magic               | `u32`         |
| Major version       | `u16`         |
| Minor version       | `u16`         |
| Entry point         | `address`     |
| Constant pool count | `u32`         |

- Magic is the value `0x5005ACAD`
- The entry point must point to a `Function`

`Header` is 16 bytes.

#### `Constant` structure

Each `Constant` should be aligned to 4 bytes.

| Field               | Type            |
| ------------------- | --------------- |
| Type                | `u16`           |
| Length              | `u32`           |
| Data                | Depends on type |

`Constant` is `6 + Length` bytes.

##### String (type `1`)

| Field               | Type            |
| ------------------- | --------------- |
| Data                | `u8[]`          |

* The length of Data is equal to Length in the constant header.
* Data must be null-terminated; the null terminator should be included in its length.

#### `Function` structure

Each `Function` should be aligned to 4 bytes.

| Field               | Type            |
| ------------------- | --------------- |
| Stack size          | `u8`            |
| Environment size    | `u8`            |
| Number of arguments | `u8`            |
| Padding (alignment) | `u8`            |
| Code                | `Instruction[]` |

#### `Instruction` structure

An instruction consists of the `u8` opcode plus any arguments. There is no
padding or alignment between arguments. Instructions are concatenated with no
padding or alignment between instructions.

For example, the following instructions

```
ldc.i 123
pop.f
```

should result in the following (hex) bytes:

```
01 7B 00 00 00 10
```
