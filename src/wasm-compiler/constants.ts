// tags
export const TYPE_TAG = {
  INT: 0,
  FLOAT: 1,
  COMPLEX: 2,
  BOOL: 3,
  STRING: 4,
  CLOSURE: 5,
  NONE: 6,
  UNBOUND: 7,
  PAIR: 8,
} as const;

export const ERROR_MAP = {
  NEG_NOT_SUPPORT: [0, "Unary minus operator used on unsupported operand."],
  LOG_UNKNOWN_TYPE: [1, "Calling log on an unknown runtime type."],
  ARITH_OP_UNKNOWN_TYPE: [
    2,
    "Calling an arithmetic operation on an unsupported runtime type.",
  ],
  COMPLEX_COMPARISON: [
    3,
    "Using an unsupported comparison operator on complex type.",
  ],
  COMPARE_OP_UNKNOWN_TYPE: [
    4,
    "Calling a comparison operation on an unsupported runtime type.",
  ],
  CALL_NOT_FUNC: [5, "Calling a non-function value."],
  FUNC_WRONG_ARITY: [6, "Calling function with wrong number of arguments."],
  UNBOUND: [7, "Accessing an unbound value."],
  HEAD_NOT_PAIR: [8, "Accessing the head of a non-pair value."],
  TAIL_NOT_PAIR: [9, "Accessing the tail of a non-pair value."],
} as const;

export const TAG_SUFFIX = "_tag";
export const PAYLOAD_SUFFIX = "_payload";

export const HEAP_PTR = "$_heap_pointer";
export const CURR_ENV = "$_current_env";

// boxing functions
export const MAKE_INT_FX = "$_make_int";
export const MAKE_FLOAT_FX = "$_make_float";
export const MAKE_COMPLEX_FX = "$_make_complex";
export const MAKE_BOOL_FX = "$_make_bool";
export const MAKE_STRING_FX = "$_make_string";
export const MAKE_CLOSURE_FX = "$_make_closure";
export const MAKE_NONE_FX = "$_make_none";

const makeIntFunc = `(func ${MAKE_INT_FX} (param $value i64) (result i32 i64) (i32.const ${TYPE_TAG.INT}) (local.get $value))`;
const makeFloatFunc = `(func ${MAKE_FLOAT_FX} (param $value f64) (result i32 i64) (i32.const ${TYPE_TAG.FLOAT}) (local.get $value) (i64.reinterpret_f64))`;
const makeComplexFunc = `(func ${MAKE_COMPLEX_FX} (param $real f64) (param $img f64) (result i32 i64) (global.get ${HEAP_PTR}) (local.get $real) (f64.store) (global.get ${HEAP_PTR}) (i32.const 8) (i32.add) (local.get $img) (f64.store) (i32.const ${TYPE_TAG.COMPLEX}) (global.get ${HEAP_PTR}) (i64.extend_i32_u) (global.get ${HEAP_PTR}) (i32.const 16) (i32.add) (global.set ${HEAP_PTR}))`;
const makeBoolFunc = `(func ${MAKE_BOOL_FX} (param $value i32) (result i32 i64) (i32.const ${TYPE_TAG.BOOL}) (local.get $value) (i64.extend_i32_u))`;
// upper 32: pointer; lower 32: length
const makeStringFunc = `(func ${MAKE_STRING_FX} (param $ptr i32) (param $len i32) (result i32 i64) (i32.const ${TYPE_TAG.STRING}) (local.get $ptr) (i64.extend_i32_u) (i64.const 32) (i64.shl) (local.get $len) (i64.extend_i32_u) (i64.or))`;
// upper 16: tag; upperMid 8: arity; lowerMid 8: envSize; lower 32: parentEnv
const makeClosureFunc = `(func ${MAKE_CLOSURE_FX} (param $tag i32) (param $arity i32) (param $env_size i32) (param $parent_env i32) (result i32 i64) (i32.const ${TYPE_TAG.CLOSURE}) (local.get $tag) (i64.extend_i32_u) (i64.const 48) (i64.shl) (local.get $arity) (i64.extend_i32_u) (i64.const 40) (i64.shl) (i64.or) (local.get $env_size) (i64.extend_i32_u) (i64.const 32) (i64.shl) (i64.or) (local.get $parent_env) (i64.extend_i32_u) (i64.or))`;
const makeNoneFunc = `(func ${MAKE_NONE_FX} (result i32 i64) (i32.const ${TYPE_TAG.NONE}) (i64.const 0))`;

