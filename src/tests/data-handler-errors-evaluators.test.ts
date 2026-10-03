import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import {
  EvaluatorEngine,
  makeEvaluatorTestHarness,
  resetEvaluatorTestModules,
} from "./evaluatorTestHarness";

afterEach(resetEvaluatorTestModules);

describe.each<EvaluatorEngine>(["pycse", "py2js"])(
  "GenericDataHandler errors through the %s evaluator",
  engine => {
    test("reports a module argument type error with a readable Python error name and message", async () => {
      const harness = makeEvaluatorTestHarness(engine);
      const onlyNumber = await harness.dataHandler.closure_make(
        { args: [DataType.NUMBER], returnType: DataType.NUMBER },
        async function* (
          value: TypedValue<DataType.NUMBER>,
        ): AsyncGenerator<void, TypedValue<DataType.NUMBER>, undefined> {
          await Promise.resolve();
          return value;
        },
      );
      harness.installModule("validation", [{ symbol: "only_number", value: onlyNumber }]);

      await harness.evaluate('from validation import only_number\nonly_number("not a number")\n');

      expect(harness.errors).toHaveLength(1);
      expect(harness.errors[0].name).toBe("TypeError");
      expect(harness.errors[0].message).toContain(
        "Expected argument 0 to have type 'int' or 'float', got 'str'",
      );
      expect(harness.errors[0].message).toContain("TypeError at line 2");
      expect(harness.errors[0].message).toContain('only_number("not a number")');
      expect(harness.errors[0].message).not.toContain("[object Object]");
    });

    test("attributes a module error to the outer call after evaluating a nested call", async () => {
      const harness = makeEvaluatorTestHarness(engine);
      const identity = await harness.dataHandler.closure_make(
        { args: [DataType.ANY], returnType: DataType.ANY },
        async function* (
          value: TypedValue<DataType>,
        ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
          await Promise.resolve();
          return value;
        },
      );
      const onlyNumber = await harness.dataHandler.closure_make(
        { args: [DataType.NUMBER], returnType: DataType.NUMBER },
        async function* (
          value: TypedValue<DataType.NUMBER>,
        ): AsyncGenerator<void, TypedValue<DataType.NUMBER>, undefined> {
          await Promise.resolve();
          return value;
        },
      );
      harness.installModule("validation", [
        { symbol: "identity", value: identity },
        { symbol: "only_number", value: onlyNumber },
      ]);

      await harness.evaluate(
        'from validation import identity, only_number\nonly_number(identity("not a number"))\n',
      );

      expect(harness.errors).toHaveLength(1);
      expect(harness.errors[0].message).toContain("TypeError at line 2");
      expect(harness.errors[0].message).toContain('only_number(identity("not a number"))');
    });

    test("reports data-interface bounds errors instead of a raw JavaScript exception", async () => {
      const harness = makeEvaluatorTestHarness(engine);
      const dataHandler = harness.dataHandler;
      const outOfBounds = await dataHandler.closure_make(
        { args: [], returnType: DataType.VOID },
        async function* (): AsyncGenerator<void, TypedValue<DataType.VOID>, undefined> {
          const array = await dataHandler.array_make(DataType.NUMBER, 1, {
            type: DataType.NUMBER,
            value: 0,
          });
          await dataHandler.array_get(array, 3);
          return { type: DataType.VOID, value: undefined };
        },
      );
      harness.installModule("validation", [{ symbol: "out_of_bounds", value: outOfBounds }]);

      await harness.evaluate("from validation import out_of_bounds\nout_of_bounds()\n");

      expect(harness.errors).toHaveLength(1);
      expect(harness.errors[0]).toMatchObject({ name: "IndexError" });
      expect(harness.errors[0].message).toContain(
        "list index out of range. You tried to access index 3 but the list only has 1 elements.",
      );
      expect(harness.errors[0].message).not.toContain("Cannot read properties of undefined");
    });
  },
);
