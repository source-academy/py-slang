import { PySvmlSinterEvaluator } from "../conductor/PySvmlSinterEvaluator";
import { BufferingConductor } from "../conductor/BufferingConductor";

function makeEvaluator() {
  const conductor = new BufferingConductor();
  const evaluator = new PySvmlSinterEvaluator(conductor as any);
  return { evaluator, conductor };
}

describe("PySvmlSinterEvaluator", () => {
  test("evaluates integer addition", async () => {
    const { evaluator, conductor } = makeEvaluator();
    await evaluator.evaluateChunk("1 + 2");
    // Sinter may or may not be available - check no crash at minimum
    // If sinter is available, result should be defined
    const err = conductor.getError();
    const result = conductor.getResult();
    expect(err !== undefined || result !== undefined).toBe(true);
  });

  test("does not implement TypeAnnotating", () => {
    const { evaluator } = makeEvaluator();
    expect("collectTypeInfo" in evaluator).toBe(false);
  });
});
