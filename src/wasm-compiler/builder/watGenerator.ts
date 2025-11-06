import {
  instrToMethodMap,
  WasmBlock,
  WasmBr,
  WasmBrTable,
  WasmCall,
  WasmData,
  WasmDrop,
  WasmExport,
  WasmExternType,
  WasmFunction,
  WasmGlobal,
  WasmGlobalGet,
  WasmGlobalSet,
  WasmIf,
  WasmImport,
  WasmInstruction,
  WasmLoadOp,
  WasmLocalGet,
  WasmLocalSet,
  WasmLocalTee,
  WasmLoop,
  WasmMemoryCopy,
  WasmModule,
  WasmNumericConst,
  WasmNumericType,
  WasmReturn,
  WasmStart,
  WasmStoreOp,
  WasmUnreachable,
  WatVisitor,
} from "./typed-builder";

export class WatGenerator implements WatVisitor {
  // Dispatch method
  visit(instruction: WasmInstruction): string {
    return this[instrToMethodMap[instruction.op]](instruction as any);
  }
  // Numeric visitor methods
  visitConstOp(instruction: WasmNumericConst<WasmNumericType>): string {
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
  visitStoreOp(instruction: WasmStoreOp): string {
    const address = this.visit(instruction.address);
    const value = this.visit(instruction.value);
    return `(${instruction.op} ${address} ${value})`;
  }
  visitLoadOp(instruction: WasmLoadOp): string {
    const address = this.visit(instruction.address);
    return `(${instruction.op} ${address})`;
  }
  visitMemoryCopyOp(instruction: WasmMemoryCopy): string {
    const dest = this.visit(instruction.destination);
    const src = this.visit(instruction.source);
    const size = this.visit(instruction.size);
    return `(${instruction.op} ${dest} ${src} ${size})`;
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
  visitBrOp(instruction: WasmBr): string {
    return `(${instruction.op} ${instruction.label})`;
  }
  visitBrTableOp(instruction: WasmBrTable): string {
    const labels = instruction.labels.join(" ");
    return `(${instruction.op} ${labels})`;
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
  private externTypeToString(externType: WasmExternType): string {
    let externTypeStr: string;

    if (externType.type === "func") {
      const params = externType.funcType.paramTypes
        .map((type) => `(param ${type})`)
        .join(" ");

      const results = externType.funcType.resultTypes
        .map((type) => `(result ${type})`)
        .join(" ");

      externTypeStr = `(func ${externType.name} ${params} ${results})`;
    } else if (externType.type === "memory") {
      const min = externType.limits.initial;
      const max = externType.limits.maximum ?? "";
      externTypeStr = `(memory ${min} ${max})`;
    } else {
      const _exhaustiveCheck: never = externType;
      throw new Error(`Unsupported import type: ${_exhaustiveCheck}`);
    }

    return externTypeStr;
  }
  visitImportOp(instruction: WasmImport): string {
    const externType = this.externTypeToString(instruction.externType);
    return `(${instruction.op} "${instruction.moduleName}" "${instruction.itemName}" ${externType})`;
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
    const externTypeStr = this.externTypeToString(instruction.externType);
    return `(${instruction.op} ${instruction.name} ${externTypeStr})`;
  }
  visitStartOp(instruction: WasmStart): string {
    return `(${instruction.op} ${instruction.functionName})`;
  }

  visitModuleOp(instruction: WasmModule): string {
    const imports = instruction.imports
      .map((imp) => this.visit(imp))
      .join("\n  ");

    const globals = instruction.globals
      .map((glob) => this.visit(glob))
      .join("\n  ");

    const datas = instruction.datas
      .map((data) => this.visit(data))
      .join("\n  ");

    const funcs = instruction.funcs
      .map((func) => this.visit(func))
      .join("\n  ");

    const startFunc = instruction.startFunc
      ? this.visit(instruction.startFunc)
      : "";

    return `(${instruction.op} ${imports} ${globals} ${datas} ${funcs} ${startFunc})`;
  }
}
