import { ExprNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { BuiltinValue, NoneValue, Value } from "../engines/cse/stash";
import { GroupName, minArgMap, Validate } from "./utils";

const ev3Builtins = new Map<string, BuiltinValue>();

/**
 * The `ev3_*` builtin surface mirrors the real EV3 device API documented at
 * https://docs.sourceacademy.org/EV3/global.html. Every entry here is a stub that returns `None`
 * — real device I/O never happens synchronously inside py-slang's own evaluator. Two very
 * different call paths use this group:
 *
 *  - `EV3Engine`/`Ev3Evaluator` (engines/ev3, conductor/Ev3Evaluator.ts): a program is *compiled*
 *    (not interpreted) to PVML bytecode that runs on the physical robot, so a call to e.g.
 *    `ev3_motorA()` never reaches this stub's body at all — the compiler resolves the call by
 *    name at compile time and emits a CALLV/CALLTV "vm-internal function" call instead (see
 *    PVMLCompiler's `internalFunctions` constructor param / EV3_INTERNAL_FUNCTIONS below), never
 *    a CALLP native-primitive call.
 *  - Any tree-walking evaluator (e.g. the CSE machine, if `ev3` is ever added to a
 *    `VARIANT_GROUPS` entry) would actually invoke these stub bodies directly and get `None` back
 *    — harmless for now, since there is no simulated device behind this group the way
 *    `robot_simulation` (the modules repo) provides for the browser-only simulation track.
 *
 * Minimum/maximum arities below are fixed per the real device API (not left at the placeholder
 * 0/0 an earlier, now-stale draft of this file used) because callers rely on them for validation
 * on the tree-walking path, the same way every other builtin group's `@Validate` already drives
 * `PRIMITIVE_MIN_ARGS` for PVML (see builtins.ts). CALLV/CALLTV emission itself trusts the
 * compile-time call-site arg count as written — it does not re-derive or check arity from these
 * decorators.
 */
export class Ev3Builtins {
  @Validate(1, 1, "ev3_pause", true)
  static ev3_pause(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_connected", true)
  static ev3_connected(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_motorA", true)
  static ev3_motorA(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_motorB", true)
  static ev3_motorB(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_motorC", true)
  static ev3_motorC(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_motorD", true)
  static ev3_motorD(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_motorGetSpeed", true)
  static ev3_motorGetSpeed(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(2, 2, "ev3_motorSetSpeed", true)
  static ev3_motorSetSpeed(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_motorStart", true)
  static ev3_motorStart(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_motorStop", true)
  static ev3_motorStop(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(2, 2, "ev3_motorSetStopAction", true)
  static ev3_motorSetStopAction(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_motorGetPosition", true)
  static ev3_motorGetPosition(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(3, 3, "ev3_runForTime", true)
  static ev3_runForTime(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(3, 3, "ev3_runToAbsolutePosition", true)
  static ev3_runToAbsolutePosition(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(3, 3, "ev3_runToRelativePosition", true)
  static ev3_runToRelativePosition(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_colorSensor", true)
  static ev3_colorSensor(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_colorSensorRed", true)
  static ev3_colorSensorRed(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_colorSensorGreen", true)
  static ev3_colorSensorGreen(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_colorSensorBlue", true)
  static ev3_colorSensorBlue(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_reflectedLightIntensity", true)
  static ev3_reflectedLightIntensity(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ambientLightIntensity", true)
  static ev3_ambientLightIntensity(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_colorSensorGetColor", true)
  static ev3_colorSensorGetColor(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_ultrasonicSensor", true)
  static ev3_ultrasonicSensor(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ultrasonicSensorDistance", true)
  static ev3_ultrasonicSensorDistance(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_gyroSensor", true)
  static ev3_gyroSensor(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_gyroSensorAngle", true)
  static ev3_gyroSensorAngle(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_gyroSensorRate", true)
  static ev3_gyroSensorRate(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_touchSensor1", true)
  static ev3_touchSensor1(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_touchSensor2", true)
  static ev3_touchSensor2(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_touchSensor3", true)
  static ev3_touchSensor3(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_touchSensor4", true)
  static ev3_touchSensor4(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_touchSensorPressed", true)
  static ev3_touchSensorPressed(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_hello", true)
  static ev3_hello(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(0, 0, "ev3_waitForButtonPress", true)
  static ev3_waitForButtonPress(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_speak", true)
  static ev3_speak(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_playSequence", true)
  static ev3_playSequence(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ledLeftGreen", true)
  static ev3_ledLeftGreen(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ledLeftRed", true)
  static ev3_ledLeftRed(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ledRightGreen", true)
  static ev3_ledRightGreen(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ledRightRed", true)
  static ev3_ledRightRed(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(1, 1, "ev3_ledGetBrightness", true)
  static ev3_ledGetBrightness(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }

  @Validate(2, 2, "ev3_ledSetBrightness", true)
  static ev3_ledSetBrightness(
    _args: Value[],
    _source: string,
    _command: ExprNS.Call,
    _context: Context,
  ): NoneValue {
    return { type: "none" };
  }
}

for (const builtin of Object.getOwnPropertyNames(Ev3Builtins)) {
  if (
    typeof Ev3Builtins[builtin as keyof typeof Ev3Builtins] === "function" &&
    !builtin.startsWith("_")
  ) {
    ev3Builtins.set(builtin, {
      type: "builtin",
      func: Ev3Builtins[builtin as keyof typeof Ev3Builtins] as BuiltinValue["func"],
      name: builtin,
      minArgs: minArgMap.get(builtin) || 0,
    });
  }
}

/**
 * The device-side function index table: position in this array IS the
 * `id` byte a CALLV/CALLTV instruction (opcodes.ts) carries for the
 * corresponding `ev3_*` name, and it is byte-for-byte identical, in the
 * same order, to pynter's own `devices/ev3/src/ev3_functions.c`
 * `internals[]` C array — the array `sivmfn_vminternals` is pointed at on
 * an EV3 build, and what pynter/vm/src/vm.c's `do_internal_function`
 * indexes into for a non-primitive (`is_primitive = false`) call. This
 * ordering is NOT derived from `Ev3Builtins`' own class-member declaration
 * order (relying on JS enumeration order to encode a wire-protocol index
 * would be fragile to an innocuous reordering/rename in this file) — it is
 * listed out explicitly and must only ever be changed in lockstep with a
 * corresponding pynter release.
 */
export const EV3_FUNCTIONS: readonly string[] = [
  "ev3_pause",
  "ev3_connected",
  "ev3_motorA",
  "ev3_motorB",
  "ev3_motorC",
  "ev3_motorD",
  "ev3_motorGetSpeed",
  "ev3_motorSetSpeed",
  "ev3_motorStart",
  "ev3_motorStop",
  "ev3_motorSetStopAction",
  "ev3_motorGetPosition",
  "ev3_runForTime",
  "ev3_runToAbsolutePosition",
  "ev3_runToRelativePosition",
  "ev3_colorSensor",
  "ev3_colorSensorRed",
  "ev3_colorSensorGreen",
  "ev3_colorSensorBlue",
  "ev3_reflectedLightIntensity",
  "ev3_ambientLightIntensity",
  "ev3_colorSensorGetColor",
  "ev3_ultrasonicSensor",
  "ev3_ultrasonicSensorDistance",
  "ev3_gyroSensor",
  "ev3_gyroSensorAngle",
  "ev3_gyroSensorRate",
  "ev3_touchSensor1",
  "ev3_touchSensor2",
  "ev3_touchSensor3",
  "ev3_touchSensor4",
  "ev3_touchSensorPressed",
  "ev3_hello",
  "ev3_waitForButtonPress",
  "ev3_speak",
  "ev3_playSequence",
  "ev3_ledLeftGreen",
  "ev3_ledLeftRed",
  "ev3_ledRightGreen",
  "ev3_ledRightRed",
  "ev3_ledGetBrightness",
  "ev3_ledSetBrightness",
];

/** `ev3_*` name -> CALLV/CALLTV device-function index, per EV3_FUNCTIONS above. Passed to
 * PVMLCompiler.fromProgram's `internalFunctions` param by EV3Engine/Ev3Evaluator so calls to
 * these names compile to CALLV/CALLTV instead of failing as an unrecognised primitive. */
export const EV3_INTERNAL_FUNCTIONS: ReadonlyMap<string, number> = new Map(
  EV3_FUNCTIONS.map((name, i) => [name, i]),
);

export default {
  name: GroupName.EV3,
  prelude: "",
  builtins: ev3Builtins,
};
