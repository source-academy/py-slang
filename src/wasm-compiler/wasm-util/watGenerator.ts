import { instrToMethodMap, type WatVisitor } from "./builder.js";
import type {
  WasmBlock,
  WasmBr,
  WasmBrTable,
  WasmCall,
  WasmConst,
  WasmData,
  WasmDrop,
  WasmExport,
  WasmFunction,
  WasmGlobal,
  WasmGlobalGet,
  WasmGlobalSet,
  WasmIf,
  WasmImport,
  WasmInstruction,
  WasmLoad,
  WasmLocalGet,
  WasmLocalSet,
  WasmLocalTee,
  WasmLoop,
  WasmMemoryCopy,
  WasmMemoryFill,
  WasmModule,
  WasmNop,
  WasmNumericType,
  WasmReturn,
  WasmSelect,
  WasmStart,
  WasmStore,
  WasmUnreachable,
} from "./types.js";

export class WatGenerator implements WatVisitor {
  // Dispatch method
  visit(instruction: WasmInstruction): string {
    return this[instrToMethodMap[instruction.op]](instruction as any);
  }
  // Numeric visitor methods
  visitConstOp(instruction: WasmConst<WasmNumericType>): string {
    return `(${instruction.op} ${instruction.value})`;
  }
  visitUnaryOp(instruction: { op: string; right: WasmInstruction }): string {
    const right = this.visit(instruction.right);
    return `(${instruction.op} ${right})`;
  }
  visitBinaryOp(instruction: {
    op: string;
    left: WasmInstruction;
    right: WasmInstruction;
  }): string {
    const left = this.visit(instruction.left);
    const right = this.visit(instruction.right);
    return `(${instruction.op} ${left} ${right})`;
  }

  // Memory visitor methods
  visitStoreOp(instruction: WasmStore): string {
    const address = this.visit(instruction.address);
    const value = this.visit(instruction.value);
    return `(${instruction.op} ${address} ${value})`;
  }
  visitLoadOp(instruction: WasmLoad): string {
    const address = this.visit(instruction.address);
    return `(${instruction.op} ${address})`;
  }
  visitMemoryCopyOp(instruction: WasmMemoryCopy): string {
    const dest = this.visit(instruction.destination);
    const src = this.visit(instruction.source);
    const size = this.visit(instruction.size);
    return `(${instruction.op} ${dest} ${src} ${size})`;
  }
  visitMemoryFillOp(instruction: WasmMemoryFill): string {
    const addr = this.visit(instruction.address);
    const value = this.visit(instruction.value);
    const size = this.visit(instruction.numOfBytes);
    return `(${instruction.op} ${addr} ${value} ${size})`;
  }

  // Control visitor methods
  visitBlockOp(instruction: WasmBlock): string {
    const label = instruction.label ?? "";
    const body = instruction.body.map((instr) => this.visit(instr)).join(" ");
    return `(${instruction.op} ${label} ${body})`;
  }
  visitLoopOp(instruction: WasmLoop): string {
    const label = instruction.label ?? "";
    const body = instruction.body.map((instr) => this.visit(instr)).join(" ");
    return `(${instruction.op} ${label} ${body})`;
  }
  visitIfOp(instruction: WasmIf): string {
    const label = instruction.label ?? "";
    const condition = this.visit(instruction.predicate);
    const thenBody = instruction.thenBody
      .map((instr) => this.visit(instr))
      .join(" ");
    const elseBody = instruction.elseBody
      ?.map((instr) => this.visit(instr))
      .join(" ");

    if (elseBody) {
      return `(if ${label} ${condition} (then ${thenBody}) (else ${elseBody}))`;
    } else {
      return `(if ${label} ${condition} (then ${thenBody}))`;
    }
  }
  visitUnreachableOp(instruction: WasmUnreachable): string {
    return `(${instruction.op})`;
  }
  visitDropOp(instruction: WasmDrop): string {
    const value = instruction.value ? this.visit(instruction.value) : "";
    return `(${instruction.op} ${value})`;
  }
  visitNopOp(instruction: WasmNop): string {
    return `(${instruction.op})`;
  }
  visitBrOp(instruction: WasmBr): string {
    return `(${instruction.op} ${instruction.label})`;
  }
  visitBrTableOp(instruction: WasmBrTable): string {
    const value = this.visit(instruction.value);
    const labels = instruction.labels.join(" ");
    return `(${instruction.op} ${labels} ${value})`;
  }
  visitCallOp(instruction: WasmCall): string {
    const args = instruction.arguments.map((arg) => this.visit(arg)).join(" ");
    return `(${instruction.op} ${instruction.function} ${args})`;
  }
  visitReturnOp(instruction: WasmReturn): string {
    const values = instruction.values
      .map((value) => this.visit(value))
      .join(" ");
    return `(${instruction.op} ${values})`;
  }
  visitSelectOp(instruction: WasmSelect): string {
    const first = this.visit(instruction.first);
    const second = this.visit(instruction.second);
    const condition = this.visit(instruction.condition);
    return `(${instruction.op} ${first} ${second} ${condition})`;
  }