// pair-related functions
export const MAKE_PAIR_FX = "$_make_pair";
export const GET_PAIR_HEAD_FX = "$_get_pair_head";
export const GET_PAIR_TAIL_FX = "$_get_pair_tail";
export const SET_PAIR_HEAD_FX = "$_set_pair_head";
export const SET_PAIR_TAIL_FX = "$_set_pair_tail";

const makePairFunc = `(func ${MAKE_PAIR_FX} (param $tag1 i32) (param $val1 i64) (param $tag2 i32) (param $val2 i64) (result i32 i64)
  (global.get ${HEAP_PTR}) (local.get $tag1) (i32.store)
  (global.get ${HEAP_PTR}) (i32.const 4) (i32.add) (local.get $val1) (i64.store)
  (global.get ${HEAP_PTR}) (i32.const 12) (i32.add) (local.get $tag2) (i32.store)
  (global.get ${HEAP_PTR}) (i32.const 16) (i32.add) (local.get $val2) (i64.store)
  (i32.const ${TYPE_TAG.PAIR}) (global.get ${HEAP_PTR}) (i64.extend_i32_u) (global.get ${HEAP_PTR}) (i32.const 24) (i32.add) (global.set ${HEAP_PTR})
)`;
const getPairHeadFunc = `(func ${GET_PAIR_HEAD_FX} (param $tag i32) (param $val i64) (result i32 i64)
  (i32.ne (local.get $tag) (i32.const ${TYPE_TAG.PAIR})) (if (then
    (call $_log_error (i32.const ${ERROR_MAP.HEAD_NOT_PAIR[0]}))
    unreachable
  ))

  (local.get $val) (i32.wrap_i64) (i32.load)
  (local.get $val) (i32.wrap_i64) (i32.const 4) (i32.add) (i64.load)
)`;
const getPairTailFunc = `(func ${GET_PAIR_TAIL_FX} (param $tag i32) (param $val i64) (result i32 i64)
  (i32.ne (local.get $tag) (i32.const ${TYPE_TAG.PAIR})) (if (then
    (call $_log_error (i32.const ${ERROR_MAP.TAIL_NOT_PAIR[0]}))
    unreachable
  ))

  (local.get $val) (i32.wrap_i64) (i32.const 12) (i32.add) (i32.load)
  (local.get $val) (i32.wrap_i64) (i32.const 16) (i32.add) (i64.load)
)`;
const setPairHeadFunc = `(func ${SET_PAIR_HEAD_FX} (param $pair_tag i32) (param $pair_val i64) (param $tag i32) (param $val i64)
  (i32.ne (local.get $pair_tag) (i32.const ${TYPE_TAG.PAIR})) (if (then
    (call $_log_error (i32.const ${ERROR_MAP.HEAD_NOT_PAIR[0]}))
    unreachable
  ))

  (local.get $pair_val) (i32.wrap_i64) (local.get $tag) (i32.store)
  (local.get $pair_val) (i32.wrap_i64) (i32.const 4) (i32.add) (local.get $val) (i64.store)
)`;
const setPairTailFunc = `(func ${SET_PAIR_TAIL_FX} (param $pair_tag i32) (param $pair_val i64) (param $tag i32) (param $val i64)
  (i32.ne (local.get $pair_tag) (i32.const ${TYPE_TAG.PAIR})) (if (then
    (call $_log_error (i32.const ${ERROR_MAP.TAIL_NOT_PAIR[0]}))
    unreachable
  ))

  (local.get $pair_val) (i32.wrap_i64) (i32.const 12) (i32.add) (local.get $tag) (i32.store)
  (local.get $pair_val) (i32.wrap_i64) (i32.const 16) (i32.add) (local.get $val) (i64.store)
)`;

// unary operation functions
export const NEG_FUNC_NAME = "$_py_neg";

