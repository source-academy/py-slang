// tags
const INT_TAG = 0;
const FLOAT_TAG = 1;
const COMPLEX_TAG = 2;
const BOOL_TAG = 3;
const STRING_TAG = 4;
const CLOSURE_TAG = 5;

export const HEAP_PTR = "$_heap_pointer";

// boxing functions
export const MAKE_INT_FX = "$_make_int";
export const MAKE_FLOAT_FX = "$_make_float";
export const MAKE_COMPLEX_FX = "$_make_complex";
export const MAKE_BOOL_FX = "$_make_bool";
export const MAKE_STRING_FX = "$_make_string";
export const MAKE_CLOSURE_FX = "$_make_closure";

const makeIntFunc = `(func ${MAKE_INT_FX} (param $value i64) (result i32 i64) (i32.const ${INT_TAG}) (local.get $value))`;
const makeFloatFunc = `(func ${MAKE_FLOAT_FX} (param $value f64) (result i32 i64) (i32.const ${FLOAT_TAG}) (local.get $value) (i64.reinterpret_f64))`;
const makeComplexFunc = `(func ${MAKE_COMPLEX_FX} (param $real f64) (param $img f64) (result i32 i64) (global.get ${HEAP_PTR}) (local.get $real) (f64.store) (global.get ${HEAP_PTR}) (i32.const 8) (i32.add) (local.get $img) (f64.store) (i32.const ${COMPLEX_TAG}) (global.get ${HEAP_PTR}) (i64.extend_i32_u) (global.get ${HEAP_PTR}) (i32.const 16) (i32.add) (global.set ${HEAP_PTR}))`;
const makeBoolFunc = `(func ${MAKE_BOOL_FX} (param $value i32) (result i32 i64) (i32.const ${BOOL_TAG}) (local.get $value) (i64.extend_i32_u))`;
// upper 32: pointer; lower 32: length
const makeStringFunc = `(func ${MAKE_STRING_FX} (param $ptr i32) (param $len i32) (result i32 i64) (i32.const ${STRING_TAG}) (local.get $ptr) (i64.extend_i32_u) (i64.const 32) (i64.shl) (local.get $len) (i64.extend_i32_u) (i64.or))`;
// upper 32: tag; lower 32: number of arguments
const makeClosureFunc = `(func ${MAKE_CLOSURE_FX} (param $tag i32) (param $arity i32) (result i32 i64) (i32.const ${CLOSURE_TAG}) (local.get $tag) (i64.extend_i32_u) (i64.const 32) (i64.shl) (local.get $arity) (i64.extend_i32_u) (i64.or))`;

// unary operation functions
export const NEG_FUNC_NAME = "$_py_neg";

const negFunc = `(func ${NEG_FUNC_NAME} (param $x_tag i32) (param $x_val i64) (result i32 i64)
  (local.get $x_tag) (i32.const ${INT_TAG}) i32.eq (if 
    (then (local.get $x_val) (i64.const -1) (i64.xor) (i64.const 1) (i64.add) (call ${MAKE_INT_FX}) (return)))
  (local.get $x_tag) (i32.const ${FLOAT_TAG}) i32.eq (if
    (then (local.get $x_val) (f64.reinterpret_i64) (f64.neg) (call ${MAKE_FLOAT_FX}) (return)))
  (local.get $x_tag) (i32.const ${COMPLEX_TAG}) i32.eq (if
    (then (local.get $x_val) (i32.wrap_i64) (f64.load) (f64.neg) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (f64.neg) (call ${MAKE_COMPLEX_FX}) (return)))
    
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
      (then (local.get $value) (call $_log_int) (return)))
    (local.get $tag) (i32.const ${FLOAT_TAG}) i32.eq (if
      (then (local.get $value) (f64.reinterpret_i64) (call $_log_float) (return)))
    (local.get $tag) (i32.const ${COMPLEX_TAG}) i32.eq (if
      (then (local.get $value) (i32.wrap_i64) (f64.load) (local.get $value) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (call $_log_complex) (return)))
    (local.get $tag) (i32.const ${BOOL_TAG}) i32.eq (if
      (then (local.get $value) (call $_log_bool) (return)))
    (local.get $tag) (i32.const ${STRING_TAG}) i32.eq (if
      (then (local.get $value) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $value) (i32.wrap_i64) (call $_log_string) (return)))

    unreachable
  )`,
];

