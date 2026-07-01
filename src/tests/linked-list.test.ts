import {
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
  TypeError,
  UserError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
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
      ["llist()", null, null],
      ["head(1)", TypeError, null],
      ["tail(1)", TypeError, null],
      ["print_linked_list()", MissingRequiredPositionalError, null],
      ["print_linked_list(llist(1, 2, 3))", null, ["llist(1, 2, 3)"]],
      ["print_linked_list(pair(1, 2))", null, ["[1, 2]"]],
      ["print_linked_list(None)", null, ["llist()"]],
      ["print_linked_list(pair(1, pair(2, 3)))", null, ["[1, [2, 3]]"]],
      ["print_linked_list(pair(1, pair(2, None)))", null, ["llist(1, 2)"]],
      [
        "print_linked_list(pair(llist(1, 2, 3), llist(4, 5, 6)))",
        null,
        ["llist(llist(1, 2, 3), 4, 5, 6)"],
      ],
      ["print_linked_list(llist('a', 'b'))", null, ["llist('a', 'b')"]],
    ],
    "empty list boundaries": [
      ["equal(append_linked_list(None, None), None)", true, null],
      ["length_linked_list(llist())", 0n, null],
      ["equal(llist(), None)", true, null],
      ["equal(remove_linked_list(1, None), None)", true, null],
      ["equal(remove_all_linked_list(1, None), None)", true, null],
      ["equal(build_linked_list(lambda x: x, -1), None)", true, null],
      ["equal(enum_linked_list(0, 0), llist(0))", true, null],
    ],
    "error throwing limits": [
      ["ref_linked_list(llist(10, 20), 2)", UserError, null],
      ["ref_linked_list(llist(10, 20), -1)", UserError, null],
      ["length_linked_list(pair(1, 2))", TypeError, null],
      ["map_linked_list(lambda x: x, pair(1, 2))", TypeError, null],
      ["equal(append_linked_list(llist(1), 2), pair(1, 2))", true, null],
    ],
    "extreme removal and filtering": [
      ["equal(remove_all_linked_list(1, llist(1, 1, 1, 1)), None)", true, null],
      ["equal(remove_linked_list(1, llist(1, 1, 1)), llist(1, 1))", true, null],
      ["equal(filter_linked_list(lambda x: False, llist(1, 2, 3)), None)", true, null],
      ["equal(filter_linked_list(lambda x: True, llist(1, 2, 3)), llist(1, 2, 3))", true, null],
    ],
    "equality strictness": [
      ["equal(llist(1, 2), 1)", false, null], // List vs Int
      ["equal(None, False)", false, null], // None vs Boolean
      ["equal(pair(1, 2), pair(1, 2))", true, null], // Pair vs Pair (same)
      ["equal(pair(1, 2), pair(1, 3))", false, null], // Pair vs Pair (diff tail)
      ["equal(pair(1, 2), pair(2, 2))", false, null], // Pair vs Pair (diff head)
      ["equal(llist(1, 2, 3), pair(1, pair(2, pair(3, None))))", true, null], // List vs manually constructed Pair chain
    ],
    "validation checks": [
      ["is_pair(pair(1, 2))", true, null],
      ["is_pair(pair(1, pair(2, pair(3, 4))))", true, null],
      ["is_pair(pair(1, pair(2, 4)))", true, null],
      ["is_pair(llist(1, 2))", true, null],
      ["is_pair(llist(pair(1, 3), 2))", true, null],
      ["is_pair(pair(llist(1, 2, 3), llist(4, 5, 6)))", true, null],
      ["is_pair(llist(pair(1, 2), pair(3, 4), pair(5, 6)))", true, null],
      ["is_pair(llist(llist(llist(1, 2), 3, 4), 5, 6))", true, null],
      ["is_pair(1)", false, null],
      ["is_pair(None)", false, null],
      ["is_pair()", MissingRequiredPositionalError, null],
      ["is_pair(1, 2)", TooManyPositionalArgumentsError, null],
      ['is_pair("pair")', false, null],
      ["is_pair(lambda x: x)", false, null],
      ["is_linked_list(pair(1, 2))", false, null],
      ["is_linked_list(pair(1, None))", true, null],
      ["is_linked_list(pair(1, pair(2, None)))", true, null],
      ["is_linked_list(llist(1, 2, 3))", true, null],
      ["is_linked_list(pair(llist(1, 2, 3), llist(4, 5, 6)))", true, null],
      ["is_linked_list(pair(llist(1, 2, 3), pair(4, 5)))", false, null],
      ["is_linked_list(llist(pair(1, 2), pair(3, 4), pair(5, 6)))", true, null],
      ["is_linked_list(llist(llist(llist(1, 2), 3, 4), 5, 6))", true, null],
      ["is_linked_list(1)", false, null],
      ["is_linked_list(None)", true, null],
      ['is_linked_list("llist")', false, null],
      ["is_linked_list(lambda x: x)", false, null],
      ["is_linked_list()", MissingRequiredPositionalError, null],
      ["is_linked_list(1, 2)", TooManyPositionalArgumentsError, null],
      ["equal(llist(1, 2), llist(1, 2))", true, null],
      ["equal(llist(1, 2), llist(2, 1))", false, null],
      ["equal(llist(1, llist(2, 3)), llist(1, llist(2, 3)))", true, null],
      ["equal(llist(1, llist(2, 3)), llist(1, llist(3, 2)))", false, null],
      ["equal(llist(1, 2), pair(2, pair(1, None)))", false, null],
      ["equal(llist(1, 2), pair(1, pair(2, None)))", true, null],
    ],
    "structural operations": [
      ["length_linked_list(llist(1, 2, 3, 4))", 4n, null],
      ["length_linked_list(None)", 0n, null],
      ["linked_list_to_string(llist(1, 2))", "[1, [2, None]]", null],
      ["linked_list_to_string(llist('a', 'b'))", "['a', ['b', None]]", null],
      ["linked_list_to_string(None)", "None", null],
    ],
    transformations: [
      ["equal(map_linked_list(lambda x: x + 1, llist(1, 2, 3)), llist(2, 3, 4))", true, null],
      ["equal(map_linked_list(lambda x: x + 1, None), None)", true, null],
      ["equal(build_linked_list(lambda i: i * i, 4), llist(0, 1, 4, 9))", true, null],
      ["equal(build_linked_list(lambda i: i, 0), None)", true, null],
      ["equal(reverse_linked_list(llist(1, 2, 3)), llist(3, 2, 1))", true, null],
      ["equal(reverse_linked_list(None), None)", true, null],
      ["equal(append_linked_list(llist(1, 2), llist(3, 4)), llist(1, 2, 3, 4))", true, null],
      ["equal(append_linked_list(None, llist(3, 4)), llist(3, 4))", true, null],
      ["equal(append_linked_list(llist(1, 2), None), llist(1, 2))", true, null],
      [
        "equal(filter_linked_list(lambda x: x % 2 == 0, llist(1, 2, 3, 4)), llist(2, 4))",
        true,
        null,
      ],
      ["equal(filter_linked_list(lambda x: x > 10, llist(1, 2, 3, 4)), None)", true, null],
      ["equal(enum_linked_list(3, 6), llist(3, 4, 5, 6))", true, null],
      ["equal(enum_linked_list(6, 3), None)", true, null],
    ],
    "search and removal": [
      ["equal(member_linked_list(1, llist(1, 2, 3, 4)), llist(1, 2, 3, 4))", true, null],
      ["equal(llist(1, 2, 3), pair(1, pair(2, pair(3, None))))", true, null],
      ["equal(member_linked_list(3, llist(1, 2, 3, 4)), llist(3, 4))", true, null],
      ["equal(member_linked_list(9, llist(1, 2, 3, 4)), None)", true, null],
      ["equal(remove_linked_list(9, llist(1, 2, 3, 2)), llist(1, 2, 3, 2))", true, null],
      ["equal(remove_linked_list(2, llist(1, 2, 3, 2)), llist(1, 3, 2))", true, null],
      ["equal(remove_all_linked_list(9, llist(1, 2, 3, 2)), llist(1, 2, 3, 2))", true, null],
      ["equal(remove_all_linked_list(2, llist(1, 2, 3, 2)), llist(1, 3))", true, null],
    ],
    "indexing and reducing": [
      ["ref_linked_list(llist(10, 20, 30), 0)", 10n, null],
      ["ref_linked_list(llist(10, 20, 30), 1)", 20n, null],
      ["accumulate_linked_list(lambda x, y: x + y, 10, None)", 10n, null],
      ["accumulate_linked_list(lambda x, y: x + y, 0, llist(1, 2, 3, 4))", 10n, null],
      ["for_each_linked_list(lambda x: x, None)", true, []],
      ["for_each_linked_list(print, llist(1, 2, 3))", true, ["1", "2", "3"]],
    ],
  };

  generateTestCases(linkedListTests, 2, [misc, math, linkedList]);
});
