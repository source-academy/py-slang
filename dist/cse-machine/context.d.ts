import * as es from 'estree';
import { Stash } from './stash';
import { Control } from './control';
import { Environment } from './environment';
import { CseError } from './error';
import { Node, StatementSequence } from './types';
import { NativeStorage } from '../types';
export declare class Context {
    control: Control;
    stash: Stash;
    errors: CseError[];
    runtime: {
        break: boolean;
        debuggerOn: boolean;
        isRunning: boolean;
        environmentTree: EnvTree;
        environments: Environment[];
        nodes: Node[];
        control: Control | null;
        stash: Stash | null;
        objectCount: number;
        envStepsTotal: number;
        breakpointSteps: number[];
        changepointSteps: number[];
    };
    /**
     * Used for storing the native context and other values
     */
    nativeStorage: NativeStorage;
    constructor(program?: es.Program | StatementSequence, context?: Context);
    createGlobalEnvironment: () => Environment;
    createEmptyRuntime: () => {
        break: boolean;
        debuggerOn: boolean;
        isRunning: boolean;
        environmentTree: EnvTree;
        environments: never[];
        value: undefined;
        nodes: never[];
        control: null;
        stash: null;
        objectCount: number;
        envSteps: number;
        envStepsTotal: number;
        breakpointSteps: never[];
        changepointSteps: never[];
    };
    reset(program?: es.Program | StatementSequence): void;
    copy(): Context;
    private copyEnvironment;
}
export declare class EnvTree {
    private _root;
    private map;
    get root(): EnvTreeNode | null;
    insert(environment: Environment): void;
    getTreeNode(environment: Environment): EnvTreeNode | undefined;
}
export declare class EnvTreeNode {
    readonly environment: Environment;
    parent: EnvTreeNode | null;
    private _children;
    constructor(environment: Environment, parent: EnvTreeNode | null);
    get children(): EnvTreeNode[];
    resetChildren(newChildren: EnvTreeNode[]): void;
    private clearChildren;
    private addChildren;
    addChild(newChild: EnvTreeNode): EnvTreeNode;
}
