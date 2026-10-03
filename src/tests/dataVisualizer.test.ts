import { MissingRequiredPositionalError } from "../errors";
import dataVisualizer from "../stdlib/dataVisualizer";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import {
  generateNativePynterTestCases,
  generatePvmlInBrowserTestCases,
  generateTestCases,
  TestCases,
} from "./utils";

describe("Data Visualizer Tests", () => {
  const dataVisualizerTests: TestCases = {
    "arity and return value": [
      ["draw_data()", MissingRequiredPositionalError, null],
      // context.dataVisualizer is unset outside a real Conductor run (no plugin registered in
      // this harness) — draw_data still validates arity, draws nothing and returns its first
      // argument without crashing.
      ["draw_data(1)", 1n, null],
      ["draw_data(1, 2)", 1n, null],
      ["draw_data(1, 2, 3)", 1n, null],
      ["draw_data(None)", null, null],
    ],
  };

  generateTestCases(dataVisualizerTests, 2, [misc, math, linkedList, dataVisualizer]);
  generateNativePynterTestCases(dataVisualizerTests, 3);
  generatePvmlInBrowserTestCases(dataVisualizerTests, 3);

  // breakpoint(), set_timeout() and clear_all_timeout() are deliberate no-ops in PVML and native
  // Pynter (neither has a debugger or an event loop); the CSE machine reports set_timeout as
  // unsupported, so these don't share the table above.
  const noopTests: TestCases = {
    "no-op functions": [
      ["breakpoint()\n1", 1n, null],
      ["set_timeout(lambda: 2, 10)\n1", 1n, null],
      ["clear_all_timeout()\n1", 1n, null],
      ["set_timeout(lambda: print(2), 10)\nprint(1)", null, ["1"]],
    ],
    // They still check their arity (set_timeout takes exactly 2 arguments, clear_all_timeout none),
    // like the CSE machine and py2js do.
    "no-op functions check their arity": [
      ["set_timeout()", MissingRequiredPositionalError, null],
      ["set_timeout(lambda: 1)", MissingRequiredPositionalError, null],
      ["set_timeout(lambda: 1, 10, 20)", MissingRequiredPositionalError, null],
      ["clear_all_timeout(1)", MissingRequiredPositionalError, null],
    ],
  };
  generatePvmlInBrowserTestCases(noopTests, 3);
  generateNativePynterTestCases(noopTests, 3);
});