// binary operation function
export const ARITHMETIC_OP_FX = "$_py_arith_op";
export const ADD_TAG = 0;
export const SUB_TAG = 1;
export const MUL_TAG = 2;
export const DIV_TAG = 3;

const arithmeticOpFunc = `(func ${ARITHMETIC_OP_FX} (param $x_tag i32) (param $x_val i64) (param $y_tag i32) (param $y_val i64) (param $op i32) (result i32 i64)
  (local $a f64) (local $b f64) (local $c f64) (local $d f64) (local $denom f64)

  ${/* if adding, check if both are strings */ ""}
  (i32.and 
    (i32.eq (local.get $op) (i32.const ${ADD_TAG}))
    (i32.and
      (i32.eq (local.get $x_tag) (i32.const ${STRING_TAG}))
      (i32.eq (local.get $y_tag) (i32.const ${STRING_TAG}))
    )
  ) (if (then
      (global.get ${HEAP_PTR}) ${/* starting address of new string */ ""}
        (global.get ${HEAP_PTR}) (local.get $x_val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $x_val) (i32.wrap_i64) (memory.copy) 
        (global.get ${HEAP_PTR}) (local.get $x_val) (i32.wrap_i64) (i32.add) (global.set ${HEAP_PTR}) 
        (global.get ${HEAP_PTR}) (local.get $y_val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $y_val) (i32.wrap_i64) (memory.copy) 
        (global.get ${HEAP_PTR}) (local.get $y_val) (i32.wrap_i64) (i32.add) (global.set ${HEAP_PTR}) 
      (local.get $x_val) (i32.wrap_i64) (local.get $y_val) (i32.wrap_i64) (i32.add) (call ${MAKE_STRING_FX}) (return)
  ))

  ${/* if either's bool, convert to int */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $x_tag)))
  (i32.eq (local.get $y_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $y_tag)))

  ${/* if both int, use int instr (except for division: use float) */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${INT_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${INT_TAG}))
  ) (if (then
      (block $div
        (block $mul
          (block $sub
            (block $add 
              (local.get $op) (br_table $add $sub $mul $div))
            (local.get $x_val) (local.get $y_val) (i64.add) (call ${MAKE_INT_FX}) (return))
          (local.get $x_val) (local.get $y_val) (i64.sub) (call ${MAKE_INT_FX}) (return))
        (local.get $x_val) (local.get $y_val) (i64.mul) (call ${MAKE_INT_FX}) (return))
      (local.get $x_val) (f64.convert_i64_s) (local.get $y_val) (f64.convert_i64_s) (f64.div) (call ${MAKE_FLOAT_FX}) (return)
    ))

  ${/* else, if either's int, convert to float and set float locals */ ""}
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

  ${/* if both float, use float instr */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG}))
  ) (if (then
      (block $div
        (block $mul
          (block $sub
            (block $add 
              (local.get $op) (br_table $add $sub $mul $div))
            (local.get $a) (local.get $c) (f64.add) (call ${MAKE_FLOAT_FX}) (return))
          (local.get $a) (local.get $c) (f64.sub) (call ${MAKE_FLOAT_FX}) (return))
        (local.get $a) (local.get $c) (f64.mul) (call ${MAKE_FLOAT_FX}) (return))
      (local.get $a) (local.get $c) (f64.div) (call ${MAKE_FLOAT_FX}) (return)
    ))

  ${/* else, if either's complex, load from mem, set locals (default 0) */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG})) (if
    (then (i32.const ${COMPLEX_TAG}) (local.set $x_tag))
    (else (local.get $x_val) (i32.wrap_i64) (f64.load) (local.set $a) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $b))
  )
  (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG})) (if
    (then (i32.const ${COMPLEX_TAG}) (local.set $y_tag))
    (else (local.get $y_val) (i32.wrap_i64) (f64.load) (local.set $c) (local.get $y_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $d))
  )

  ${/* if both complex, perform complex operations */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${COMPLEX_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${COMPLEX_TAG}))
  ) (if (then
      (block $div
        (block $mul
          (block $sub
            (block $add
              (local.get $op) (br_table $add $sub $mul $div))
            (local.get $a) (local.get $c) (f64.add) (local.get $b) (local.get $d) (f64.add) (call ${MAKE_COMPLEX_FX}) (return))
          (local.get $a) (local.get $c) (f64.sub) (local.get $b) (local.get $d) (f64.sub) (call ${MAKE_COMPLEX_FX}) (return))
        ${/* (a+bi)*(c+di) = (ac-bd) + (ad+bc)i */ ""}
        (f64.sub (f64.mul (local.get $a) (local.get $c))
                 (f64.mul (local.get $b) (local.get $d)))
        (f64.add (f64.mul (local.get $a) (local.get $d))
                 (f64.mul (local.get $b) (local.get $c)))
        (call ${MAKE_COMPLEX_FX}) (return)
      )
      ${/* (a+bi)/(c+di) = (ac+bd)/(c^2+d^2) + (bc-ad)/(c^2+d^2)i */ ""}
      (f64.add (f64.mul (local.get $a) (local.get $c))
                (f64.mul (local.get $b) (local.get $d)))
      (f64.add (f64.mul (local.get $c) (local.get $c))
                (f64.mul (local.get $d) (local.get $d)))
      (local.tee $denom) (f64.div)
      (f64.sub (f64.mul (local.get $b) (local.get $c))
                (f64.mul (local.get $a) (local.get $d)))
      (local.get $denom) (f64.div)
      (call ${MAKE_COMPLEX_FX}) (return)
    ))

  ${/* else, unreachable */ ""}
  unreachable
)`;

