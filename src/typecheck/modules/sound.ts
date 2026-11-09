import type { ModuleDescription } from "../module-description";
import { fn, fun, opaque } from "./helpers";

const Sound = opaque("Sound");
/** A wave: a function from the time in seconds to the amplitude, in [-1, 1]. */
const Wave = fun(["number"], "number");
/** A function from a sound to a sound (an envelope, a modulation, panning). */
const Transformer = fun([Sound], Sound);
/** A function from a frequency and a duration to a sound (`sine_sound`). */
const Producer = fun(["number", "number"], Sound);

/**
 * TEMPORARY: the types of `sound`, written by hand from the module's declarations (functions.ts)
 * and the plugin's (index.ts). A sound is an opaque value that the module's functions take apart
 * (`get_wave`, `get_duration`): in the plugin it is a pair of waves and a duration, but a program
 * does not take it apart itself. `record` and `record_for` return the functions that wait for the
 * recording and return the sound. To be removed when the module publishes its own description
 * (source-academy/modules#996).
 */
export const SOUND: ModuleDescription = {
  version: 1,
  module: "sound",
  opaqueTypes: ["Sound"],
  functions: [
    fn(
      "make_sound",
      [
        ["wave", Wave],
        ["duration", "number"],
      ],
      Sound,
    ),
    fn(
      "make_stereo_sound",
      [
        ["left_wave", Wave],
        ["right_wave", Wave],
        ["duration", "number"],
      ],
      Sound,
    ),
    fn("get_wave", [["sound", Sound]], Wave),
    fn("get_left_wave", [["sound", Sound]], Wave),
    fn("get_right_wave", [["sound", Sound]], Wave),
    fn("get_duration", [["sound", Sound]], "number"),
    fn("is_sound", [["x", "any"]], "boolean"),
    fn("init_record", [], "string"),
    fn("record", [["buffer", "number"]], fun([], fun([], Sound))),
    fn(
      "record_for",
      [
        ["duration", "number"],
        ["buffer", "number"],
      ],
      fun([], Sound),
    ),
    fn(
      "play_wave",
      [
        ["wave", Wave],
        ["duration", "number"],
      ],
      Sound,
    ),
    fn(
      "play_waves",
      [
        ["left_wave", Wave],
        ["right_wave", Wave],
        ["duration", "number"],
      ],
      Sound,
    ),
    fn("play", [["sound", Sound]], Sound),
    fn("play_in_tab", [["sound", Sound]], Sound),
    fn("stop", [], "void"),
    fn("noise_wave", [], Wave),
    fn("silence_wave", [], Wave),
    ...["sine_wave", "square_wave", "triangle_wave", "sawtooth_wave"].map(name =>
      fn(name, [["freq", "number"]], Wave),
    ),
    fn("noise_sound", [["duration", "number"]], Sound),
    fn("silence_sound", [["duration", "number"]], Sound),
    ...["sine_sound", "square_sound", "triangle_sound", "sawtooth_sound"].map(name =>
      fn(
        name,
        [
          ["freq", "number"],
          ["duration", "number"],
        ],
        Sound,
      ),
    ),
    fn("consecutively", [["sounds", { list: Sound }]], Sound),
    fn("simultaneously", [["sounds", { list: Sound }]], Sound),
    fn(
      "adsr",
      [
        ["attack_ratio", "number"],
        ["decay_ratio", "number"],
        ["sustain_level", "number"],
        ["release_ratio", "number"],
      ],
      Transformer,
    ),
    fn(
      "stacking_adsr",
      [
        ["waveform", Producer],
        ["base_frequency", "number"],
        ["duration", "number"],
        ["envelopes", { list: Transformer }],
      ],
      Sound,
    ),
    fn(
      "phase_mod",
      [
        ["freq", "number"],
        ["duration", "number"],
        ["amount", "number"],
      ],
      Transformer,
    ),
    fn("squash", [["sound", Sound]], Sound),
    fn("pan", [["amount", "number"]], Transformer),
    fn("pan_mod", [["modulator", Sound]], Transformer),
    ...["bell", "cello", "piano", "trombone", "violin"].map(name =>
      fn(
        name,
        [
          ["note", "number"],
          ["duration", "number"],
        ],
        Sound,
      ),
    ),
  ],
  constants: [],
};
