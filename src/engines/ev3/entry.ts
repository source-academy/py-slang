/// <reference lib="webworker" />
import { Conduit } from '@sourceacademy/conductor/conduit';
import { Ev3ExecutionPlugin } from '../../conductor/plugins/Ev3ExecutionPlugin';

declare const self: DedicatedWorkerGlobalScope;

const conduit = new Conduit(self, false);
conduit.registerPlugin(Ev3ExecutionPlugin);
