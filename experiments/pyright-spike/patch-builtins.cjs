// Derives "Source Python" builtins.pyi and types.pyi from typeshed's:
//   * int/float/complex/str/list/tuple/dict/NoneType get `__bool__(self) -> None`, so pyright reports
//     "Invalid conditional operand" for them in if/while/ternary/not/and/or (Source's strict bool)
//   * bool no longer subclasses int, so True + 1 is an operator error
const fs = require("fs");
let s = fs.readFileSync("build/builtins.orig.pyi", "utf8");
const n0 = s.length;
s = s.replace(/(\n    def __bool__\(self\) -> )bool(:)/g, (m, a, b) => `${a}None${b}`); // int, float, complex
for (const cls of [
  "class str(Sequence[str]):",
  "class list(MutableSequence[_T]):",
  "class tuple(Sequence[_T_co]):",
  "class dict(MutableMapping[_KT, _VT]):",
]) {
  if (!s.includes(cls)) throw new Error(`missing ${cls}`);
  s = s.replace(
    cls,
    `${cls}\n    def __bool__(self) -> None: ...  # Source: not usable as a condition`,
  );
}
// bool is not an int (True + 1, xs[True] and [0] * True are errors), but §3/§4 compare bools
// with numbers as 1 and 0, so bool keeps the four ordering comparisons. `1 < True` resolves via
// the reflected bool.__gt__.
s = s.replace(
  "class bool(int):",
  [
    "class bool:",
    "    def __bool__(self) -> bool: ...  # Source: bool is not an int",
    ...["__lt__", "__le__", "__gt__", "__ge__"].map(
      m => `    def ${m}(self, value: bool | int | float, /) -> bool: ...`,
    ),
  ].join("\n"),
);
// ** follows Source's operator table instead of typeshed's Any: int ** int is int for a
// non-negative literal exponent, float for a negative one, int | float otherwise; float ** int and
// float ** float are float.
const pow = [
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
for (const [from, to] of pow) {
  if (!s.includes(from)) throw new Error(`missing ${from}`);
  s = s.replace(from, to);
}
fs.writeFileSync("build/builtins.source.pyi", s);
console.log(`patched builtins.pyi (${n0} -> ${s.length} chars)`);

// None is not a condition either. NoneType lives in types.pyi, and its __bool__ returns
// Literal[False], which the __bool__ rewrite above does not match.
let t = fs.readFileSync("build/types.orig.pyi", "utf8");
const noneBool =
  /(class NoneType:\r?\n(?:.*\r?\n)*?    def __bool__\(self\) -> )Literal\[False\](:)/;
if (!noneBool.test(t)) throw new Error("missing NoneType.__bool__");
t = t.replace(noneBool, "$1None$2");
fs.writeFileSync("build/types.source.pyi", t);
console.log("patched types.pyi (NoneType.__bool__)");
