import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import {
  createErrorStream,
  createInputStream,
  createOutputStream,
  destroyStreams,
  displayError,
} from "../engines/cse/streams";
import { toEvaluatorError } from "./errors";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";

const ALL_GROUPS: Group[] = [linkedList, list, pairmutator, stream];

function cseValueToNative(value: { type: string; value?: unknown }): unknown {
  switch (value.type) {
    case "number":
    case "bool":
    case "string":
      return value.value;
    case "bigint":
      return Number(value.value);
    case "none":
      return undefined;
    default:
      return undefined;
  }
}

export class PyCSEEvaluator extends BasicEvaluator {
  async evaluateChunk(chunk: string): Promise<void> {
    const context = new Context();
    try {
      context.streams = {
        initialised: true,
        stdout: createOutputStream(this.conductor),
        stderr: createErrorStream(this.conductor),
        stdin: createInputStream(this.conductor),
      };

      // Load stdlib groups into context
      for (const group of ALL_GROUPS) {
        for (const [name, value] of group.builtins) {
          context.nativeStorage.builtins.set(name, value);
        }
        if (group.prelude) {
          const preludeAst = parse(group.prelude + "\n");
          await evaluate("", preludeAst, context, { isPrelude: true, variant: 4, groups: [] });
        }
      }

      const script = chunk + "\n";
      const ast = parse(script);
      analyze(ast, script, 4, ALL_GROUPS);
      const result = await evaluate("", ast, context, {
        variant: 4,
        groups: ALL_GROUPS,
      });

      if (result.type === "error") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.conductor.sendError(toEvaluatorError(new Error(result.message)) as any);
        return;
      }

      this.conductor.sendResult(cseValueToNative(result));
    } catch (e) {
      if (e instanceof SyntaxError) {
        await displayError(context, e, ErrorType.EVALUATOR_SYNTAX);
        return;
      }
      await displayError(context, e, ErrorType.INTERNAL);
    } finally {
      await destroyStreams(context);
    }
  }
}
