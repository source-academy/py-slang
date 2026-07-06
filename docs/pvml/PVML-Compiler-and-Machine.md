> **This document is copied verbatim from the js-slang wiki's [SVML Compiler and
> Machine](https://github.com/source-academy/js-slang/wiki/SVML-Compiler-and-Machine) page and has
> not been adapted to py-slang.** Unlike `PVML-Specification.md` and `PVML-Instruction-Set.wiki`
> (which describe the wire format Pynter actually executes, currently identical to Sinter's), this
> page describes **js-slang's own** SVML compiler/machine TypeScript implementation: its file
> layout (`src/vm/svml-compiler.ts`, `src/vm/svml-machine.ts`, `src/stdlib/vm.prelude.ts` — none of
> which exist in py-slang), and Source-3-Concurrent-specific features (the `TQ`/`TO` registers,
> `EXECUTE`/`TEST_AND_SET`/`CLEAR` opcodes) that py-slang's compiler does not implement at all.
> py-slang's actual SVML/PVML compiler and interpreter live under `src/engines/svml/` (see
> `svml-compiler.ts`, `svml-interpreter.ts`, `svml-assembler.ts`, `builtins.ts`). This page is kept
> as background reading and a structural template — rewriting it to describe py-slang's own
> compiler and machine, in the same amount of implementation detail, is unstarted follow-up work.

This page provides an overview of the Typescript implementation of the SVML compiler and machine. As compared to the specification, it places a greater emphasis on the actual code.

## Usage
Compiler can be accessed by command line, in the following way:
1. `yarn build`
2. `node dist/vm/svmc.js` with the relevant arguments

### Compiler
To only compile a program into an SVML JSON formatted `Program`, use `compileToIns` from `src/vm/svml-compiler.ts`.

Input: An estree `es.Program` to be compiled, with optionally the prelude and list of internal functions.

Output: An SVML JSON formatted `Program`

If the output `Program` is to be passed to the SVML machine, then the `Program` needs to include the machine code for the primitive functions, and therefore, should have `prelude` passed in. The `prelude` defines the Source implementation of any primitive functions.

### Machine
Use `runWithProgram` from `src/vm/svml-machine.ts`.

Input: An SVML JSON formatted `Program`, which should include the compiled `prelude`

Output: `undefined` (Source 3 Concurrent programs are all concurrent, and hence always return `undefined`.)

A user can only get feedback from their Source program through the `display` primitive function.

## Implementation Details
This section will explain notable functions used in this implementation. More specific details are in the code base.

### Compiler
#### compileToIns(program, prelude?, vmInternalFunctions?)
The entry point of the compiler is `compileToIns`. It does three main steps.
1. Reset compilation variables
We use variables to keep track of the current state of compilation, e.g. the functions to compile, the machine code to return, etc.

2. Transform program's estree AST
We transform the AST to make compilation easier. Currently, we only transform for loops to while loops in accordance to Source 3 specifications.

3. Start compilation
Compilation is done in function level. Whenever the compiler sees a function, it will add the function to a `toCompile` stack, and only compile it after it finishes compiling the current function. 

#### transformForLoopsToWhileLoops(program)
We transform for loops in particular due to their representation in Source. Loop control variables cannot be reassigned, which we achieve through building the AST in the same way the Source 3 specification outlined a for loop to be represented. This is done by some variable renaming.

#### extractAndRenameNames(baseNode, names)
Used to extract names declared in the current scope, and all blocks (excluding loops and function blocks) within the current scope. It also renames shadowed names in the nested scopes to reuse the same environment for nested scopes. Variable renaming is an optimization to reduce the overhead of creating new environments to support nested scopes. For blocks that come from If statements, or standalone blocks, as they are only run once, we can just use the same environment. For loops, as they are run multiple times, closures will be affected if we just do renaming and reuse the current environment. Below is an example of why we need to create a new environment for a loop, instead of just renaming variables.

```
const x = [];
for (let i = 0; i < 10; i++) {
  x[i] = () => return i;
}
```

#### indexTable
The `indexTable` keeps track of the valid names in any environment. This is an array of `Map<string, EnvEntry>`, where earlier indices in the array represent parent environments to the later ones. `EnvEntry` contains bookkeeping information on each name.

#### compile(expr, indexTable, insertFlag)
This function checks the current `expr` type to determine which compiler to use to compile the `expr`. If `insertFlag` is `true`, it will insert a `RET` instruction as well. Returns the `maxStackSize` of the compiled node, which is the maximum size of the OS on the machine needed to execute the compiled code in the `expr`, and the `insertFlag`, which might change depending on the node compiled.

#### Prelude Compilation
Prelude is located in `src/stdlib/vm.prelude.ts`. There are 4 types of primitive functions. For easier referencing, I will refer to them as Types A/B/C/D.

A. Primitive functions can be defined using Source syntax `map`, `pair`

B. Primitive functions that call JS functions `math_abs`, `runtime`

C. Variadic functions `list`, `math_min`

D. Primitive functions that are implemented by the machine `is_string`, `array_length`

To compile the prelude, we do the following steps:
1. Compile a Source program that contains all the primitive functions. For Type A, they are in the Source program as it is. For Type B, they are compiled as an empty block as placeholders for the actual compiled function code. For Type C, there will be slight modifications to the compiled function code to tell variadic functions apart.
2. Replace the placeholders and make modifications to the compiled Prelude program as necessary. This is done in `generatePrimitiveFunctionCode` in `src/stdlib/vm.prelude.ts`
3. Compile the actual program code with the compiled prelude, to output a SVML JSON formatted Source 3 Concurrent `Program`.

#### Internal Functions
Internal Functions should be provided to `compileToIns` as a list of names to be passed to `makeIndexTableWithPrimitivesAndInternals`. Source 3 Concurrent specific functions are implemented in this manner.

### Machine
#### Registers
The machine uses a number of registers to keep track of the state of the machine, along with 9 general purpose registers to store intermediate data. When developing subroutines for the machine, do take note of which registers are being used for which operation.

#### Nodes
Space on the `HEAP` is occupied with nodes. There are currently 10 nodes.
`NUMBER`, `BOOL`, `STRING`, `ARRAY`, `UNDEFINED`, `NULL`, `OS`, `CLOSURE`, `RTS_FRAME`, `ENV`.

Every node has 4 slots for bookkeeping, and however many more necessary for it's own purposes. The 4 uniform slots are `TAG`, the type of node, `SIZE`, the amount of space the node takes up, `FIRST_CHILD`, the index of the first child of the node and `LAST_CHILD`, the index of the last child of the node.

#### runWithProgram(program, context)
Entry point of the machine. Expects a compiled program and the context to run in. This function resets all the registers, setup external builtins (more on this later), and calls `run`. 

#### run
`run` executes each instruction in the program in a while loop until an error occurs or completion, then it will return `undefined`. All the logic for how each instruction is handled are in subroutines in the array `M`. Similar to the transpiler, we add a timeout as infinite loop protection.

#### Primitive Function support
There are 4 types of primitive functions.

For Type A primitive functions, whose implementation is defined using Source syntax, they are handled the same way a normal function in a program.

For Type B primitive functions, which needs to call a Javascript function, we create a custom opcode for each function, which just calls it and adds the result to the OS.

For Type C primitive functions, which are variadic, we pack all the arguments the function is called with into an array, and use this arguments array as the sole argument. 

For Type D primitive functions, which are implemented by the machine, we define custom opcodes that does what the function is supposed to do.

There are 3 exceptions to these 4 general types. `display`, `error` and `draw_data`, the external builtins. As these functions are not defined in js-slang, but instead in cadet-frontend and passed to js-slang via `Context`, on every run, the machine will extract these functions for use from `Context`, and call these in their respective custom opcode.

#### Internal Function support
Each internal function should have its own subroutine, and the subroutines are called directly in the internal function call. The way they are executed is different from normal functions, in the sense that normal functions do not call subroutines directly, but instead execute instruction by instruction. Refer to `INTERNAL_FUNCTION_CALL()` for the code.

#### Source 3 Concurrent
We introduce 2 registers, `TQ`, a thread queue and `TO`, the number of instructions before a thread times out, and 3 opcodes, `EXECUTE`, `TEST_AND_SET` and `CLEAR`. Refer to Source 3 Concurrent specification for more information.

`EXECUTE` adds threads to `TQ`. Every instruction will reduce `TO` by 1, and when it reaches 0, the thread will timeout, and swap with another random thread in `TQ`, if any. As we do not know which thread will terminate last, we always return `undefined` as the value for the program. Hence, you can only use calls to `display` to know what is going on in the program.

## Current Issues / Things to take note
### Compiler
- Assumes Source 3 / 3 Concurrent. 

- Source programs should return the last statement that was evaluated. However, this doesn't happen for some cases. If the expression in a program is an `AssignmentExpression`, it will return undefined instead of the value that was assigned. If the last statement evaluated was in a block, it will return undefined as well.
```
for (let i = 0; i <= 2 ; i = i + 1) {
    i;
} // expected to return 2 but returns undefined instead
```

- Using a variable before it is initialized is not flagged by the compiler

- BR* uses number of instructions as offset (SVML spec uses bytes)

- STAG / LDAG uses a boxed number as index instead of a literal (SVML spec uses a literal number)

### Machine
- Only works with Source 3 Concurrent. Will need to be configured to support other Source chapters. (Disallow certain opcodes depending on chapter?)

- Arrays are represented using Javascript arrays, so an array that has 100 elements and an array that has 2 elements will take up the same amount of `HEAP` space (Ideally, to make an array node of size 10, the node should have 10 extra slots for the elements, etc. Array nodes need to be resizable (like an array list))

- Using a variable before it is initialized has undefined behavior (Can be addressed by introducing some value to represent no-value-yet, and assign this value to all slots of an environment upon creation)

- No garbage collection

- Functions are converted to JS as "<Function>" instead of an actual JS function, this means it does not work the same as other variants on the data visualizer or in display.

## Testing
Testing is done via integration testing for the compiler and machine. As Source 3 Concurrent programs all return `undefined`, we test for correct output via `expectDisplayResult` and calls to the `display` primitive function. For errors, we use `expectParsedError` instead. 

There are 4 groups of testing.
1. Standard opcodes

We use simple programs that either only test the opcode being tested, or make use of previously tested opcodes.

2. Primitive opcodes

We test a subset of primitive functions to ensure they work as expected.

3. Standard program execution

We test more complicated programs as a whole to ensure they work as expected.

4. Concurrent program execution

We test to ensure there is interleaving between threads after a call to `concurrent_execute`. As the output is not deterministic, we just need to search for some proof of interleaving display outputs instead.

## Potential Areas for Improvement
### Compiler
- Make compiler take into account the current chapter when compiling. I.e. compiling with list functions in Source 1 should throw an undefined variable error

- Integrate type inference into compiler, so we can use type specific instructions for optimization (such ass ADDF instead of ADDG)

### Machine
- Run the machine with a scheduler, similar to how the interpreter runs. This allows support for breakpoints (`DebuggerStatement`) and make the `display` of the concurrent programs appear in real time.

- Allow user to specify the degree of interleaving (`MAX_TO`)

- Make machine work with REPL. Currently, every input instance into the REPL is treated as a separate program. There is no history. (No idea how feasible this idea is)