const negFunc = `(func ${NEG_FUNC_NAME} (param $x_tag i32) (param $x_val i64) (result i32 i64)
  (local.get $x_tag) (i32.const ${TYPE_TAG.INT}) i32.eq (if 
    (then (local.get $x_val) (i64.const -1) (i64.xor) (i64.const 1) (i64.add) (call ${MAKE_INT_FX}) (return)))
  (local.get $x_tag) (i32.const ${TYPE_TAG.FLOAT}) i32.eq (if
    (then (local.get $x_val) (f64.reinterpret_i64) (f64.neg) (call ${MAKE_FLOAT_FX}) (return)))
  (local.get $x_tag) (i32.const ${TYPE_TAG.COMPLEX}) i32.eq (if
    (then (local.get $x_val) (i32.wrap_i64) (f64.load) (f64.neg) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (f64.neg) (call ${MAKE_COMPLEX_FX}) (return)))
    
  (call $_log_error (i32.const ${ERROR_MAP.NEG_NOT_SUPPORT[0]}))
  unreachable
)`;

// logging functions
export const LOG_FUNCS = [
  '(import "console" "log" (func $_log_int (param i64)))',
  '(import "console" "log" (func $_log_float (param f64)))',
  '(import "console" "log_complex" (func $_log_complex (param f64) (param f64)))',
  '(import "console" "log_bool" (func $_log_bool (param i64)))',
  '(import "console" "log_string" (func $_log_string (param i32) (param i32)))',
  '(import "console" "log_closure" (func $_log_closure (param i32) (param i32) (param i32) (param i32)))',
  '(import "console" "log_none" (func $_log_none))',
  '(import "console" "log_pair" (func $_log_pair))',
  '(import "console" "log_error" (func $_log_error (param i32)))',
  `(func $log (param $tag i32) (param $value i64)
    (local.get $tag) (i32.const ${TYPE_TAG.INT}) i32.eq (if
      (then (local.get $value) (call $_log_int) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.FLOAT}) i32.eq (if
      (then (local.get $value) (f64.reinterpret_i64) (call $_log_float) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.COMPLEX}) i32.eq (if
      (then (local.get $value) (i32.wrap_i64) (f64.load) (local.get $value) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (call $_log_complex) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.BOOL}) i32.eq (if
      (then (local.get $value) (call $_log_bool) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.STRING}) i32.eq (if
      (then (local.get $value) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (local.get $value) (i32.wrap_i64) (call $_log_string) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.CLOSURE}) i32.eq (if
      (then (local.get $value) (i64.const 48) (i64.shr_u) (i32.wrap_i64) (i32.const 65535) (i32.and) (local.get $value) (i64.const 40) (i64.shr_u) (i32.wrap_i64) (i32.const 255) (i32.and) (local.get $value) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (i32.const 255) (i32.and) (local.get $value) (i32.wrap_i64) (call $_log_closure) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.NONE}) i32.eq (if
      (then (call $_log_none) (return)))
    (local.get $tag) (i32.const ${TYPE_TAG.PAIR}) i32.eq (if
      (then (local.get $tag) (local.get $value) (call ${GET_PAIR_HEAD_FX}) (call $log) (local.get $tag) (local.get $value) (call ${GET_PAIR_TAIL_FX}) (call $log) (return)))

    (call $_log_error (i32.const ${ERROR_MAP.LOG_UNKNOWN_TYPE[0]}))
    unreachable
  )`,
];

// binary operation function
export const ARITHMETIC_OP_FX = "$_py_arith_op";
export const ARITHMETIC_OP_TAG = {
  ADD: 0,
  SUB: 1,
  MUL: 2,
  DIV: 3,
} as const;

