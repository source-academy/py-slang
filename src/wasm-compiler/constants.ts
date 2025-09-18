// tags
const INT_TAG = 0;
const FLOAT_TAG = 1;
const COMPLEX_TAG = 2;
const BOOL_TAG = 3;
const STRING_TAG = 4;

export const HEAP_PTR = "$_heap_pointer";

// boxing functions
export const MAKE_INT_FX = "$_make_int";
export const MAKE_FLOAT_FX = "$_make_float";
export const MAKE_COMPLEX_FX = "$_make_complex";
export const MAKE_BOOL_FX = "$_make_bool";
export const MAKE_STRING_FX = "$_make_string";

const makeIntFunc = `(func ${MAKE_INT_FX} (param $value i64) (result i32 i64) (i32.const ${INT_TAG}) (local.get $value))`;
const makeFloatFunc = `(func ${MAKE_FLOAT_FX} (param $value f64) (result i32 i64) (i32.const ${FLOAT_TAG}) (local.get $value) (i64.reinterpret_f64))`;
const makeComplexFunc = `(func ${MAKE_COMPLEX_FX} (param $real f64) (param $img f64) (result i32 i64) (global.get ${HEAP_PTR}) (local.get $real) (f64.store) (global.get ${HEAP_PTR}) (i32.const 8) (i32.add) (local.get $img) (f64.store) (i32.const ${COMPLEX_TAG}) (global.get ${HEAP_PTR}) (i64.extend_i32_u) (global.get ${HEAP_PTR}) (i32.const 16) (i32.add) (global.set ${HEAP_PTR}))`;
const makeBoolFunc = `(func ${MAKE_BOOL_FX} (param $value i32) (result i32 i64) (i32.const ${BOOL_TAG}) (local.get $value) (i64.extend_i32_u))`;
const makeStringFunc = `(func ${MAKE_STRING_FX} (param $ptr i32) (param $len i32) (result i32 i64) (i32.const ${STRING_TAG}) (local.get $ptr) (i64.extend_i32_u) (i64.const 32) (i64.shl) (local.get $len) (i64.extend_i32_u) (i64.or))`;

// unary operation functions
export const NEG_FUNC_NAME = "$_py_neg";

const negFunc = `(func ${NEG_FUNC_NAME} (param $x_tag i32) (param $x_val i64) (result i32 i64)
  (local.get $x_tag) (i32.const ${INT_TAG}) i32.eq (if 
    (then (local.get $x_val) (i64.const -1) (i64.xor) (i64.const 1) (i64.add) (call ${MAKE_INT_FX}) return))
  (local.get $x_tag) (i32.const ${FLOAT_TAG}) i32.eq (if
    (then (local.get $x_val) (f64.reinterpret_i64) (f64.neg) (call ${MAKE_FLOAT_FX}) return))
  (local.get $x_tag) (i32.const ${COMPLEX_TAG}) i32.eq (if
    (then (local.get $x_val) (i32.wrap_i64) (f64.load) (f64.neg) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (f64.neg) (call ${MAKE_COMPLEX_FX}) return))
    
  unreachable
)`;

// logging functions
export const LOG_FUNCS = [
  '(import "console" "log" (func $_log_int (param i64)))',
  '(import "console" "log" (func $_log_float (param f64)))',
  '(import "console" "log_complex" (func $_log_complex (param f64) (param f64)))',
  '(import "console" "log_bool" (func $_log_bool (param i64)))',
  '(import "console" "log_string" (func $_log_string (param i32) (param i32)))',
  `(func $log (param $tag i32) (param $value i64)
    (local.get $tag) (i32.const ${INT_TAG}) i32.eq (if
      (then (local.get $value) (call $_log_int) return))
    (local.get $tag) (i32.const ${FLOAT_TAG}) i32.eq (if
      (then (local.get $value) (f64.reinterpret_i64) (call $_log_float) return))
    (local.get $tag) (i32.const ${COMPLEX_TAG}) i32.eq (if
      (then (local.get $value) (i32.wrap_i64) (f64.load) (local.get $value) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (call $_log_complex) return))
    (local.get $tag) (i32.const ${BOOL_TAG}) i32.eq (if
      (then (local.get $value) (call $_log_bool) return))
    (local.get $tag) (i32.const ${STRING_TAG}) i32.eq (if
      (then (local.get $value) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $value) (i32.wrap_i64) (call $_log_string) return))

    unreachable
  )`,
];

// binary operation functions
export const ADD_FX = "$_py_add";
export const SUB_FX = "$_py_sub";
export const MUL_FX = "$_py_mul";
export const DIV_FX = "$_py_div";

