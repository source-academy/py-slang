import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { FeatureNotSupportedError } from "../validator";
import { generateTestCases } from "./utils";

describe("Loop Tests", () => {
  generateTestCases(
    {
      "for loops": [
        ["for i in range(5):\n    print(i)\ni", 4n, ["0", "1", "2", "3", "4"]],
        ["for i in range(2, 5):\n    print(i)\ni", 4n, ["2", "3", "4"]],
        ["for i in range(1, 10, 2):\n    print(i)\ni", 9n, ["1", "3", "5", "7", "9"]],
        ["for i in range(5, 0, -1):\n    print(i)\ni", 1n, ["5", "4", "3", "2", "1"]],
        ["for i in [10, 20, 30]:\n    print(i)", FeatureNotSupportedError, null],
        ["for i in range(0):\n    print(i)\n3", 3n, []],
        ["for i in range(5):\n    i = 0\n    print(i)\ni", 0n, ["0", "0", "0", "0", "0"]],
        ["x = 3\nfor x in range(x, x + 5):\n    print(x)\nx", 7n, ["3", "4", "5", "6", "7"]],
        ["for i in range(5):\n    for j in range(3):\n        print(i, j)\ni", 4n, ["0 0", "0 1", "0 2", "1 0", "1 1", "1 2", "2 0", "2 1", "2 2", "3 0", "3 1", "3 2", "4 0", "4 1", "4 2"]],
      ],
      "while loops": [
        ["i = 0\nwhile i < 5:\n    print(i)\n    i = i + 1\ni", 5n, ["0", "1", "2", "3", "4"]],
        ["i = 0\nwhile i < 5:\n    print(i)\n    i = i + 2\ni", 6n, ["0", "2", "4"]],
        ["i = 5\nwhile i > 0:\n    print(i)\n    i = i - 1\ni", 0n, ["5", "4", "3", "2", "1"]],
        ["i = 0\nwhile i < 5:\n    print(i)\n    if i == 2:\n        break\n    i = i + 1\ni", 2n, ["0", "1", "2"]],
        ["i = 0\nwhile i < 5:\n    if i == 2:\n        i = i + 1\n        continue\n    print(i)\n    i = i + 1\ni", 5n, ["0", "1", "3", "4"]],
      ],
      "break and continue": [
        [
          "result = 0\nfor i in range(100):\n    if i == 5:\n        break\n    result = result + i\nresult",
          10n,
            null,
        ],
        [
          "total = 0\nfor i in range(6):\n    if i == 3:\n        continue\n    total = total + i\ntotal",
          12n,
          null
        ],
        [
          "total = 0\nfor i in range(3):\n    for j in range(10):\n        if j == 2:\n            break\n        total = total + 1\ntotal",
          6n,
          null
        ],
      ]
    },
    3,
    [linkedList, stream, pairmutator, list],
  );
});
