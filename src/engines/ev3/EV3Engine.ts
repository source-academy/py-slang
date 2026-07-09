import { parse } from '../../parser/parser-adapter';
import { Resolver } from '../../resolver';
import ev3, { EV3_FUNCTIONS } from '../../stdlib/ev3';
import math from '../../stdlib/math';
import misc from '../../stdlib/misc';
import { PYNTER_OPCODE_MAX } from '../pvml/opcodes';
import { assemble } from '../pvml/pvml-assembler';
import { PVMLCompiler } from '../pvml/pvml-compiler';
import type { EV3ExecutionResult } from './types';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0xffff;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    );
  }
  return btoa(binary);
}

const EV3_INTERNAL_FUNCTIONS = new Map(EV3_FUNCTIONS.map((name, i) => [name, i]));

export class EV3Engine {
  async execute(code: string): Promise<EV3ExecutionResult> {
    try {
      const script = code + '\n';
      const ast = parse(script);

      const resolver = new Resolver("", ast, [], [misc, math, ev3]);
      const environments = resolver.resolveEnvironments(ast);
      if (resolver.errors.length > 0) {
        throw resolver.errors[0];
      }

      const compiler = PVMLCompiler.fromProgram(ast, 0, environments, EV3_INTERNAL_FUNCTIONS);
      const program = compiler.compileProgram(ast);
      const binary = assemble(program, PYNTER_OPCODE_MAX);

      return { status: 'finished', output: uint8ArrayToBase64(binary) };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }
}
