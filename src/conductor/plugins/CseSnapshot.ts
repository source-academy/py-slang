/**
 * Wire format types for the __cse channel.
 * Must match the CseSnapshot types defined in conductor/src/plugins/cse/types/CseSnapshot.ts.
 * When the conductor cse-plugin package is published, these can be replaced with imports.
 */

export const CSE_CHANNEL = "__cse";
export const CSE_MESSAGE_TYPE_SNAPSHOTS = "snapshots";

export interface SerializedValue {
  displayValue: string;
  label: string;
  tag?: string;
  metadata?: unknown;
}

export interface SerializedInstruction {
  displayText: string;
  tag?: string;
  metadata?: unknown;
}

export interface SerializedBinding {
  name: string;
  value: SerializedValue;
}

export interface SerializedEnvFrame {
  id: string;
  name: string;
  parentId: string | null;
  closureFrameId?: string;
  bindings: SerializedBinding[];
  isActive: boolean;
}

export interface CseSnapshot {
  stepIndex: number;
  control: SerializedInstruction[];
  stash: SerializedValue[];
  environments: SerializedEnvFrame[];
  /** 1-based line of the node most recently evaluated (context.runtime.nodes[0]). */
  currentLine?: number;
}

export interface CseSnapshotMessage {
  type: typeof CSE_MESSAGE_TYPE_SNAPSHOTS;
  snapshots: CseSnapshot[];
  totalSteps: number;
}
