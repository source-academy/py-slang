import wabt from "wabt";
import { WatGenerator } from "wasm-util";
import { Parser } from "../parser";
import { Tokenizer } from "../tokenizer";
import { BuilderGenerator } from "./builderGenerator";
import { ERROR_MAP } from "./constants";

export async function compileToWasmAndRun(code: string) {
  const script = code + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();

  const builderGenerator = new BuilderGenerator();
  const watIR = builderGenerator.visit(ast);

  const watGenerator = new WatGenerator();
  const wat = watGenerator.visit(watIR);

  const w = await wabt();
  const wasm: Uint8Array = w.parseWat("a", wat).toBinary({}).buffer;

  const memory = new WebAssembly.Memory({ initial: 1 });

  const result = await WebAssembly.instantiate(wasm, {
    console: {
      log: console.log,
      log_complex: (real: number, imag: number) =>
        console.log(`${real} ${imag >= 0 ? "+" : "-"} ${Math.abs(imag)}j`),
      log_bool: (value: bigint) =>
        console.log(value === BigInt(0) ? "False" : "True"),
      log_string: (offset: number, length: number) =>
        console.log(
          new TextDecoder("utf8").decode(
            new Uint8Array(memory.buffer, offset, length)
          )
        ),
      log_closure: (
        tag: number,
        arity: number,
        envSize: number,
        parentEnv: number
      ) =>
        console.log(
          `Closure (tag: ${tag}, arity: ${arity}, envSize: ${envSize}, parentEnv: ${parentEnv})`
        ),
      log_none: () => console.log("None"),
      log_error: (tag: number) =>
        console.error(Object.values(ERROR_MAP).find(([i]) => i === tag)?.[1]),
      log_pair: () => console.log(),
    },
    js: { memory },
  });

  // run the exported main function
  return (result as any).instance.exports.main() as [number, number];
}

(async () => {
  const code = `
(2 + 3j) / (3 + 2j)
`;
  await compileToWasmAndRun(code);
})();
