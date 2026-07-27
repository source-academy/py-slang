import {
  IndexError,
  ListIndexTypeError,
  ListMultiplyTypeError,
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import {
  generateCPythonTestCases,
  generateNativePynterTestCases,
  generatePvmlInBrowserTestCases,
  generateTestCases,
  TestCases,
} from "./utils";

describe("List Tests", () => {
  const listTests: TestCases = {
    "is_list and list_length": [
      ["is_list([])", true, null],
      ["is_list([1, 2, 3])", true, null],
      ["is_list(1)", false, null],
      ["is_list(None)", false, null],
      ["is_list('x')", false, null],
      ["list_length([])", 0n, null],
      ["list_length([1, 2, 3])", 3n, null],
      ["list_length([1, [2, 3], 4])", 3n, null],
      ["is_list()", MissingRequiredPositionalError, null],
      ["is_list(1, 2)", TooManyPositionalArgumentsError, null],
      ["list_length()", MissingRequiredPositionalError, null],
      ["list_length(1, 2)", TooManyPositionalArgumentsError, null],
      ["list_length(1)", TypeError, null],
    ],
    "structural == on lists": [
      ["[] == []", true, null],
      ["[1, 2, 3] == [1, 2, 3]", true, null],
      ["[1, [2, 3], 4] == [1, [2, 3], 4]", true, null],
      ["[1, 2] == [2, 1]", false, null],
      ["[1, 2, 3] == [1, 2]", false, null],
      ["[1, [2, 3]] == [1, [2, 4]]", false, null],
      ["xs = [10, 20, 30]\nys = [10, 20, 30]\nxs == ys", true, null],
      ["xs = [[0, 1], [1, 2], [2, 3]]\nys = [[0, 1], [1, 2], [2, 3]]\nxs == ys", true, null],
      ["xs = [0, 1, 2, 3]\nys = [1, 2, 3, 4]\nxs == ys", false, null],
    ],
    "array behavior with list helpers": [
      ["xs = [10, 20, 30]\nxs[1]", 20n, null],
      ["xs = [10, 20, 30]\nxs[1] = 99\nxs", [10n, 99n, 30n], null],
      ["xs = [1, 2, 3]\nlist_length(xs)", 3n, null],
      ["xs = [1, 2, 3]\nxs[0] = 100\nlist_length(xs)", 3n, null],
      ["xs = [1, 2, 3, 4]\nxs", [1n, 2n, 3n, 4n], null],
      ["xs = [1, 2, 3, 4]\nxs[2]", 3n, null],
      ["xs = [1, 2, 3, 4]\nxs[2] = 42\nxs", [1n, 2n, 42n, 4n], null],
    ],
    "list index range, negative wraparound, and bad-index errors": [
      ["xs = [10, 20, 30]\nxs[-1]", 30n, null],
      ["xs = [10, 20, 30]\nxs[-3]", 10n, null],
      ["xs = [10, 20, 30]\nxs[-1] = 99\nxs", [10n, 20n, 99n], null],
      ["xs = [10, 20, 30]\nxs[-3] = 99\nxs", [99n, 20n, 30n], null],
      ["[1, 2][2]", IndexError, null],
      ["[1, 2][-3]", IndexError, null],
      ["xs = [0, 0]\nxs[2] = 5", IndexError, null],
      ["xs = [0, 0]\nxs[-3] = 5", IndexError, null],
      ["[1, 2][0.0]", ListIndexTypeError, null],
      ["[1, 2][True]", ListIndexTypeError, null],
      ["xs = [1, 2]\nxs[0.0] = 5", ListIndexTypeError, null],
      ["xs = [1, 2]\nxs[True] = 5", ListIndexTypeError, null],
    ],
    "list multiplication (list * int / int * list)": [
      ["[1, 2] * 3", [1n, 2n, 1n, 2n, 1n, 2n], null],
      ["3 * [1, 2]", [1n, 2n, 1n, 2n, 1n, 2n], null],
      ["[1, 2] * 0", [], null],
      ["[1, 2] * -1", [], null],
      ["[1, 2] * True", ListMultiplyTypeError, null],
      ["True * [1, 2]", ListMultiplyTypeError, null],
      ["[1, 2] * 2.0", ListMultiplyTypeError, null],
      ["[1, 2] * [1, 2]", ListMultiplyTypeError, null],
      // Shallow copy: repeated elements are the same object, not deep clones.
      ["x = [[1, 2]] * 4\nx[0] is x[1]", true, null],
    ],
  };

  generateTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
  generateNativePynterTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
  generatePvmlInBrowserTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
  generateCPythonTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
});
