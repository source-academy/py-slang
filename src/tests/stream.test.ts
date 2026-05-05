import {
  MissingRequiredPositionalError,
  TooManyPositionalArgumentsError,
  UserError,
} from "../errors";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { generateTestCases, TestCases } from "./utils";

describe("Stream Tests", () => {
  const streamTests: TestCases = {
    "stream constructor and selectors": [
      ["head(stream(1, 2, 3))", 1n, null],
      ["head(stream_tail(stream(1, 2, 3)))", 2n, null],
      ["equal(stream_tail(pair(42, lambda: None)), None)", true, null],
      ["stream()", null, null],
      ["stream_tail()", MissingRequiredPositionalError, null],
      ["stream_tail(1, 2)", TooManyPositionalArgumentsError, null],
      ["stream_tail(None)", UserError, null],
      ["stream_tail(pair(1, 2))", UserError, null],
      ["stream_ref(stream(5, 6, 7), 1)", 6n, null],
    ],
    "is_stream checks": [
      ["is_stream(None)", true, null],
      ["is_stream(stream(1, 2, 3))", true, null],
      ["is_stream(pair(1, lambda: stream(2, 3)))", true, null],
      ["is_stream(pair(1, lambda: pair(2, lambda: None)))", true, null],
      ["is_stream(pair(1, 2))", false, null],
      ["is_stream(pair(1, lambda x: None))", false, null],
      ["is_stream(pair(1, lambda: 2))", false, null],
      ["is_stream(linked_list(1, 2, 3))", false, null],
      ["is_stream()", MissingRequiredPositionalError, null],
      ["is_stream(1, 2)", TooManyPositionalArgumentsError, null],
    ],
    "stream/list conversion": [
      ["equal(linked_list_to_stream(None), None)", true, null],
      ["equal(stream_to_linked_list(None), None)", true, null],
      [
        "equal(stream_to_linked_list(linked_list_to_stream(linked_list(1, 2, 3))), linked_list(1, 2, 3))",
        true,
        null,
      ],
      ["equal(stream_to_linked_list(stream(4, 5)), linked_list(4, 5))", true, null],
      [
        "equal(stream_to_linked_list(pair(1, lambda: pair(2, lambda: None))), linked_list(1, 2))",
        true,
        null,
      ],
    ],
    "length, map and build": [
      ["stream_length(stream(1, 2, 3, 4))", 4n, null],
      ["stream_length(None)", 0n, null],
      [
        "equal(stream_to_linked_list(stream_map(lambda x: x + 1, stream(1, 2, 3))), linked_list(2, 3, 4))",
        true,
        null,
      ],
      [
        "equal(stream_to_linked_list(stream_map(lambda x: x * 2, pair(1, lambda: pair(2, lambda: None)))), linked_list(2, 4))",
        true,
        null,
      ],
      ["equal(stream_map(lambda x: x + 1, None), None)", true, null],
      [
        "equal(stream_to_linked_list(build_stream(lambda i: i * i, 4)), linked_list(0, 1, 4, 9))",
        true,
        null,
      ],
      ["equal(build_stream(lambda i: i, 0), None)", true, null],
    ],
    "for_each, reverse and append": [
      ["stream_for_each(lambda x: x, None)", true, []],
      ["stream_for_each(print, stream(1, 2, 3))", true, ["1", "2", "3"]],
      [
        "equal(stream_to_linked_list(stream_reverse(stream(1, 2, 3))), linked_list(3, 2, 1))",
        true,
        null,
      ],
      ["equal(stream_reverse(None), None)", true, null],
      [
        "equal(stream_to_linked_list(stream_append(stream(1, 2), stream(3, 4))), linked_list(1, 2, 3, 4))",
        true,
        null,
      ],
      [
        "equal(stream_to_linked_list(stream_append(pair(1, lambda: pair(2, lambda: None)), stream(3, 4))), linked_list(1, 2, 3, 4))",
        true,
        null,
      ],
      [
        "equal(stream_to_linked_list(stream_append(None, stream(3, 4))), linked_list(3, 4))",
        true,
        null,
      ],
      [
        "equal(stream_to_linked_list(stream_append(stream(1, 2), None)), linked_list(1, 2))",
        true,
        null,
      ],
    ],
    "member, remove and filter": [
      [
        "equal(stream_to_linked_list(stream_member(3, stream(1, 2, 3, 4))), linked_list(3, 4))",
        true,
        null,
      ],
      ["equal(stream_member(9, stream(1, 2, 3, 4)), None)", true, null],
      [
        "equal(stream_to_linked_list(stream_remove(2, stream(1, 2, 3, 2))), linked_list(1, 3, 2))",
        true,
        null,
      ],
      [
        "equal(stream_to_linked_list(stream_remove(9, stream(1, 2, 3, 2))), linked_list(1, 2, 3, 2))",
        true,
        null,
      ],
      [
        "equal(stream_to_linked_list(stream_remove_all(2, stream(1, 2, 3, 2))), linked_list(1, 3))",
        true,
        null,
      ],
      ["equal(stream_remove_all(1, stream(1, 1)), None)", true, null],
      [
        "equal(stream_to_linked_list(stream_filter(lambda x: x % 2 == 0, stream(1, 2, 3, 4))), linked_list(2, 4))",
        true,
        null,
      ],
      ["equal(stream_filter(lambda x: x > 10, stream(1, 2, 3, 4)), None)", true, null],
    ],
    "enum, eval and ref": [
      ["equal(stream_to_linked_list(enum_stream(3, 6)), linked_list(3, 4, 5, 6))", true, null],
      ["equal(enum_stream(6, 3), None)", true, null],
      ["equal(eval_stream(stream(7, 8, 9), 2), linked_list(7, 8))", true, null],
      ["equal(eval_stream(integers_from(5), 4), linked_list(5, 6, 7, 8))", true, null],
      [
        "equal(eval_stream(pair(1, lambda: pair(2, lambda: None)), 2), linked_list(1, 2))",
        true,
        null,
      ],
      ["equal(eval_stream(stream(1, 2, 3), 0), None)", true, null],
      ["stream_ref(stream(10, 20, 30), 0)", 10n, null],
      ["stream_ref(stream(10, 20, 30), 2)", 30n, null],
      ["stream_ref(pair(10, lambda: pair(20, lambda: None)), 1)", 20n, null],
      ["stream_ref(integers_from(10), 50)", 60n, null],
    ],
    "translated recursive stream definitions": [
      [
        `def more(a, b):
    return more(1, 1 + b) if a > b else pair(a, lambda: more(a + 1, b))
more_and_more = more(1, 1)
equal(
    eval_stream(more_and_more, 15),
    linked_list(1, 1, 2, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4, 5)
)`,
        true,
        null,
      ],
      [
        `def fibgen(a, b):
    return pair(a, lambda: fibgen(b, a + b))
fibs = fibgen(0, 1)
equal(eval_stream(fibs, 10), linked_list(0, 1, 1, 2, 3, 5, 8, 13, 21, 34))`,
        true,
        null,
      ],
      [
        `def average(a, b):
    return (a + b) / 2
def improve(guess, x):
    return average(guess, x / guess)
def sqrt_stream(x):
    guesses = pair(1.0, lambda: stream_map(lambda guess: improve(guess, x), guesses))
    return guesses
stream_ref(sqrt_stream(2), 5)`,
        1.414213562373095,
        null,
      ],
      [
        `def is_divisible(x, y):
    return x % y == 0
    
def sieve(s):
    return pair(
        head(s),
        lambda: sieve(stream_filter(lambda x: not is_divisible(x, head(s)), stream_tail(s)))
    )
primes = sieve(integers_from(2))
equal(eval_stream(primes, 10), linked_list(2, 3, 5, 7, 11, 13, 17, 19, 23, 29))`,
        true,
        null,
      ],
    ],
  };

  generateTestCases(streamTests, 2, [misc, math, linkedList, stream, pairmutator]);
});
