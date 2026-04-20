import {
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
  TypeError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { generateTestCases, TestCases } from "./utils";

describe("Pair Mutator Tests", () => {
  const pairmutatorTests: TestCases = {
    "set_head basic operations": [
      [
        `p = pair(1, 2)
set_head(p, 10)
head(p)`,
        10n,
        null,
      ],
      [
        `p = pair('a', 'b')
set_head(p, 'x')
head(p)`,
        "x",
        null,
      ],
      [
        `p = pair(100, 200)
set_head(p, None)
head(p)`,
        null,
        null,
      ],
      [
        `p = pair(pair(1, 2), pair(3, 4))
set_head(p, pair(5, 6))
head(head(p))`,
        5n,
        null,
      ],
    ],
    "set_tail basic operations": [
      [
        `p = pair(1, 2)
set_tail(p, 20)
tail(p)`,
        20n,
        null,
      ],
      [
        `p = pair('a', 'b')
set_tail(p, 'y')
tail(p)`,
        "y",
        null,
      ],
      [
        `p = pair('first', None)
set_tail(p, 'second')
tail(p)`,
        "second",
        null,
      ],
      [
        `p = pair(1, pair(2, 3))
set_tail(p, pair(4, 5))
head(tail(p))`,
        4n,
        null,
      ],
    ],
    "mutation preserves pair and affects head/tail": [
      [
        `p = pair(1, 2)
set_head(p, 999)
set_tail(p, 888)
pair(head(p), tail(p))`,
        [999n, 888n],
        null,
      ],
      [
        `p = linked_list(1, 2, 3)
set_head(p, 10)
head(p)`,
        10n,
        null,
      ],
      [
        `p = linked_list(1, 2, 3)
set_tail(p, linked_list(20, 30))
head(tail(p))`,
        20n,
        null,
      ],
    ],
    "mutation through multiple references": [
      [
        `p = pair(1, 2)
q = p
set_head(p, 100)
head(q)`,
        100n,
        null,
      ],
      [
        `p = pair(1, 2)
q = p
r = p
set_head(q, 5)
set_tail(r, 10)
head(p)`,
        5n,
        null,
      ],
    ],
    "mutation with linked lists": [
      [
        `lst = linked_list(1, 2, 3, 4)
set_head(lst, 100)
head(lst)`,
        100n,
        null,
      ],
      [
        `lst = linked_list(1, 2, 3, 4)
new_tail = linked_list(20, 30)
set_tail(lst, new_tail)
head(tail(lst))`,
        20n,
        null,
      ],
      [
        `lst = linked_list(10, 20, 30)
set_head(tail(lst), 200)
head(tail(lst))`,
        200n,
        null,
      ],
    ],
    "mutation of streams": [
      [
        `s = stream(1, 2, 3)
set_head(s, 100)
head(s)`,
        100n,
        null,
      ],
      [
        `s = pair(1, lambda: pair(2, lambda: None))
set_head(s, 999)
head(s)`,
        999n,
        null,
      ],
    ],
    "set_head error cases": [
      ["set_head()", MissingRequiredPositionalError, null],
      ["set_head(1)", MissingRequiredPositionalError, null],
      ["set_head(1, 2, 3)", TooManyPositionalArgumentsError, null],
      ["set_head(None, 5)", TypeError, null],
      ["set_head(1, 5)", TypeError, null],
      ["set_head('string', 5)", TypeError, null],
    ],
    "set_tail error cases": [
      ["set_tail()", MissingRequiredPositionalError, null],
      ["set_tail(1)", MissingRequiredPositionalError, null],
      ["set_tail(1, 2, 3)", TooManyPositionalArgumentsError, null],
      ["set_tail(None, 5)", TypeError, null],
      ["set_tail(1, 5)", TypeError, null],
      ["set_tail('string', 5)", TypeError, null],
    ],
    "complex mutation scenarios": [
      [
        `def build_linked_list_mut(n):
    if n == 0:
        return None
    else:
        p = pair(n, None)
        if n == 1:
            return p
        else:
            set_tail(p, build_linked_list_mut(n - 1))
            return p
build_linked_list_mut(5)`,
        [5n, [4n, [3n, [2n, [1n, null]]]]],
        null,
      ],
    ],
    "mutation does affecting equality of different pairs": [
      [
        `p = pair(1, 2)
q = pair(1, 2)
set_head(p, 100)
head(p) == head(q)`,
        false,
        null,
      ],
      [
        `p = pair(1, 2)
q = p
set_head(p, 100)
head(p) == head(q)`,
        true,
        null,
      ],
    ],
    "mutation side effects on return value": [
      [
        `p = pair(1, 2)
result = set_head(p, 10)
result`,
        null,
        null,
      ],
      [
        `p = pair(1, 2)
result = set_tail(p, 20)
result`,
        null,
        null,
      ],
    ],
  };

  generateTestCases(pairmutatorTests, 2, [linkedList, pairmutator, stream]);
});
