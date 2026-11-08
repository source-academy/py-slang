/**
 * Pyright's messages say what its type system found, in its own words: `Literal['five']`,
 * `Pair[H@head, Any]`, `Pair[int, LList] | None`, and a second line of detail that repeats the first.
 * This turns them into messages for students of Typed Python §4: the types that the student wrote
 * (int, str, LList[int]), the names of the functions, and, for the mistakes that students make most,
 * what to do.
 *
 * A message is rewritten in steps (see {@link studentMessage}); the rules for whole messages are the
 * table {@link REWRITES}, each with an example in src/tests/typecheck-messages.test.ts.
 */

/** The type of the value of a literal type: `Literal['a']` is a str, `Literal[1]` an int. */
function widen(literal: string): string {
  if (literal === "True" || literal === "False") return "bool";
  if (/^-?\d+$/.test(literal)) return "int";
  if (/^b['"]/.test(literal)) return "bytes";
  return "str";
}

const LITERAL = String.raw`(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|b'(?:[^'\\]|\\.)*'|-?\d+|True|False)`;
const LITERAL_TYPE = new RegExp(String.raw`Literal\[(${LITERAL}(?:, ${LITERAL})*)\]`, "g");

/** `Literal['five']` is shown as `str`, and `Literal[1, 2]` as `int`: a student passes a value, not a type. */
function widenLiterals(text: string): string {
  return text.replace(LITERAL_TYPE, (_, list: string) => {
    const types = new Set(list.match(new RegExp(LITERAL, "g"))!.map(widen));
    return [...types].join(" | ");
  });
}

/** `H@head` is `H`: the type parameter of the function, which the student knows from the documentation. */
function dropTypeParameterScopes(text: string): string {
  return text.replace(/\b_?([A-Z][A-Za-z]*)@\w+/g, "$1");
}

/**
 * The index of the bracket that closes the one at `open`, and the top-level arguments between them.
 */
function bracketed(text: string, open: number): { close: number; args: string[] } | undefined {
  let depth = 0;
  const args: string[] = [];
  let start = open + 1;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") {
      depth--;
      if (depth === 0) {
        args.push(text.slice(start, i).trim());
        return { close: i, args };
      }
    } else if (c === "," && depth === 1) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return undefined;
}

/**
 * Pyright writes the types that it inferred without the names of the aliases: `LList[int]` is
 * `Pair[int, LList] | None` and `Stream[int]` is `Pair[int, () -> Stream] | None`. Show the names.
 */
function showAliases(text: string): string {
  let result = text;
  let from = 0;
  for (;;) {
    const at = result.indexOf("Pair[", from);
    if (at < 0) return result;
    const open = at + "Pair".length;
    const pair = bracketed(result, open);
    from = at + 1;
    if (!pair || pair.args.length !== 2) continue;
    const [head, tail] = pair.args;
    const alias = tail === "LList" ? "LList" : tail === "() -> Stream" ? "Stream" : undefined;
    const rest = result.slice(pair.close + 1);
    if (!alias || !rest.startsWith(" | None")) continue;
    result = `${result.slice(0, at)}${alias}[${head}]${rest.slice(" | None".length)}`;
    from = at;
  }
}

/** The mistakes that students make most, and the messages for them: tried in order, the first that fits. */
const REWRITES: { pattern: RegExp; message: (match: RegExpExecArray) => string }[] = [
  {
    // f(1, "a") with f(x: int, y: int): the call has an argument of the wrong type.
    pattern:
      /^Argument of type "(.*)" cannot be assigned to parameter "(.*)" of type "(.*)" in function "(.*)"/,
    message: ([, got, parameter, wanted, func]) =>
      `${func} expects ${parameter} to be ${wanted}, but got ${got}`,
  },
  {
    // if 1: ...
    pattern: /^Invalid conditional operand of type "(.*)"/,
    message: ([, type]) => `A condition must be a bool, but this is ${article(type)}`,
  },
  {
    // pair(1, 2)[0]
    pattern: /^"__getitem__" method not defined on type "(Pair\[.*\])"/,
    message: ([, type]) => `A pair cannot be indexed (${type}): use head(...) and tail(...)`,
  },
  {
    pattern: /^"__getitem__" method not defined on type "(.*)"/,
    message: ([, type]) => `A value of type ${type} cannot be indexed`,
  },
  {
    // x: Any (after `from typing import Any`, which py-slang rejects before the checker is asked)
    pattern: /^Type `Any` is not allowed/,
    message: () =>
      "The type Any is not available: for a function that works for any type, use a type parameter, as in def f[A](x: A) -> A",
  },
  {
    // from m import x, where nothing is known of the types of m
    pattern: /^Import "(.*)" could not be resolved$/,
    message: ([, name]) =>
      `The module ${name} cannot be imported: its types are not known to Typed Python §4`,
  },
  {
    pattern: /^Type of "(.*)" is (?:partially )?unknown/,
    message: ([, name]) =>
      `The type of ${name} cannot be determined: declare it, as in ${name}: list[int] = []`,
  },
  {
    pattern: /^Type of parameter "(.*)" is unknown/,
    message: ([, name]) =>
      `The type of the parameter ${name} cannot be determined: a lambda gets its parameter ` +
      `types from where it is used, for example f: Callable[[int], int] = lambda ${name}: ...`,
  },
  {
    pattern: /^Return type of lambda is unknown/,
    message: () => "The type of what this lambda returns cannot be determined",
  },
  {
    pattern: /^Argument type is (?:partially )?unknown/,
    message: () => "The type of this argument cannot be determined",
  },
];

/** `an int`, `a str`, `a list[int]`: the type with its article. */
function article(type: string): string {
  return /^[aeiou]/i.test(type) ? `an ${type}` : `a ${type}`;
}

/**
 * The message for a student. Pyright's own message has a first line, and indented detail lines
 * after it that mostly repeat it, except that detail that says `"None" is not assignable to …` is the
 * reason of a mistake that students make: a linked list can be None, and `head(xs)` needs a pair.
 */
export function studentMessage(message: string): string {
  const [first, ...detail] = message.split("\n");
  const canBeNone = detail.some(line => /"None" is not assignable to/.test(line));
  let text = showAliases(dropTypeParameterScopes(widenLiterals(first)));
  for (const { pattern, message: rewrite } of REWRITES) {
    const match = pattern.exec(text);
    if (match) {
      text = rewrite(match);
      break;
    }
  }
  if (canBeNone)
    text += ". The value can be None: test for that first, for example with is_none(...)";
  return text;
}
