import type { Token } from "../tokenizer";

export interface SlotInfo {
  slot: number;
  envLevel: number;
  isPrimitive: boolean;
}

export type SlotLookup = (token: Token) => SlotInfo;