export const STRING_COMPARE_FX = "$_py_string_cmp";
export const COMPARISON_OP_FX = "$_py_compare_op";
export const EQ_TAG = 0;
export const NEQ_TAG = 1;
export const LT_TAG = 2;
export const LTE_TAG = 3;
export const GT_TAG = 4;
export const GTE_TAG = 5;

const stringCmpFunc = `(func ${STRING_COMPARE_FX} (param $x_ptr i32) (param $x_len i32) (param $y_ptr i32) (param $y_len i32) (result i32)
  (local $i i32) (local $min_len i32) (local $x_char i32) (local $y_char i32) (local $result i32)

  (local.get $x_len) (local.get $y_len) (i32.lt_s (local.get $x_len) (local.get $y_len))
  (select) (local.set $min_len)

  (loop $loop
    (i32.lt_s (local.get $i) (local.get $min_len)) (if (then
      (local.get $x_ptr) (local.get $i) (i32.add) (i32.load8_u) (local.set $x_char)
      (local.get $y_ptr) (local.get $i) (i32.add) (i32.load8_u) (local.set $y_char)

      (local.get $x_char) (local.get $y_char) (i32.sub)
      (local.tee $result) (i32.const 0) (i32.ne) (if (then (local.get $result) (return)))

      (local.get $i) (i32.const 1) (i32.add) (local.set $i)
      (br $loop)
    ))
  )

  (local.get $x_len) (local.get $y_len) (i32.sub) (return)
)
`;

