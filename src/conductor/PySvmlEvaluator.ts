import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { SVMLInterpreter } from "../engines/svml/svml-interpreter";
import { toEvaluatorError } from "./errors";

export class PySvmlEvaluator extends BasicEvaluator {
  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const script = chunk + "\n";
      const ast = parse(script);
      const errors = analyze(ast, script, 4);
      if (errors.length > 0) {
        throw errors[0];
      }
      const compiler = SVMLCompiler.fromProgram(ast);
      const program = compiler.compileProgram(ast);
      const interpreter = new SVMLInterpreter(program);
      const returnValue = interpreter.execute();
      const stdout = interpreter.getStdout();
      if (stdout) {
        this.conductor.sendOutput(stdout);
      }
      this.conductor.sendOutput(String(SVMLInterpreter.toJSValue(returnValue)));
    } catch (e) {
      this.conductor.sendError(toEvaluatorError(e) as any);
    }
  }
}
