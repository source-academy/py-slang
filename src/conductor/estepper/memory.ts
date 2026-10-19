/**
 * How much memory the host has left for the e-stepper's steps. A browser kills a tab whose
 * JavaScript heap reaches its limit (a fatal error, which cannot be caught), and the limit depends
 * on the device, the browser and what else runs, so there is no size that is right everywhere:
 * the steps are made while the heap is far enough from the limit the host reports. Where a host
 * reports none, `getSteps` counts instead.
 */

/** The JavaScript heap in use and its limit, in bytes. */
export interface HeapUse {
  used: number;
  limit: number;
}

/** A host's report on its heap, or `undefined` where it has none. */
export type HeapProbe = () => HeapUse | undefined;

/**
 * Chrome's (non-standard) `performance.memory`, in a page or a worker. The numbers are coarse, which
 * is enough here. Firefox and Safari have nothing like it; neither has Node (`performance.memory` is
 * not defined there).
 */
export const browserHeapProbe: HeapProbe = () => {
  const memory = (
    globalThis as {
      performance?: { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } };
    }
  ).performance?.memory;
  if (!memory || !memory.jsHeapSizeLimit || memory.usedJSHeapSize === undefined) return undefined;
  return { used: memory.usedJSHeapSize, limit: memory.jsHeapSizeLimit };
};

/**
 * The part of the heap limit the steps may take before the run ends. The steps are posted to the
 * page, which holds a second copy, and the heap holds what has not been collected yet.
 */
export const HEAP_FRACTION = 0.6;

/** How many contractions lie between two readings of the heap. */
export const MEMORY_CHECK_INTERVAL = 64;
