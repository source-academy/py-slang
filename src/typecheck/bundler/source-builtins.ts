/**
 * Derives Source Python's `builtins.pyi` and `types.pyi` from typeshed's, so that the type checker
 * knows Python §4's rules where they differ from Python's:
 *
 * - Strict bool: an `if`, `while`, conditional expression, `not` or `and`/`or` needs a bool (pyright
 *   checks all but `and`/`or` itself: `patchBoolOperandChecks` in bundle.ts adds them). The
 *   `__bool__` of int, float, complex, str, list, tuple, dict and None returns None, which pyright
 *   reports as "Invalid conditional operand".
 * - bool is not a number: it does not subclass int, so `True + 1`, `xs[True]` and `[0] * True` are
 *   errors. Python §3 and §4 compare bools with numbers as 1 and 0 (`True < 1`), so bool keeps the
 *   four ordering comparisons.
 * - `**` follows Python §4's operator table instead of typeshed's `Any`: int ** int is an int for a
 *   non-negative literal exponent, a float for a negative one, and int | float otherwise; float **
 *   int and float ** float are floats.
 *
 * Each patch checks that typeshed has the shape it expects and throws if not, so that upgrading the
 * checker (which brings a newer typeshed) cannot silently drop a rule.
 */

function expectOne(text: string, anchor: string | RegExp, what: string): void {
  const count =
    typeof anchor === "string"
      ? text.split(anchor).length - 1
      : (text.match(new RegExp(anchor.source, anchor.flags.replace("g", "") + "g"))?.length ?? 0);
  if (count !== 1) {
    throw new Error(
      `typeshed has changed: expected exactly one ${what}, found ${count}. ` +
        `Update src/typecheck/bundler/source-builtins.ts.`,
    );
  }
}

function replaceExactly(text: string, from: string, to: string, what: string): string {
  expectOne(text, from, what);
  return text.replace(from, () => to);
}

/** The classes whose instances cannot be conditions: each gets `__bool__ -> None`. */
const NOT_CONDITIONS = [
  "class str(Sequence[str]):",
  "class list(MutableSequence[_T]):",
  "class tuple(Sequence[_T_co]):",
  "class dict(MutableMapping[_KT, _VT]):",
];

export function patchSourceBuiltins(builtins: string): string {
  let s = builtins;

  // int, float and complex have `def __bool__(self) -> bool:` in typeshed.
  const boolMethod = /(\n {4}def __bool__\(self\) -> )bool(:)/g;
  const found = s.match(boolMethod)?.length ?? 0;
  if (found !== 3) {
    throw new Error(
      `typeshed has changed: expected 3 classes (int, float, complex) with "def __bool__(self) -> bool", ` +
        `found ${found}. Update src/typecheck/bundler/source-builtins.ts.`,
    );
  }
  s = s.replace(boolMethod, "$1None$2");

  for (const cls of NOT_CONDITIONS) {
    s = replaceExactly(
      s,
      cls,
      `${cls}\n    def __bool__(self) -> None: ...  # Source: not usable as a condition`,
      `"${cls}"`,
    );
  }

  s = replaceExactly(
    s,
    "class bool(int):",
    [
      "class bool:",
      "    def __bool__(self) -> bool: ...  # Source: bool is not an int",
      ...["__lt__", "__le__", "__gt__", "__ge__"].map(
        m => `    def ${m}(self, value: bool | int | float, /) -> bool: ...`,
      ),
    ].join("\n"),
    '"class bool(int):"',
  );

  const pow: [string, string][] = [
    [
      "    def __pow__(self, value: int, mod: None = None, /) -> Any:",
      "    def __pow__(self, value: int, mod: None = None, /) -> int | float:",
    ],
    [
      "    def __rpow__(self, value: int, mod: int | None = None, /) -> Any:",
      "    def __rpow__(self, value: int, mod: int | None = None, /) -> int | float:",
    ],
    [
      "    def __pow__(self, value: float, mod: None = None, /) -> Any:",
      "    def __pow__(self, value: float, mod: None = None, /) -> float:",
    ],
    [
      "    def __rpow__(self, value: float, mod: None = None, /) -> Any:",
      "    def __rpow__(self, value: float, mod: None = None, /) -> float:",
    ],
  ];
  for (const [from, to] of pow) s = replaceExactly(s, from, to, `"${from.trim()}"`);

  return s;
}

/** None is not a condition either. `NoneType` is in `types.pyi`, where `__bool__` returns `Literal[False]`. */
export function patchSourceTypes(types: string): string {
  const noneBool =
    /(class NoneType:\r?\n(?:.*\r?\n)*?    def __bool__\(self\) -> )Literal\[False\](:)/;
  expectOne(types, noneBool, "NoneType.__bool__ returning Literal[False]");
  return types.replace(noneBool, "$1None$2");
}