type BinaryOpFxs =
  | typeof ADD_FX
  | typeof SUB_FX
  | typeof MUL_FX
  | typeof DIV_FX;

const binaryOpFactory = (
  name: BinaryOpFxs,
  intOperation: string,
  floatOperation: string
) =>
  `(func ${name} (param $x_tag i32) (param $x_val i64) (param $y_tag i32) (param $y_val i64) (result i32 i64)
  (local $a f64) (local $b f64) (local $c f64) (local $d f64) ${
    name === DIV_FX ? "(local $denom f64)" : ""
  }

  ${/* if adding, check if both are strings */ ""}
  ${
    name === ADD_FX
      ? `(i32.eq (local.get $x_tag) (i32.const ${STRING_TAG})) (i32.eq (local.get $y_tag) (i32.const ${STRING_TAG})) (i32.and) (if` +
        `(then (global.get ${HEAP_PTR})` +
        `(global.get ${HEAP_PTR}) (local.get $x_val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $x_val) (i32.wrap_i64) (memory.copy)` +
        `(global.get ${HEAP_PTR}) (local.get $x_val) (i32.wrap_i64) (i32.add) (global.set ${HEAP_PTR})` +
        `(global.get ${HEAP_PTR}) (local.get $y_val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $y_val) (i32.wrap_i64) (memory.copy)` +
        `(global.get ${HEAP_PTR}) (local.get $y_val) (i32.wrap_i64) (i32.add) (global.set ${HEAP_PTR})` +
        `(local.get $x_val) (i32.wrap_i64) (local.get $y_val) (i32.wrap_i64) (i32.add) (call ${MAKE_STRING_FX}) return))`
      : ""
  }

  ${/* if either are bool, convert to int */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $x_tag)))
  (i32.eq (local.get $y_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $y_tag)))

  ${
    /* if both int, use intOperation (except for division: use floatOperation) */ ""
  }
  (i32.eq (local.get $x_tag) (i32.const ${INT_TAG})) (i32.eq (local.get $y_tag) (i32.const ${INT_TAG})) (i32.and) (if
    ${
      name === DIV_FX
        ? `(then (local.get $x_val) (f64.convert_i64_s) (local.get $y_val) (f64.convert_i64_s) ${floatOperation} (call ${MAKE_FLOAT_FX}) return)`
        : `(then (local.get $x_val) (local.get $y_val) ${intOperation} (call ${MAKE_INT_FX}) return)`
    }
  )

  ${/* else, if either are int, convert to float and set float locals */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${INT_TAG})) (if (result f64)
    (then (local.get $x_val) (f64.convert_i64_s) (i32.const ${FLOAT_TAG}) (local.set $x_tag))
    (else (local.get $x_val) (f64.reinterpret_i64))
  )
  (local.set $a)
  (i32.eq (local.get $y_tag) (i32.const ${INT_TAG})) (if (result f64)
    (then (local.get $y_val) (f64.convert_i64_s) (i32.const ${FLOAT_TAG}) (local.set $y_tag))
    (else (local.get $y_val) (f64.reinterpret_i64))
  )
  (local.set $c)

  ${/* if both float, use floatOperation */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG})) (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG})) (i32.and) (if
    (then (local.get $a) (local.get $c) ${floatOperation} (call ${MAKE_FLOAT_FX}) return)
  )

  ${
    /* else, if either are complex, load complex from memory and set float locals (default 0) */ ""
  }
  (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG})) (if
    (then (i32.const ${COMPLEX_TAG}) (local.set $x_tag))
    (else (local.get $x_val) (i32.wrap_i64) (f64.load) (local.set $a) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $b))
  )
  (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG})) (if
    (then (i32.const ${COMPLEX_TAG}) (local.set $y_tag))
    (else (local.get $y_val) (i32.wrap_i64) (f64.load) (local.set $c) (local.get $y_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $d))
  )

  ${/* if both complex, perform complex operations */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${COMPLEX_TAG})) (i32.eq (local.get $y_tag) (i32.const ${COMPLEX_TAG})) (i32.and) (if
    (then
     ${
       name === ADD_FX || name === SUB_FX
         ? `(local.get $a) (local.get $c) ${floatOperation} (local.get $b) (local.get $d) ${floatOperation} (call ${MAKE_COMPLEX_FX})`
         : name === MUL_FX
         ? `(local.get $a) (local.get $c) (f64.mul) (local.get $b) (local.get $d) (f64.mul) (f64.sub) (local.get $a) (local.get $d) (f64.mul) (local.get $b) (local.get $c) (f64.mul) (f64.add) (call ${MAKE_COMPLEX_FX})`
         : `(local.get $c) (local.get $c) (f64.mul) (local.get $d) (local.get $d) (f64.mul) (f64.add) (local.set $denom) (local.get $a) (local.get $c) (f64.mul) (local.get $b) (local.get $d) (f64.mul) (f64.add) (local.get $denom) (f64.div) (local.get $b) (local.get $c) (f64.mul) (local.get $a) (local.get $d) (f64.mul) (f64.sub) (local.get $denom) (f64.div) (call ${MAKE_COMPLEX_FX})`
     }
    return)
  )

  ${/* else, unreachable */ ""}
  unreachable
)`;