  // Variable visitor methods
  visitVariableGetOp(instruction: WasmLocalGet | WasmGlobalGet): string {
    return `(${instruction.op} ${instruction.label})`;
  }
  visitVariableSetOp(
    instruction: WasmLocalSet | WasmLocalTee | WasmGlobalSet
  ): string {
    const right = this.visit(instruction.right);
    return `(${instruction.op} ${instruction.label} ${right})`;
  }

  // Module visitor methods
  visitImportOp(instruction: WasmImport): string {
    let externTypeStr: string;

    if (instruction.externType.type === "func") {
      const params = instruction.externType.funcType.paramTypes
        .map((type) => `(param ${type})`)
        .join(" ");

      const results = instruction.externType.funcType.resultTypes
        .map((type) => `(result ${type})`)
        .join(" ");

      externTypeStr = `(func ${instruction.externType.name} ${params} ${results})`;
    } else if (instruction.externType.type === "memory") {
      const min = instruction.externType.limits.initial;
      const max = instruction.externType.limits.maximum ?? "";
      externTypeStr = `(memory ${min} ${max})`;
    } else {
      const _exhaustiveCheck: never = instruction.externType;
      throw new Error(`Unsupported import type: ${_exhaustiveCheck}`);
    }

    return `(${instruction.op} "${instruction.moduleName}" "${instruction.itemName}" ${externTypeStr})`;
  }
  visitGlobalOp(instruction: WasmGlobal): string {
    const init = this.visit(instruction.initialValue);
    return `(${instruction.op} ${instruction.name} (${instruction.valueType}) ${init})`;
  }
  visitDataOp(instruction: WasmData): string {
    const offset = this.visit(instruction.offset);
    return `(${instruction.op} ${offset} "${instruction.data}")`;
  }
  visitFuncOp(instruction: WasmFunction): string {
    const params = Object.entries(instruction.funcType.paramTypes)
      .map(([name, type]) => `(param ${name} ${type})`)
      .join(" ");

    const results = `(result ${instruction.funcType.resultTypes.join(" ")})`;

    const locals = Object.entries(instruction.funcType.localTypes)
      .map(([name, type]) => `(local ${name} ${type})`)
      .join(" ");

    const body = instruction.body.map((instr) => this.visit(instr)).join(" ");

    return `(${instruction.op} ${instruction.name} ${params} ${results} ${locals} ${body})`;
  }
  visitExportOp(instruction: WasmExport): string {
    let externTypeStr: string;

    if (instruction.externType.type === "func") {
      externTypeStr = `(func ${instruction.externType.identifier})`;
    } else if (instruction.externType.type === "memory") {
      externTypeStr = `(memory ${instruction.externType.index})`;
    } else {
      const _exhaustiveCheck: never = instruction.externType;
      throw new Error(`Unsupported export type: ${_exhaustiveCheck}`);
    }
    return `(${instruction.op} "${instruction.name}" ${externTypeStr})`;
  }
  visitStartOp(instruction: WasmStart): string {
    return `(${instruction.op} ${instruction.functionName})`;
  }

  visitModuleOp(instruction: WasmModule): string {
    const imports = instruction.imports
      .map((i) => ` ${this.visit(i)}\n`)
      .join("");

    const globals = instruction.globals
      .map((g) => ` ${this.visit(g)}\n`)
      .join("");

    const datas = instruction.datas.map((d) => ` ${this.visit(d)}\n`).join("");

    const funcs = instruction.funcs.map((f) => ` ${this.visit(f)}\n`).join("");

    const startFunc = instruction.startFunc
      ? this.visit(instruction.startFunc)
      : "";

    const exports = instruction.exports
      .map((e) => ` ${this.visit(e)}\n`)
      .join("");

    return `(${instruction.op}\n${imports}\n${globals}\n${datas}\n${funcs}\n${startFunc}\n${exports})`;
  }
}