const arithmeticOpFunc = `(func ${ARITHMETIC_OP_FX} (param $x_tag i32) (param $x_val i64) (param $y_tag i32) (param $y_val i64) (param $op i32) (result i32 i64)
  (local $a f64) (local $b f64) (local $c f64) (local $d f64) (local $denom f64)

  ${/* if adding, check if both are strings */ ""}
  (i32.and 
    (i32.eq (local.get $op) (i32.const ${ARITHMETIC_OP_TAG.ADD}))
    (i32.and
      (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.STRING}))
      (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.STRING}))
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
  (i32.eq (local.get $x_tag) (i32.const ${
    TYPE_TAG.BOOL
  })) (if (then (i32.const ${TYPE_TAG.INT}) (local.set $x_tag)))
  (i32.eq (local.get $y_tag) (i32.const ${
    TYPE_TAG.BOOL
  })) (if (then (i32.const ${TYPE_TAG.INT}) (local.set $y_tag)))

  ${/* if both int, use int instr (except for division: use float) */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.INT}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.INT}))
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
  (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.INT})) (if (result f64)
    (then (local.get $x_val) (f64.convert_i64_s) (i32.const ${
      TYPE_TAG.FLOAT
    }) (local.set $x_tag))
    (else (local.get $x_val) (f64.reinterpret_i64))
  )
  (local.set $a)
  (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.INT})) (if (result f64)
    (then (local.get $y_val) (f64.convert_i64_s) (i32.const ${
      TYPE_TAG.FLOAT
    }) (local.set $y_tag))
    (else (local.get $y_val) (f64.reinterpret_i64))
  )
  (local.set $c)

  ${/* if both float, use float instr */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.FLOAT}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.FLOAT}))
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
  (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.FLOAT})) (if
    (then (i32.const ${TYPE_TAG.COMPLEX}) (local.set $x_tag))
    (else (local.get $x_val) (i32.wrap_i64) (f64.load) (local.set $a) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $b))
  )
  (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.FLOAT})) (if
    (then (i32.const ${TYPE_TAG.COMPLEX}) (local.set $y_tag))
    (else (local.get $y_val) (i32.wrap_i64) (f64.load) (local.set $c) (local.get $y_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $d))
  )

  ${/* if both complex, perform complex operations */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.COMPLEX}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.COMPLEX}))
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
  (call $_log_error (i32.const ${ERROR_MAP.ARITH_OP_UNKNOWN_TYPE[0]}))
  unreachable
)`;

export const STRING_COMPARE_FX = "$_py_string_cmp";
export const COMPARISON_OP_FX = "$_py_compare_op";
export const COMPARISON_OP_TAG = {
  EQ: 0,
  NEQ: 1,
  LT: 2,
  LTE: 3,
  GT: 4,
  GTE: 5,
} as const;

const stringCmpFunc = `(func ${STRING_COMPARE_FX} (param $x_ptr i32) (param $x_len i32) (param $y_ptr i32) (param $y_len i32) (result i32)
  (local $i i32) (local $min_len i32) (local $x_char i32) (local $y_char i32) (local $result i32)

  (local.get $x_len) (local.get $y_len) (i32.lt_s (local.get $x_len) (local.get $y_len))
  (select) (local.set $min_len)

  (loop $loop
    (i32.lt_s (local.get $i) (local.get $min_len)) (if (then
      (local.get $x_ptr) (local.get $i) (i32.add) (i32.load8_u) (local.set $x_char)
      (local.get $y_ptr) (local.get $i) (i32.add) (i32.load8_u) (local.set $y_char)

      (local.get $x_char) (local.get $y_char) (i32.sub)
      (local.tee $result) (if (then (local.get $result) (return)))

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
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.STRING}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.STRING}))
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
  (i32.eq (local.get $x_tag) (i32.const ${
    TYPE_TAG.BOOL
  })) (if (then (i32.const ${TYPE_TAG.INT}) (local.set $x_tag)))
  (i32.eq (local.get $y_tag) (i32.const ${
    TYPE_TAG.BOOL
  })) (if (then (i32.const ${TYPE_TAG.INT}) (local.set $y_tag)))

  ${/* if both int, use int comparison */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.INT}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.INT}))
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
  (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.INT})) (if (result f64)
    (then (local.get $x_val) (f64.convert_i64_s) (i32.const ${
      TYPE_TAG.FLOAT
    }) (local.set $x_tag))
    (else (local.get $x_val) (f64.reinterpret_i64))
  )
  (local.set $a)
  (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.INT})) (if (result f64)
    (then (local.get $y_val) (f64.convert_i64_s) (i32.const ${
      TYPE_TAG.FLOAT
    }) (local.set $y_tag))
    (else (local.get $y_val) (f64.reinterpret_i64))
  )
  (local.set $c)

  ${/* if both float, use float comparison */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.FLOAT}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.FLOAT}))
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
  (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.FLOAT})) (if
    (then (i32.const ${TYPE_TAG.COMPLEX}) (local.set $x_tag))
    (else (local.get $x_val) (i32.wrap_i64) (f64.load) (local.set $a) (local.get $x_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $b))
  )
  (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.FLOAT})) (if
    (then (i32.const ${TYPE_TAG.COMPLEX}) (local.set $y_tag))
    (else (local.get $y_val) (i32.wrap_i64) (f64.load) (local.set $c) (local.get $y_val) (i32.wrap_i64) (i32.const 8) (i32.add) (f64.load) (local.set $d))
  )

  ${/* if both complex, compare real and imaginary parts. only ==, != */ ""}
  (i32.and
    (i32.eq (local.get $x_tag) (i32.const ${TYPE_TAG.COMPLEX}))
    (i32.eq (local.get $y_tag) (i32.const ${TYPE_TAG.COMPLEX}))
  ) (if (then
      (i32.eq (local.get $op) (i32.const ${COMPARISON_OP_TAG.EQ})) (if
        (then (local.get $a) (local.get $c) (f64.eq) (local.get $b) (local.get $d) (f64.eq) (i32.and) (call ${MAKE_BOOL_FX}) (return))
        (else
          (i32.eq (local.get $op) (i32.const ${COMPARISON_OP_TAG.NEQ})) (if
            (then (local.get $a) (local.get $c) (f64.ne) (local.get $b) (local.get $d) (f64.ne) (i32.or) (call ${MAKE_BOOL_FX}) (return))
            (else (call $_log_error (i32.const ${
              ERROR_MAP.COMPLEX_COMPARISON[0]
            })) unreachable)
          )
        )
      )
    ))

  ${/* else, unreachable */ ""}
  (call $_log_error (i32.const ${ERROR_MAP.COMPARE_OP_UNKNOWN_TYPE[0]}))
  unreachable
)`;