const comparisonOpFunc = `(func ${COMPARISON_OP_FX} (param $x_tag i32) (param $x_val i64) (param $y_tag i32) (param $y_val i64) (param $op i32) (result i32 i64)
  (local $a f64) (local $b f64) (local $c f64) (local $d f64)

  ${/* if both are strings */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${STRING_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${STRING_TAG}))
  ) (if (then
      (local.get $x_val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $x_val) (i32.wrap_i64)
      (local.get $y_val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $y_val) (i32.wrap_i64)
      (call ${STRING_COMPARE_FX})
      (local.tee $x_tag) ${/* reuse x_tag for comparison result */ ""}
      (block $eq
        (block $neq
          (block $lt
            (block $lte
              (block $gt
                (block $gte
                  (local.get $op) (br_table $eq $neq $lt $lte $gt $gte))
                (local.get $x_tag) (i32.const 0) (i32.ge_s) (call ${MAKE_BOOL_FX}) (return))
              (local.get $x_tag) (i32.const 0) (i32.gt_s) (call ${MAKE_BOOL_FX}) (return))
            (local.get $x_tag) (i32.const 0) (i32.le_s) (call ${MAKE_BOOL_FX}) (return))
          (local.get $x_tag) (i32.const 0) (i32.lt_s) (call ${MAKE_BOOL_FX}) (return))
        (local.get $x_tag) (i32.const 0) (i32.ne) (call ${MAKE_BOOL_FX}) (return))
      (local.get $x_tag) (i32.eqz) (call ${MAKE_BOOL_FX}) (return)
    ))


  ${/* if either are bool, convert to int */ ""}
  (i32.eq (local.get $x_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $x_tag)))
  (i32.eq (local.get $y_tag) (i32.const ${BOOL_TAG})) (if (then (i32.const ${INT_TAG}) (local.set $y_tag)))

  ${/* if both int, use int comparison */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${INT_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${INT_TAG}))
  ) (if (then
      (block $eq
        (block $neq
          (block $lt
            (block $lte
              (block $gt
                (block $gte
                  (local.get $op) (br_table $eq $neq $lt $lte $gt $gte))
                (local.get $x_val) (local.get $y_val) (i64.ge_s) (call ${MAKE_BOOL_FX}) (return))
              (local.get $x_val) (local.get $y_val) (i64.gt_s) (call ${MAKE_BOOL_FX}) (return))
            (local.get $x_val) (local.get $y_val) (i64.le_s) (call ${MAKE_BOOL_FX}) (return))
          (local.get $x_val) (local.get $y_val) (i64.lt_s) (call ${MAKE_BOOL_FX}) (return))
        (local.get $x_val) (local.get $y_val) (i64.ne) (call ${MAKE_BOOL_FX}) (return))
      (local.get $x_val) (local.get $y_val) (i64.eq) (call ${MAKE_BOOL_FX}) (return)
    ))

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

  ${/* if both float, use float comparison */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${FLOAT_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${FLOAT_TAG}))
  ) (if (then
      (block $eq
        (block $neq
          (block $lt
            (block $lte
              (block $gt
                (block $gte
                  (local.get $op) (br_table $eq $neq $lt $lte $gt $gte))
                (local.get $a) (local.get $c) (f64.ge) (call ${MAKE_BOOL_FX}) (return))
              (local.get $a) (local.get $c) (f64.gt) (call ${MAKE_BOOL_FX}) (return))
            (local.get $a) (local.get $c) (f64.le) (call ${MAKE_BOOL_FX}) (return))
          (local.get $a) (local.get $c) (f64.lt) (call ${MAKE_BOOL_FX}) (return))
        (local.get $a) (local.get $c) (f64.ne) (call ${MAKE_BOOL_FX}) (return))
      (local.get $a) (local.get $c) (f64.eq) (call ${MAKE_BOOL_FX}) (return)
    ))

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

  ${/* if both complex, compare real and imaginary parts. only ==, != */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${COMPLEX_TAG}))
    (i32.eq (local.get $y_tag) (i32.const ${COMPLEX_TAG}))
  ) (if (then
      (i32.eq (local.get $op) (i32.const ${EQ_TAG})) (if
        (then (local.get $a) (local.get $c) (f64.eq) (local.get $b) (local.get $d) (f64.eq) (i32.and) (call ${MAKE_BOOL_FX}) (return))
        (else
          (i32.eq (local.get $op) (i32.const ${NEQ_TAG})) (if
            (then (local.get $a) (local.get $c) (f64.ne) (local.get $b) (local.get $d) (f64.ne) (i32.or) (call ${MAKE_BOOL_FX}) (return))
            (else unreachable)
          )
        )
      )
    ))

  ${/* else, unreachable */ ""}
  unreachable
)`;

export const nameToFunctionMap = {
  [MAKE_INT_FX]: makeIntFunc,
  [MAKE_FLOAT_FX]: makeFloatFunc,
  [MAKE_COMPLEX_FX]: makeComplexFunc,
  [MAKE_BOOL_FX]: makeBoolFunc,
  [MAKE_STRING_FX]: makeStringFunc,
  [MAKE_CLOSURE_FX]: makeClosureFunc,
  [ARITHMETIC_OP_FX]: arithmeticOpFunc,
  [COMPARISON_OP_FX]: comparisonOpFunc,
  [STRING_COMPARE_FX]: stringCmpFunc,
  [NEG_FUNC_NAME]: negFunc,
};
