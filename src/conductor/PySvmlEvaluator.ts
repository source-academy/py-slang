import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { SVMLInterpreter } from "../engines/svml/svml-interpreter";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { annotateTree, type HintTable } from "../specialization/analysis-module";
import { MutableEnv, runAnalysisPass } from "../specialization/dfa-driver";
import { TypeAnalysisModule } from "../specialization/type-analysis";
import { EvaluatorError } from "./errors";

export class PySvmlEvaluator extends BasicEvaluator {
  evaluateChunk(chunk: string): Promise<void> {
    try {
      const script = chunk + "\n";
      const ast = parse(script);
      const { errors, environments } = analyzeWithEnvironments(ast, script, 4);
      if (errors.length > 0) {
        throw errors[0];
      }
      const compiler = SVMLCompiler.fromProgram(ast, environments);

      // Run forward type analysis before codegen to enable specialized opcode selection
      const hints: HintTable = new WeakMap();
      const typeEnv = new MutableEnv();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), typeEnv, hints, compiler.createSlotLookup());
      annotateTree(ast.statements, hints);

      const program = compiler.compileProgram(ast);
      const interpreter = new SVMLInterpreter(program);
      const returnValue = interpreter.execute();
      const stdout = interpreter.getStdout();
      if (stdout) {
        this.conductor.sendOutput(stdout);
      }
      this.conductor.sendResult(SVMLInterpreter.toJSValue(returnValue));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
    return Promise.resolve();
  }
}
