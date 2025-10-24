import { ExprNS, StmtNS } from "../../ast-types";
import { TokenType } from "../../tokens";
import {
  ARITHMETIC_OP_FX,
  ARITHMETIC_OP_TAG,
  MAKE_INT_FX,
  TYPE_TAG,
} from "../constants";
import { BaseGenerator } from "./baseGenerator";
import {
  blockType,
  i32,
  i64,
  local,
  wasm,
  WasmFunction,
  WasmInstruction,
  WasmNumeric,
} from "./typed-builder";

const makeIntFunc = wasm
  .func(MAKE_INT_FX)
  .params({ $value: "i64" })
  .results("i32", "i64")
  .body(i32.const(TYPE_TAG.INT), local.get("$value"));

const arithmeticOpFunc = wasm
  .func(ARITHMETIC_OP_FX)
  .params({
    $x_tag: "i32",
    $x_val: "i64",
    $y_tag: "i32",
    $y_val: "i64",
    $op: "i32",
  })
  .results("i32", "i64")
  .locals({
    $a: "f64",
    $b: "f64",
    $c: "f64",
    $d: "f64",
    $denom: "f64",
  })
  .body(
    // wasm
    //   .if(
    //     "",
    //     i32.and(
    //       i32.eq(local.get("$op"), i32.const(ARITHMETIC_OP_TAG.ADD)),
    //       i32.and(
    //         i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.STRING)),
    //         i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.STRING))
    //       )
    //     )
    //   )
    //   .then(
    //     global.get(HEAP_PTR),

    //     memory.copy(
    //       global.get(HEAP_PTR),
    //       i32.wrap_i64(i64.shr_u(local.get("$x_val"), i64.const(32))),
    //       i32.wrap_i64(local.get("$x_val"))
    //     ),
    //     global.set(
    //       HEAP_PTR,
    //       i32.add(global.get(HEAP_PTR), i32.wrap_i64(local.get("$x_val")))
    //     ),
    //     memory.copy(
    //       global.get(HEAP_PTR),
    //       i32.wrap_i64(i64.shr_u(local.get("$y_val"), i64.const(32))),
    //       i32.wrap_i64(local.get("$y_val"))
    //     ),
    //     global.set(
    //       HEAP_PTR,
    //       i32.add(global.get(HEAP_PTR), i32.wrap_i64(local.get("$y_val")))
    //     ),
    //     i32.add(
    //       i32.wrap_i64(local.get("$x_val")),
    //       i32.wrap_i64(local.get("$y_val"))
    //     ),

    //     wasm.call(MAKE_STRING_FX).args(),
    //     wasm.return()
    //   ),

    wasm
      .if("", i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.BOOL)))
      .then(local.set("$x_tag", i32.const(TYPE_TAG.INT))),
    wasm
      .if("", i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.BOOL)))
      .then(local.set("$y_tag", i32.const(TYPE_TAG.INT))),

    wasm
      .if(
        "",
        i32.and(
          i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)),
          i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT))
        )
      )
      .then(
        // wasm
        //   .block("$div")
        //   .body(
        wasm
          .block("$mul")
          .body(
            wasm
              .block("$sub")
              .body(
                wasm
                  .block("$add")
                  .body(
                    local.get("$op"),
                    wasm.br_table("$add", "$sub", "$mul")
                  ),
                wasm
                  .call(MAKE_INT_FX)
                  .args(i64.add(local.get("$x_val"), local.get("$y_val"))),
                wasm.return()
              ),
            wasm
              .call(MAKE_INT_FX)
              .args(i64.sub(local.get("$x_val"), local.get("$y_val"))),
            wasm.return()
          ),
        wasm
          .call(MAKE_INT_FX)
          .args(i64.mul(local.get("$x_val"), local.get("$y_val"))),
        wasm.return()
      ),
    //   wasm
    //     .call(MAKE_FLOAT_FX)
    //     .args(
    //       f64.div(
    //         f64.convert_i64_s(local.get("$x_val")),
    //         f64.convert_i64_s(local.get("$y_val"))
    //       )
    //     ),
    //   wasm.return()
    // ),

    // wasm
    //   .if("", i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.INT)))
    //   .then(
    //     local.set("$a", f64.convert_i64_s(local.get("$x_val"))),
    //     local.set("$x_tag", i32.const(TYPE_TAG.FLOAT))
    //   )
    //   .else(local.set("$a", f64.reinterpret_i64(local.get("$x_val")))),

    // wasm
    //   .if("", i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.INT)))
    //   .then(
    //     local.set("$c", f64.convert_i64_s(local.get("$y_val"))),
    //     local.set("$y_tag", i32.const(TYPE_TAG.FLOAT))
    //   )
    //   .else(local.set("$c", f64.reinterpret_i64(local.get("$y_val")))),

    // wasm
    //   .if(
    //     "",
    //     i32.and(
    //       i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)),
    //       i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT))
    //     )
    //   )
    //   .then(
    //     wasm
    //       .block("$div")
    //       .body(
    //         wasm
    //           .block("$mul")
    //           .body(
    //             wasm
    //               .block("$sub")
    //               .body(
    //                 wasm
    //                   .block("$add")
    //                   .body(
    //                     local.get("$op"),
    //                     wasm.br_table("$add", "$sub", "$mul", "$div")
    //                   ),
    //                 wasm
    //                   .call(MAKE_FLOAT_FX)
    //                   .args(f64.add(local.get("$a"), local.get("$c"))),
    //                 wasm.return()
    //               ),
    //             wasm
    //               .call(MAKE_FLOAT_FX)
    //               .args(f64.sub(local.get("$a"), local.get("$c"))),
    //             wasm.return()
    //           ),
    //         wasm
    //           .call(MAKE_FLOAT_FX)
    //           .args(f64.mul(local.get("$a"), local.get("$c"))),
    //         wasm.return()
    //       ),
    //     wasm
    //       .call(MAKE_FLOAT_FX)
    //       .args(f64.div(local.get("$a"), local.get("$c"))),
    //     wasm.return()
    //   ),

    // wasm
    //   .if("", i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.FLOAT)))
    //   .then(local.set("$x_tag", i32.const(TYPE_TAG.COMPLEX)))
    //   .else(
    //     local.set("$a", f64.load(i32.wrap_i64(local.get("$x_val")))),
    //     local.set(
    //       "$b",
    //       f64.load(i32.add(i32.wrap_i64(local.get("$x_val")), i32.const(8)))
    //     )
    //   ),

    // wasm
    //   .if("", i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.FLOAT)))
    //   .then(local.set("$y_tag", i32.const(TYPE_TAG.COMPLEX)))
    //   .else(
    //     local.set("$c", f64.load(i32.wrap_i64(local.get("$y_val")))),
    //     local.set(
    //       "$d",
    //       f64.load(i32.add(i32.wrap_i64(local.get("$y_val")), i32.const(8)))
    //     )
    //   ),

    // wasm
    //   .if(
    //     "",
    //     i32.and(
    //       i32.eq(local.get("$x_tag"), i32.const(TYPE_TAG.COMPLEX)),
    //       i32.eq(local.get("$y_tag"), i32.const(TYPE_TAG.COMPLEX))
    //     )
    //   )
    //   .then(
    //     wasm
    //       .block("$div")
    //       .body(
    //         wasm
    //           .block("$mul")
    //           .body(
    //             wasm
    //               .block("$sub")
    //               .body(
    //                 wasm
    //                   .block("$add")
    //                   .body(
    //                     local.get("$op"),
    //                     wasm.br_table("$add", "$sub", "$mul", "$div")
    //                   ),
    //                 wasm
    //                   .call(MAKE_COMPLEX_FX)
    //                   .args(
    //                     f64.add(local.get("$a"), local.get("$c")),
    //                     f64.add(local.get("$b"), local.get("$d"))
    //                   ),
    //                 wasm.return()
    //               ),
    //             wasm
    //               .call(MAKE_COMPLEX_FX)
    //               .args(
    //                 f64.sub(local.get("$a"), local.get("$c")),
    //                 f64.sub(local.get("$b"), local.get("$d"))
    //               ),
    //             wasm.return()
    //           ),
    //         wasm
    //           .call(MAKE_COMPLEX_FX)
    //           .args(
    //             f64.sub(
    //               f64.mul(local.get("$a"), local.get("$c")),
    //               f64.mul(local.get("$b"), local.get("$d"))
    //             ),
    //             f64.add(
    //               f64.mul(local.get("$b"), local.get("$c")),
    //               f64.mul(local.get("$a"), local.get("$d"))
    //             )
    //           ),
    //         wasm.return()
    //       ),
    //     wasm
    //       .call(MAKE_COMPLEX_FX)
    //       .args(
    //         local.tee(
    //           "$denom",
    //           f64.div(
    //             f64.add(
    //               f64.mul(local.get("$a"), local.get("$c")),
    //               f64.mul(local.get("$b"), local.get("$d"))
    //             ),
    //             f64.add(
    //               f64.mul(local.get("$c"), local.get("$c")),
    //               f64.mul(local.get("$d"), local.get("$d"))
    //             )
    //           )
    //         ),
    //         f64.div(
    //           f64.sub(
    //             f64.mul(local.get("$b"), local.get("$c")),
    //             f64.mul(local.get("$a"), local.get("$d"))
    //           ),
    //           local.get("$denom")
    //         )
    //       ),
    //     wasm.return()
    //   ),

    wasm.unreachable()
  );

