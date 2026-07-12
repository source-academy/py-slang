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
import {
  generateNativePynterTestCases,
  generatePvmlInBrowserTestCases,
  generateTestCases,
  TestCases,
} from "./utils";

describe("Stream Tests", () => {
  const streamTests: TestCases = {
    "stream constructor and selectors": [
      ["head(stream(1, 2, 3))", 1n, null],
      ["head(stream_tail(stream(1, 2, 3)))", 2n, null],
      ["stream_tail(pair(42, lambda: None)) == None", true, null],
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
      ["is_stream(llist(1, 2, 3))", false, null],
      ["is_stream()", MissingRequiredPositionalError, null],
      ["is_stream(1, 2)", TooManyPositionalArgumentsError, null],
    ],
    "stream/list conversion": [
      ["llist_to_stream(None) == None", true, null],
      ["stream_to_llist(None) == None", true, null],
      ["stream_to_llist(llist_to_stream(llist(1, 2, 3))) == llist(1, 2, 3)", true, null],
      ["stream_to_llist(stream(4, 5)) == llist(4, 5)", true, null],
      ["stream_to_llist(pair(1, lambda: pair(2, lambda: None))) == llist(1, 2)", true, null],
    ],
    "length, map and build": [
      ["stream_length(stream(1, 2, 3, 4))", 4n, null],
      ["stream_length(None)", 0n, null],
      [
        "stream_to_llist(stream_map(lambda x: x + 1, stream(1, 2, 3))) == llist(2, 3, 4)",
        true,
        null,
      ],
      [
        "stream_to_llist(stream_map(lambda x: x * 2, pair(1, lambda: pair(2, lambda: None)))) == llist(2, 4)",
        true,
        null,
      ],
      ["stream_map(lambda x: x + 1, None) == None", true, null],
      ["stream_to_llist(build_stream(lambda i: i * i, 4)) == llist(0, 1, 4, 9)", true, null],
      ["build_stream(lambda i: i, 0) == None", true, null],
    ],
    "for_each, reverse and append": [
      ["stream_for_each(lambda x: x, None)", true, []],
      ["stream_for_each(print, stream(1, 2, 3))", true, ["1", "2", "3"]],
      ["stream_to_llist(stream_reverse(stream(1, 2, 3))) == llist(3, 2, 1)", true, null],
      ["stream_reverse(None) == None", true, null],
      [
        "stream_to_llist(stream_append(stream(1, 2), stream(3, 4))) == llist(1, 2, 3, 4)",
        true,
        null,
      ],
      [
        "stream_to_llist(stream_append(pair(1, lambda: pair(2, lambda: None)), stream(3, 4))) == llist(1, 2, 3, 4)",
        true,
        null,
      ],
      ["stream_to_llist(stream_append(None, stream(3, 4))) == llist(3, 4)", true, null],
      ["stream_to_llist(stream_append(stream(1, 2), None)) == llist(1, 2)", true, null],
    ],
    "member, remove and filter": [
      ["stream_to_llist(stream_member(3, stream(1, 2, 3, 4))) == llist(3, 4)", true, null],
      ["stream_member(9, stream(1, 2, 3, 4)) == None", true, null],
      ["stream_to_llist(stream_remove(2, stream(1, 2, 3, 2))) == llist(1, 3, 2)", true, null],
      ["stream_to_llist(stream_remove(9, stream(1, 2, 3, 2))) == llist(1, 2, 3, 2)", true, null],
      ["stream_to_llist(stream_remove_all(2, stream(1, 2, 3, 2))) == llist(1, 3)", true, null],
      ["stream_remove_all(1, stream(1, 1)) == None", true, null],
      [
        "stream_to_llist(stream_filter(lambda x: x % 2 == 0, stream(1, 2, 3, 4))) == llist(2, 4)",
        true,
        null,
      ],
      ["stream_filter(lambda x: x > 10, stream(1, 2, 3, 4)) == None", true, null],
    ],
    "enum, eval and ref": [
      ["stream_to_llist(enum_stream(3, 6)) == llist(3, 4, 5, 6)", true, null],
      ["enum_stream(6, 3) == None", true, null],
      ["eval_stream(stream(7, 8, 9), 2) == llist(7, 8)", true, null],
      ["eval_stream(integers_from(5), 4) == llist(5, 6, 7, 8)", true, null],
      ["eval_stream(pair(1, lambda: pair(2, lambda: None)), 2) == llist(1, 2)", true, null],
      ["eval_stream(stream(1, 2, 3), 0) == None", true, null],
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
eval_stream(
    more_and_more, 15
) == llist(1, 1, 2, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4, 5)`,
        true,
        null,
      ],
      [
        `def fibgen(a, b):
    return pair(a, lambda: fibgen(b, a + b))
fibs = fibgen(0, 1)
eval_stream(fibs, 10) == llist(0, 1, 1, 2, 3, 5, 8, 13, 21, 34)`,
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
eval_stream(primes, 10) == llist(2, 3, 5, 7, 11, 13, 17, 19, 23, 29)`,
        true,
        null,
      ],
    ],
  };

  generateTestCases(streamTests, 2, [misc, math, linkedList, stream, pairmutator]);
  // Pynter only supports Python §3 (see pynter/README.md) — still valid §3
  // programs, so run them there rather than at their nominal §2.
  generateNativePynterTestCases(streamTests, 3, [misc, math, linkedList, stream, pairmutator]);
  // Unlike native Pynter, PVML-in-browser isn't restricted to §3, so this
  // runs at the table's own nominal §2, matching generateTestCases() above.
  // Every known gap below is the same crash: calling a *recursive* or
  // sibling-referencing prelude-defined function (stream_map/eval_stream/
  // sieve/...) throws "Function at index N not found" — see py-slang#258
  // for the minimal repro.
  generatePvmlInBrowserTestCases(
    streamTests,
    2,
    [misc, math, linkedList, stream, pairmutator],
    [
      "stream_to_llist(llist_to_stream(llist(1, 2, 3))) == llist(1, 2, 3)",
      "stream_to_llist(stream_map(lambda x: x + 1, stream(1, 2, 3))) == llist(2, 3, 4)",
      "stream_to_llist(stream_map(lambda x: x * 2, pair(1, lambda: pair(2, lambda: None)))) == llist(2, 4)",
      "stream_to_llist(build_stream(lambda i: i * i, 4)) == llist(0, 1, 4, 9)",
      "build_stream(lambda i: i, 0) == None",
      "stream_to_llist(stream_reverse(stream(1, 2, 3))) == llist(3, 2, 1)",
      "stream_reverse(None) == None",
      "stream_to_llist(stream_append(stream(1, 2), stream(3, 4))) == llist(1, 2, 3, 4)",
      "stream_to_llist(stream_append(pair(1, lambda: pair(2, lambda: None)), stream(3, 4))) == llist(1, 2, 3, 4)",
      "stream_to_llist(stream_append(stream(1, 2), None)) == llist(1, 2)",
      "stream_to_llist(stream_remove(2, stream(1, 2, 3, 2))) == llist(1, 3, 2)",
      "stream_to_llist(stream_remove(9, stream(1, 2, 3, 2))) == llist(1, 2, 3, 2)",
      "stream_to_llist(stream_remove_all(2, stream(1, 2, 3, 2))) == llist(1, 3)",
      "stream_to_llist(stream_filter(lambda x: x % 2 == 0, stream(1, 2, 3, 4))) == llist(2, 4)",
      "stream_to_llist(enum_stream(3, 6)) == llist(3, 4, 5, 6)",
      "eval_stream(stream(7, 8, 9), 2) == llist(7, 8)",
      "eval_stream(integers_from(5), 4) == llist(5, 6, 7, 8)",
      "eval_stream(pair(1, lambda: pair(2, lambda: None)), 2) == llist(1, 2)",
      "eval_stream(stream(1, 2, 3), 0) == None",
      "stream_ref(integers_from(10), 50)",
      "def more(a, b):\n    return more(1, 1 + b) if a > b else pair(a, lambda: more(a + 1, b))\nmore_and_more = more(1, 1)\neval_stream(\n    more_and_more, 15\n) == llist(1, 1, 2, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4, 5)",
      "def fibgen(a, b):\n    return pair(a, lambda: fibgen(b, a + b))\nfibs = fibgen(0, 1)\neval_stream(fibs, 10) == llist(0, 1, 1, 2, 3, 5, 8, 13, 21, 34)",
      "def average(a, b):\n    return (a + b) / 2\ndef improve(guess, x):\n    return average(guess, x / guess)\ndef sqrt_stream(x):\n    guesses = pair(1.0, lambda: stream_map(lambda guess: improve(guess, x), guesses))\n    return guesses\nstream_ref(sqrt_stream(2), 5)",
      "def is_divisible(x, y):\n    return x % y == 0\n\ndef sieve(s):\n    return pair(\n        head(s),\n        lambda: sieve(stream_filter(lambda x: not is_divisible(x, head(s)), stream_tail(s)))\n    )\nprimes = sieve(integers_from(2))\neval_stream(primes, 10) == llist(2, 3, 5, 7, 11, 13, 17, 19, 23, 29)",
    ],
  );
});
