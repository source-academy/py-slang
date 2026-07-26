import { MissingRequiredPositionalError } from "../errors";
import dataVisualizer from "../stdlib/dataVisualizer";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { generateTestCases, TestCases } from "./utils";

describe("Data Visualizer Tests", () => {
  const dataVisualizerTests: TestCases = {
    "arity and return value": [
      ["draw_data()", MissingRequiredPositionalError, null],
      ["draw_data(1)", MissingRequiredPositionalError, null],
      // context.dataVisualizer is unset outside a real Conductor run (no plugin registered in
      // this harness) — draw_data still validates arity and returns None without crashing.
      ["draw_data(1, 2)", null, null],
      ["draw_data(1, 2, 3)", null, null],
    ],
  };

  generateTestCases(dataVisualizerTests, 2, [misc, math, linkedList, dataVisualizer]);
});
