import {
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
  TypeError,
  UnsupportedOperandTypeError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import { generateTestCases, TestCases } from "./utils";

describe("Linked List Tests", () => {
  const linkedListTests: TestCases = {
    "constructor and selector": [
      ["head(pair(1, 2))", 1n, null],
      ["head()", MissingRequiredPositionalError, null],
      ["pair()", MissingRequiredPositionalError, null],
      ["tail()", MissingRequiredPositionalError, null],
      ["tail(1, 2)", TooManyPositionalArgumentsError, null],
      ["head(None)", TypeError, null],
      ["tail(None)", TypeError, null],
      ["tail(pair(1, 2))", 2n, null],
      ["linked_list()", null, null],
      ["head(1)", TypeError, null],
      ["tail(1)", TypeError, null],
      ["print_linked_list()", MissingRequiredPositionalError, null],
      ["print_linked_list(linked_list(1, 2, 3))", null, "linked_list(1, 2, 3)\n"],
      ["print_linked_list(pair(1, 2))", null, "[1, 2]\n"],
      ["print_linked_list(None)", null, "linked_list()\n"],
      ["print_linked_list(pair(1, pair(2, 3)))", null, "[1, [2, 3]]\n"],
      ["print_linked_list(pair(1, pair(2, None)))", null, "linked_list(1, 2)\n"],
      [
        "print_linked_list(pair(linked_list(1, 2, 3), linked_list(4, 5, 6)))",
        null,
        "linked_list(linked_list(1, 2, 3), 4, 5, 6)\n",
      ],
    ],
    "empty list boundaries": [
      ["equal(append(None, None), None)", true, null],
      ["length(linked_list())", 0n, null],
      ["equal(linked_list(), None)", true, null],
      ["equal(remove(1, None), None)", true, null],
      ["equal(remove_all(1, None), None)", true, null],
      ["equal(build_linked_list(lambda x: x, -1), None)", true, null],
      ["equal(enum_linked_list(0, 0), linked_list(0))", true, null],
    ],
    "error throwing limits": [
      ["linked_list_ref(linked_list(10, 20), 2)", TypeError, null],
      ["linked_list_ref(linked_list(10, 20), -1)", TypeError, null],
      ["length(pair(1, 2))", TypeError, null],
      ["map_linked_list(lambda x: x, pair(1, 2))", TypeError, null],
      ["equal(append(linked_list(1), 2), pair(1, 2))", true, null],
    ],
    "extreme removal and filtering": [
      ["equal(remove_all(1, linked_list(1, 1, 1, 1)), None)", true, null],
      ["equal(remove(1, linked_list(1, 1, 1)), linked_list(1, 1))", true, null],
      ["equal(filter_linked_list(lambda x: False, linked_list(1, 2, 3)), None)", true, null],
      [
        "equal(filter_linked_list(lambda x: True, linked_list(1, 2, 3)), linked_list(1, 2, 3))",
        true,
        null,
      ],
    ],
    "equality strictness": [
      ["equal(linked_list(1, 2), 1)", false, null], // List vs Int
      ["equal(None, False)", false, null], // None vs Boolean
      ["equal(pair(1, 2), pair(1, 2))", true, null], // Pair vs Pair (same)
      ["equal(pair(1, 2), pair(1, 3))", false, null], // Pair vs Pair (diff tail)
      ["equal(pair(1, 2), pair(2, 2))", false, null], // Pair vs Pair (diff head)
      ["equal(linked_list(1, 2, 3), pair(1, pair(2, pair(3, None))))", true, null], // List vs manually constructed Pair chain
    ],
    "validation checks": [
      ["is_pair(pair(1, 2))", true, null],
      ["is_pair(pair(1, pair(2, pair(3, 4))))", true, null],
      ["is_pair(pair(1, pair(2, 4)))", true, null],
      ["is_pair(linked_list(1, 2))", true, null],
      ["is_pair(linked_list(pair(1, 3), 2))", true, null],
      ["is_pair(pair(linked_list(1, 2, 3), linked_list(4, 5, 6)))", true, null],
      ["is_pair(linked_list(pair(1, 2), pair(3, 4), pair(5, 6)))", true, null],
      ["is_pair(linked_list(linked_list(linked_list(1, 2), 3, 4), 5, 6))", true, null],
      ["is_pair(1)", false, null],
      ["is_pair(None)", false, null],
      ["is_pair()", MissingRequiredPositionalError, null],
      ["is_pair(1, 2)", TooManyPositionalArgumentsError, null],
      ['is_pair("pair")', false, null],
      ["is_pair(lambda x: x)", false, null],
      ["is_linked_list(pair(1, 2))", false, null],
      ["is_linked_list(pair(1, None))", true, null],
      ["is_linked_list(pair(1, pair(2, None)))", true, null],
      ["is_linked_list(linked_list(1, 2, 3))", true, null],
      ["is_linked_list(pair(linked_list(1, 2, 3), linked_list(4, 5, 6)))", true, null],
      ["is_linked_list(pair(linked_list(1, 2, 3), pair(4, 5)))", false, null],
      ["is_linked_list(linked_list(pair(1, 2), pair(3, 4), pair(5, 6)))", true, null],
      ["is_linked_list(linked_list(linked_list(linked_list(1, 2), 3, 4), 5, 6))", true, null],
      ["is_linked_list(1)", false, null],
      ["is_linked_list(None)", true, null],
      ['is_linked_list("linked_list")', false, null],
      ["is_linked_list(lambda x: x)", false, null],
      ["is_linked_list()", MissingRequiredPositionalError, null],
      ["is_linked_list(1, 2)", TooManyPositionalArgumentsError, null],
      ["equal(linked_list(1, 2), linked_list(1, 2))", true, null],
      ["equal(linked_list(1, 2), linked_list(2, 1))", false, null],
      ["equal(linked_list(1, linked_list(2, 3)), linked_list(1, linked_list(2, 3)))", true, null],
      ["equal(linked_list(1, linked_list(2, 3)), linked_list(1, linked_list(3, 2)))", false, null],
      ["equal(linked_list(1, 2), pair(2, pair(1, None)))", false, null],
      ["equal(linked_list(1, 2), pair(1, pair(2, None)))", true, null],
    ],
    "structural operations": [
      ["length(linked_list(1, 2, 3, 4))", 4n, null],
      ["length(None)", 0n, null],
      ["linked_list_to_string(linked_list(1, 2))", "[1, [2, None]]", null],
      ["linked_list_to_string(None)", "None", null],
    ],
    transformations: [
      [
        "equal(map_linked_list(lambda x: x + 1, linked_list(1, 2, 3)), linked_list(2, 3, 4))",
        true,
        null,
      ],
      ["equal(map_linked_list(lambda x: x + 1, None), None)", true, null],
      ["equal(build_linked_list(lambda i: i * i, 4), linked_list(0, 1, 4, 9))", true, null],
      ["equal(build_linked_list(lambda i: i, 0), None)", true, null],
      ["equal(reverse(linked_list(1, 2, 3)), linked_list(3, 2, 1))", true, null],
      ["equal(reverse(None), None)", true, null],
      ["equal(append(linked_list(1, 2), linked_list(3, 4)), linked_list(1, 2, 3, 4))", true, null],
      ["equal(append(None, linked_list(3, 4)), linked_list(3, 4))", true, null],
      ["equal(append(linked_list(1, 2), None), linked_list(1, 2))", true, null],
      [
        "equal(filter_linked_list(lambda x: x % 2 == 0, linked_list(1, 2, 3, 4)), linked_list(2, 4))",
        true,
        null,
      ],
      ["equal(filter_linked_list(lambda x: x > 10, linked_list(1, 2, 3, 4)), None)", true, null],
      ["equal(enum_linked_list(3, 6), linked_list(3, 4, 5, 6))", true, null],
      ["equal(enum_linked_list(6, 3), None)", true, null],
    ],
    "search and removal": [
      ["equal(member(1, linked_list(1, 2, 3, 4)), linked_list(1, 2, 3, 4))", true, null],
      ["equal(linked_list(1, 2, 3), pair(1, pair(2, pair(3, None))))", true, null],
      ["equal(member(3, linked_list(1, 2, 3, 4)), linked_list(3, 4))", true, null],
      ["equal(member(9, linked_list(1, 2, 3, 4)), None)", true, null],
      ["equal(remove(9, linked_list(1, 2, 3, 2)), linked_list(1, 2, 3, 2))", true, null],
      ["equal(remove(2, linked_list(1, 2, 3, 2)), linked_list(1, 3, 2))", true, null],
      ["equal(remove_all(9, linked_list(1, 2, 3, 2)), linked_list(1, 2, 3, 2))", true, null],
      ["equal(remove_all(2, linked_list(1, 2, 3, 2)), linked_list(1, 3))", true, null],
    ],
    "indexing and reducing": [
      ["linked_list_ref(linked_list(10, 20, 30), 0)", 10n, null],
      ["linked_list_ref(linked_list(10, 20, 30), 1)", 20n, null],
      ["accumulate_linked_list(lambda x, y: x + y, 10, None)", 10n, null],
      ["accumulate_linked_list(lambda x, y: x + y, 0, linked_list(1, 2, 3, 4))", 10n, null],
      ["for_each(lambda x: x, None)", true, ""],
      ["for_each(print, linked_list(1, 2, 3))", true, "1\n2\n3\n"],
    ],
  };

  generateTestCases(linkedListTests, 2, [linkedList]);
});
