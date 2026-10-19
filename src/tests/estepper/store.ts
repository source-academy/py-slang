import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperStep,
} from "@sourceacademy/common-e-stepper";

/**
 * The whole store at `steps[index]`, as a host works it out: a step has the frames and objects that
 * are reachable, and those that become unreachable in it; the ones that became so earlier are in
 * the earlier steps (`frames` and `heap` of the steps would otherwise grow with the square of their
 * number, py-slang#611). The same as `storeAt` of the web plugin (source-academy/plugins).
 */
export function storeAt(
  steps: EStepperStep[],
  index: number,
): { frames: EStepperFrame[]; heap: EStepperHeapObject[] } {
  const frames = new Map<string, EStepperFrame>();
  const heap = new Map<string, EStepperHeapObject>();
  for (let i = 0; i <= index; i++) {
    for (const f of steps[i].frames) frames.set(f.id, f);
    for (const o of steps[i].heap) heap.set(o.id, o);
  }
  const now = steps[index];
  const mark = <T extends { id: string; isGarbage: boolean }>(item: T, here: T[]): T =>
    here.some(h => h.id === item.id)
      ? here.find(h => h.id === item.id)!
      : { ...item, isGarbage: true };
  const number = (id: string): number => (id === "Global" ? -1 : Number(id.replace(/\D/g, "")));
  return {
    frames: [...frames.values()]
      .map(f => mark(f, now.frames))
      .sort((a, b) => number(a.id) - number(b.id)),
    heap: [...heap.values()]
      .map(o => mark(o, now.heap))
      .sort((a, b) => number(a.id) - number(b.id)),
  };
}

/** The step with its whole store. */
export const withStore = (steps: EStepperStep[], index = steps.length - 1): EStepperStep => ({
  ...steps[index],
  ...storeAt(steps, index),
});
