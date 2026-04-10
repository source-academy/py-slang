import { PySvmlSinterEvaluator } from "../conductor/PySvmlSinterEvaluator";
import { BufferingConductor } from "./BufferingConductor";

// Sinter requires WASM which cannot run in Node/Jest. Mock the init so the
// evaluator's error path is exercised rather than hanging on WASM instantiation.
jest.mock("../engines/svml/sinter/sinter", () => ({
  __esModule: true,
  default: jest.fn().mockRejectedValue(new Error("WASM not available in test environment")),
}));

function makeEvaluator() {
  const conductor = new BufferingConductor();
  const evaluator = new PySvmlSinterEvaluator(conductor);
  return { evaluator, conductor };
}

describe("PySvmlSinterEvaluator", () => {
  test("routes sinter init failure to sendError without crashing", async () => {
    const { evaluator, conductor } = makeEvaluator();
    await evaluator.evaluateChunk("1 + 2");
    expect(conductor.getError()).toBeDefined();
    expect(conductor.getResult()).toBeUndefined();
  });

  test("does not implement TypeAnnotating", () => {
    const { evaluator } = makeEvaluator();
    expect("collectTypeInfo" in evaluator).toBe(false);
  });
});