// *3*4 because each variable has a tag and payload = 3 words = 12 bytes; +4 because parentEnv is stored at start of env
export const ALLOC_ENV_FUNC = "$_alloc_env";
const allocEnvFunc = `(func ${ALLOC_ENV_FUNC} (param $size i32) (param $parent i32)
  (global.get ${HEAP_PTR}) (global.set ${CURR_ENV})
  (global.get ${HEAP_PTR}) (local.get $parent) (i32.store)
  (global.get ${HEAP_PTR}) (i32.const 4) (i32.add) (global.set ${HEAP_PTR})

  (loop $loop
    (local.get $size) (if (then
      (global.get ${HEAP_PTR}) (i32.const ${TYPE_TAG.UNBOUND}) (i32.store)
      (global.get ${HEAP_PTR}) (i32.const 12) (i32.add) (global.set ${HEAP_PTR})
      (local.get $size) (i32.const 1) (i32.sub) (local.set $size)
      (br $loop)
    ))
  )
)`;

export const APPLY_FUNC = "$_apply_";
// one applyFunc per arity
export const applyFuncFactory = (arity: number, bodies: string[]) => {
  let params = "";
  for (let i = 0; i < arity; i++)
    params += `(param $p_${i}${TAG_SUFFIX} i32) (param $p_${i}${PAYLOAD_SUFFIX} i64) `;

  let setParams = "";
  for (let i = 0; i < arity; i++)
    setParams += `(i32.const 0) (i32.const ${i}) (local.get $p_${i}${TAG_SUFFIX}) (local.get $p_${i}${PAYLOAD_SUFFIX}) (call ${SET_LEX_ADDR_FUNC})`;

  let brTableJumps = "";
  for (let i = 0; i < bodies.length; i++) brTableJumps += `${i} `;

  return `(func ${APPLY_FUNC}${arity} (param $tag i32) (param $val i64) ${params}(result i32 i64) (local $return_env i32)
  (i32.ne (local.get $tag) (i32.const ${TYPE_TAG.CLOSURE})) (if (then
    (call $_log_error (i32.const ${ERROR_MAP.CALL_NOT_FUNC[0]})) unreachable
  ))

  (local.get $val) (i64.const 40) (i64.shr_u) (i32.wrap_i64) (i32.const 255) (i32.and) (i32.const ${arity}) (i32.ne) (if (then
    (call $_log_error (i32.const ${ERROR_MAP.FUNC_WRONG_ARITY[0]})) unreachable
  ))

  ${"(block ".repeat(bodies.length)}
    (global.get ${CURR_ENV}) (local.set $return_env)
    (local.get $val) (i64.const 32) (i64.shr_u) (i32.wrap_i64) (i32.const 255) (i32.and) (local.get $val) (i32.wrap_i64) (call ${ALLOC_ENV_FUNC})
    (local.get $val) (i64.const 48) (i64.shr_u) (i32.wrap_i64) (br_table ${brTableJumps})
  ${bodies
    .map(
      (body) =>
        `\n) ${setParams} ${body} (call ${MAKE_NONE_FX}) (local.get $return_env) (global.set ${CURR_ENV}) (return)`
    )
    .join("  \n")}
)`;
};

