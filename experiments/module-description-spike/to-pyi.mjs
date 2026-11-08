// The mapper for Typed Python §4: a description -> the text of a Python stub. (The part that py-slang would own.)
import { readFileSync, writeFileSync } from "node:fs";
const coarse = JSON.parse(readFileSync("rune.coarse.json", "utf8"));
const precise = JSON.parse(readFileSync("rune.precise.json", "utf8")).precise;

const OPAQUE_NAME = "Rune"; // the one opaque type of the module (named by hand: the conductor does not name it)

// ---- from the conductor signatures only (what a consumer could get with no new information) ----
const DT = { OPAQUE: "Opaque", NUMBER: "float", INTEGER: "int", CONST_STRING: "str", BOOLEAN: "bool", VOID: "None", CLOSURE: "Callable[..., object]" };
function coarsePyi() {
  const lines = ["from typing import Callable", "class Opaque: ..."];
  for (const name of coarse.exportedNames) {
    const s = coarse.signatures[name];
    lines.push(`def ${name}(${s.params.map((p, i) => `arg${i + 1}: ${DT[p]}`).join(", ")}${s.params.length ? ", " : ""}/) -> ${DT[s.returns]}: ...`);
  }
  return lines.join("\n") + "\n";
}

// ---- from the TypeScript declarations, plus what they lack ----
function py(t) {
  if (t === "number") return "float";
  if (t === "string") return "str";
  if (t === "boolean") return "bool";
  if (t === "void") return "None";
  if (t.named) return t.named;
  if (t.array) return `list[${py(t.array)}]`;
  if (t.function) return `Callable[[${t.function.params.map(p => py(p.type)).join(", ")}], ${py(t.function.returns)}]`;
  throw new Error("cannot map " + JSON.stringify(t));
}
// The six functions that are defined on the plugin class, with no TypeScript signature of their own: from the
// conductor signature, with the opaque type named, and the callbacks written by hand.
const HAND = {
  show: [[["rune", "Rune"]], "Rune"], anaglyph: [[["rune", "Rune"]], "Rune"], hollusion: [[["rune", "Rune"]], "Rune"],
  hollusion_magnitude: [[["rune", "Rune"], ["magnitude", "float"]], "Rune"],
  animate_rune: [[["duration", "float"], ["fps", "float"], ["func", "Callable[[float], Rune]"]], "Rune"],
  animate_anaglyph: [[["duration", "float"], ["fps", "float"], ["func", "Callable[[float], Rune]"]], "Rune"],
};
function precisePyi() {
  const lines = ["from typing import Callable", `class ${OPAQUE_NAME}: ...`];
  const handWritten = [];
  for (const name of coarse.exportedNames) {
    const p = precise[name];
    if (p?.function) {
      lines.push(`def ${name}(${p.function.params.map(x => `${x.name}: ${py(x.type)}`).join(", ")}${p.function.params.length ? ", " : ""}/) -> ${py(p.function.returns)}: ...`);
    } else if (HAND[name]) {
      const [params, ret] = HAND[name];
      lines.push(`def ${name}(${params.map(([n, t]) => `${n}: ${t}`).join(", ")}, /) -> ${ret}: ...`); handWritten.push(name);
    } else throw new Error("no type for " + name);
  }
  for (const [field] of Object.entries(coarse.classFields)) lines.push(`${field}: ${OPAQUE_NAME}`);
  return { text: lines.join("\n") + "\n", handWritten };
}
writeFileSync("rune.coarse.pyi", coarsePyi());
const { text, handWritten } = precisePyi();
writeFileSync("rune.precise.pyi", text);
console.log("coarse stub:", coarsePyi().split("\n").length - 1, "lines | precise stub:", text.split("\n").length - 1, "lines | functions that needed hand-written types:", handWritten.length, handWritten.join(", "));
