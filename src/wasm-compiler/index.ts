import wabt from "wabt";
import { Parser } from "../parser";
import { Tokenizer } from "../tokenizer";
import { Generator } from "./generator";

(async () => {
  // const code = "(12 + 42.5j) / -(42 + 1.5j)";
  const code = `def x():
    pass`;

  const script = code + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();

  const generator = new Generator();
  console.dir(ast, { depth: null });
  const wat = generator.visit(ast);

  console.log(wat);

  const w = await wabt();
  const wasm: Uint8Array = w.parseWat("a", wat).toBinary({}).buffer;

  const memory = new WebAssembly.Memory({ initial: 1 });

  await WebAssembly.instantiate(wasm, {
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
    },
    js: { memory },
  });
  console.log(eval(code));
})();