const addFunc = binaryOpFactory(ADD_FX, "i64.add", "f64.add");
const subFunc = binaryOpFactory(SUB_FX, "i64.sub", "f64.sub");
const mulFunc = binaryOpFactory(MUL_FX, "i64.mul", "f64.mul");
const divFunc = binaryOpFactory(DIV_FX, "i64.div_s", "f64.div");

export const EQ_FX = "$_py_eq";
export const NEQ_FX = "$_py_neq";

const eqFunc = `(func ${EQ_FX} (param $x_tag i32) (param $x_val i64) (param $y_tag i32) (param $y_val i64) (result i32 i64)
  (local $a f64) (local $b f64) (local $c f64) (local $d f64)

  ${/* if either are bool, convert to int */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $x_tag)))
  (i32.eq (local.get $y_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $y_tag)))

  ${/* if both int, use int equality */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${INT_TAG})) (i32.eq (local.get $y_tag) (i32.const ${INT_TAG})) (i32.and) (if
    (then (local.get $x_val) (local.get $y_val) (i64.eq) (call ${MAKE_BOOL_FX}) return)
  )

  ${/* else, if either are int, convert to float and set float locals */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${INT_TAG})) (if (result f64)
    (then (local.get $x_val) (f64.convert_i64_s) (i32.const ${FLOAT_TAG}) (local.set $x_tag))
    (else (local.get $x_val) (f64.reinterpret_i64))
  )
  (local.set $a)
  (i32.eq (local.get $y_tag) (i32.const ${INT_TAG})) (if (result f64)
    (then (local.get $y_val) (f64.convert_i64_s) (i32.const ${FLOAT_TAG}) (local.set $y_tag))
    (else (local.get $y_val) (f64.reinterpret_i64))
  )
  (local.set $c)

  ${/* if both float, use float equality */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG})) (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG})) (i32.and) (if
    (then (local.get $a) (local.get $c) (f64.eq) (call ${MAKE_BOOL_FX}) return)
  )

  ${
    /* else, if either are complex, load complex from memory and set float locals (default 0) */ ""
  }
  (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG})) (if
    (then (i32.const ${COMPLEX_TAG}) (local.set $x_tag))
    (else (local.get $x_val) (i32.wrap_i64) (f64.load) (local.set $a) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $b))
  )
  (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG})) (if
    (then (i32.const ${COMPLEX_TAG}) (local.set $y_tag))
    (else (local.get $y_val) (i32.wrap_i64) (f64.load) (local.set $c) (local.get $y_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $d))
  )

  ${/* if both complex, use float equality on both real and imaginary */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${COMPLEX_TAG})) (i32.eq (local.get $y_tag) (i32.const ${COMPLEX_TAG})) (i32.and) (if
    (then (local.get $a) (local.get $c) (f64.eq) (local.get $b) (local.get $d) (f64.eq) (i32.and) (call ${MAKE_BOOL_FX}) return)
  )

  ${/* else, unreachable */ ""}
  unreachable
)`;

const neqFunc = `(func ${NEQ_FX} (param $x_tag i32) (param $x_val i64) (param $y_tag i32) (param $y_val i64) (result i32 i64)
  (local.get $x_tag) (local.get $x_val) (local.get $y_tag) (local.get $y_val) (call ${EQ_FX}) (i64.eqz) (i64.extend_i32_u)
)`;

export const nameToFunctionMap = {
  [MAKE_INT_FX]: makeIntFunc,
  [MAKE_FLOAT_FX]: makeFloatFunc,
  [MAKE_COMPLEX_FX]: makeComplexFunc,
  [MAKE_BOOL_FX]: makeBoolFunc,
  [MAKE_STRING_FX]: makeStringFunc,
  [ADD_FX]: addFunc,
  [SUB_FX]: subFunc,
  [MUL_FX]: mulFunc,
  [DIV_FX]: divFunc,
  [EQ_FX]: eqFunc,
  [NEQ_FX]: neqFunc,
  [NEG_FUNC_NAME]: negFunc,
};
