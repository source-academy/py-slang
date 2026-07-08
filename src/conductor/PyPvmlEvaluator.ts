import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { EvaluatorError } from "./errors";

export class PyPvmlEvaluator extends BasicEvaluator {
  evaluateChunk(chunk: string): Promise<void> {
    try {
      const script = chunk + "\n";
      const ast = parse(script);
      const { errors, environments } = analyzeWithEnvironments(ast, script, 4, [misc, math]);
      if (errors.length > 0) {
        throw errors[0];
      }
      const compiler = PVMLCompiler.fromProgram(ast, 4, environments);
      const program = compiler.compileProgram(ast);
      const interpreter = new PVMLInterpreter(program, {
        sendOutput: msg => this.conductor.sendOutput(msg),
      });
      const returnValue = interpreter.execute();
      this.conductor.sendResult(PVMLInterpreter.toJSValue(returnValue));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
    return Promise.resolve();
  }
}
