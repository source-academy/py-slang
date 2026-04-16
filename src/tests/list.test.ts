import {
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
  UserError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { generateTestCases, TestCases } from "./utils";

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
    "equal on lists": [
      ["equal([], [])", true, null],
      ["equal([1, 2, 3], [1, 2, 3])", true, null],
      ["equal([1, [2, 3], 4], [1, [2, 3], 4])", true, null],
      ["equal([1, 2], [2, 1])", false, null],
      ["equal([1, 2, 3], [1, 2])", false, null],
      ["equal([1, [2, 3]], [1, [2, 4]])", false, null],
      ["xs = [10, 20, 30]\nys = [10, 20, 30]\nequal(xs, ys)", true, null],
      [
        "xs = build_list(lambda i: [i, i + 1], 3)\nys = build_list(lambda i: [i, i + 1], 3)\nequal(xs, ys)",
        true,
        null,
      ],
      [
        "xs = build_list(lambda i: i, 4)\nys = build_list(lambda i: i + 1, 4)\nequal(xs, ys)",
        false,
        null,
      ],
    ],
    build_list: [
      ["build_list(lambda i: i, 0)", [], null],
      ["build_list(lambda i: i, 5)", [0n, 1n, 2n, 3n, 4n], null],
      ["build_list(lambda i: i * i, 5)", [0n, 1n, 4n, 9n, 16n], null],
      ["build_list(lambda i: i % 2 == 0, 4)", [true, false, true, false], null],
      ["build_list(lambda i: str(i), 3)", ["0", "1", "2"], null],
      [
        "build_list(lambda i: [i, i + 1], 3)",
        [
          [0n, 1n],
          [1n, 2n],
          [2n, 3n],
        ],
        null,
      ],
      ["build_list(lambda i: i, -1)", UserError, null],
    ],
    "array behavior with list helpers": [
      ["xs = [10, 20, 30]\nxs[1]", 20n, null],
      ["xs = [10, 20, 30]\nxs[1] = 99\nxs", [10n, 99n, 30n], null],
      ["xs = [1, 2, 3]\nlist_length(xs)", 3n, null],
      ["xs = [1, 2, 3]\nxs[0] = 100\nlist_length(xs)", 3n, null],
      ["xs = build_list(lambda i: i + 1, 4)\nxs", [1n, 2n, 3n, 4n], null],
      ["xs = build_list(lambda i: i + 1, 4)\nxs[2]", 3n, null],
      ["xs = build_list(lambda i: i + 1, 4)\nxs[2] = 42\nxs", [1n, 2n, 42n, 4n], null],
    ],
  };

  generateTestCases(listTests, 3, [linkedList, pairmutator, stream, list]);
});