// env in i32s: parentEnv | var0_tag | var0_payload1 | var0_payload2 | var1_tag | var1_payload1 | ...

export const GET_LEX_ADDR_FUNC = "$_get_lex_addr";
export const SET_LEX_ADDR_FUNC = "$_set_lex_addr";

const getLexAddressFunction = `(func ${GET_LEX_ADDR_FUNC} (param $depth i32) (param $index i32) (result i32 i64) (local $env i32) (local $tag i32)
  (local.set $env (global.get ${CURR_ENV}))

  (loop $loop
    (i32.eqz (local.get $depth)) (if (then
      (local.get $env) (i32.const 4) (i32.add) (local.get $index) (i32.const 12) (i32.mul) (i32.add) (i32.load) (local.set $tag)
      (i32.eq (local.get $tag) (i32.const ${TYPE_TAG.UNBOUND})) (if (then (call $_log_error (i32.const ${ERROR_MAP.UNBOUND[0]})) unreachable))
      (local.get $tag)
      (local.get $env) (i32.const 8) (i32.add) (local.get $index) (i32.const 12) (i32.mul) (i32.add) (i64.load)
      (return)
    ))

    (local.get $env) (i32.load) (local.set $env)
    (local.get $depth) (i32.const 1) (i32.sub) (local.set $depth)
    (br $loop)
  )

  unreachable
)`;

const setLexAddressFunction = `(func ${SET_LEX_ADDR_FUNC} (param $depth i32) (param $index i32) (param $tag i32) (param $payload i64) (local $env i32)
  (local.set $env (global.get ${CURR_ENV}))

  (loop $loop
    (i32.eqz (local.get $depth)) (if (then
      (local.get $env) (i32.const 4) (i32.add) (local.get $index) (i32.const 12) (i32.mul) (i32.add) (local.get $tag) (i32.store)
      (local.get $env) (i32.const 8) (i32.add) (local.get $index) (i32.const 12) (i32.mul) (i32.add) (local.get $payload) (i64.store)
      (return)
    ))

    (local.get $env) (i32.load) (local.set $env)
    (local.get $depth) (i32.const 1) (i32.sub) (local.set $depth)
    (br $loop)
  )

  unreachable
)`;

export const nameToFunctionMap = {
  [ALLOC_ENV_FUNC]: allocEnvFunc,
  [MAKE_INT_FX]: makeIntFunc,
  [MAKE_FLOAT_FX]: makeFloatFunc,
  [MAKE_COMPLEX_FX]: makeComplexFunc,
  [MAKE_BOOL_FX]: makeBoolFunc,
  [MAKE_STRING_FX]: makeStringFunc,
  [MAKE_CLOSURE_FX]: makeClosureFunc,
  [MAKE_NONE_FX]: makeNoneFunc,
  [ARITHMETIC_OP_FX]: arithmeticOpFunc,
  [COMPARISON_OP_FX]: comparisonOpFunc,
  [STRING_COMPARE_FX]: stringCmpFunc,
  [NEG_FUNC_NAME]: negFunc,
  [GET_LEX_ADDR_FUNC]: getLexAddressFunction,
  [SET_LEX_ADDR_FUNC]: setLexAddressFunction,
  [MAKE_PAIR_FX]: makePairFunc,
  [GET_PAIR_HEAD_FX]: getPairHeadFunc,
  [GET_PAIR_TAIL_FX]: getPairTailFunc,
  [SET_PAIR_HEAD_FX]: setPairHeadFunc,
  [SET_PAIR_TAIL_FX]: setPairTailFunc,
};
