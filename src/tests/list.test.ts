import { MissingRequiredPositionalError, TooManyPositionalArgumentsError } from "../errors";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import {
  generateCPythonTestCases,
  generateNativePynterTestCases,
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
  };

  generateTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
  generateNativePynterTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
  generateCPythonTestCases(listTests, 3, [misc, math, linkedList, pairmutator, stream, list]);
});
