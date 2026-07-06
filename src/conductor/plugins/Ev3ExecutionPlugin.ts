import type { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";
import { EV3Engine } from "../../engines/ev3/EV3Engine";

type PySlangMessage =
  | { type: 'run'; code: string }
  | { type: 'result'; output: string }
  | { type: 'error'; message: string };

const CHANNEL_ID = 'test';

export class Ev3ExecutionPlugin implements IPlugin {
  readonly id: string = '__ev3_execution';
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __channel: IChannel<PySlangMessage>;
  private readonly engine: EV3Engine;

  constructor(_conduit: IConduit, [channel]: IChannel<PySlangMessage>[]) {
    this.__channel = channel;
    this.engine = new EV3Engine();

    this.__channel.subscribe(async message => {
      if (message.type === 'run') {
        const result = await this.engine.execute(message.code);
        if (result.status === 'finished') {
          this.__channel.send({ type: 'result', output: result.output });
        } else {
          this.__channel.send({ type: 'error', message: result.error });
        }
      }
    });
  }
}