export class FluentGenerator extends BaseGenerator<WasmInstruction> {
  visitFileInputStmt(stmt: StmtNS.FileInput): WasmInstruction {
    return wasm
      .module()
      .imports(
        // wasm.import("js", "mem").memory(1),
        wasm.import("console", "log").func("$_log_int", blockType.params("i64"))
      )
      .funcs(
        arithmeticOpFunc,
        makeIntFunc,
        wasm
          .func("$main")
          .body(
            ...(stmt.statements.map((s) => this.visit(s)) as Exclude<
              WasmInstruction,
              WasmFunction
            >[]),
            wasm.call("$_log_int").args(),
            wasm.drop()
          )
      )
      .startFunc("$main")
      .build();
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): WasmInstruction {
    const expr = this.visit(stmt.expression);
    return expr;
  }

  visitGroupingExpr(expr: ExprNS.Grouping): WasmInstruction {
    return this.visit(expr.expression);
  }

  visitBinaryExpr(expr: ExprNS.Binary): WasmInstruction {
    const left = this.visit(expr.left) as WasmNumeric;
    const right = this.visit(expr.right) as WasmNumeric;

    const type = expr.operator.type;
    let opTag: number;
    if (type === TokenType.PLUS) opTag = ARITHMETIC_OP_TAG.ADD;
    else if (type === TokenType.MINUS) opTag = ARITHMETIC_OP_TAG.SUB;
    else if (type === TokenType.STAR) opTag = ARITHMETIC_OP_TAG.MUL;
    else if (type === TokenType.SLASH) opTag = ARITHMETIC_OP_TAG.DIV;
    else throw new Error(`Unsupported binary operator: ${type}`);

    return wasm.call(ARITHMETIC_OP_FX).args(left, right, i32.const(opTag));
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): WasmInstruction {
    return wasm.call(MAKE_INT_FX).args(i64.const(BigInt(expr.value)));
  }
}
