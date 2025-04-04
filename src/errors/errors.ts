import * as es from 'estree'
import { ErrorType, SourceError } from '../types'
import { RuntimeSourceError } from './runtimeSourceError';

export class TypeConcatenateError extends RuntimeSourceError {
    constructor(node: es.Node) {
        super(node);
        this.type = ErrorType.TYPE;
    }

    public explain(): string {
        return `TypeError: can only concatenate str (not "int") to str.`;
    }

    public elaborate(): string {
        return `You are trying to concatenate a string with an integer. To fix this, convert the integer to a string using str(), or ensure both operands are of the same type.`;
    }
}

export class MissingRequiredPositionalError extends RuntimeSourceError {
    private functionName: string;
    private missingParamCnt: number;
    private missingParamName: string;
  
    constructor(node: es.Node, functionName: string, params: es.Pattern[], args: any) {
        super(node);
        this.type = ErrorType.TYPE;
        this.functionName = functionName;
        this.missingParamCnt = params.length - args.length;
        const missingNames: string[] = [];
        for (let i = args.length; i < params.length; i++) {
            const param = params[i] as es.Identifier;
            missingNames.push("\'"+param.name+"\'");
        }
        this.missingParamName = this.joinWithCommasAndAnd(missingNames);
    }
  
    public explain(): string {
      return `TypeError: ${this.functionName}() missing ${this.missingParamCnt} required positional argument: ${this.missingParamName}`;
    }
  
    public elaborate(): string {
      return `You called ${this.functionName}() without providing the required positional argument ${this.missingParamName}. Make sure to pass all required arguments when calling ${this.functionName}.`;
    }

    private joinWithCommasAndAnd(names: string[]): string {
        if (names.length === 0) {
          return '';
        } else if (names.length === 1) {
          return names[0];
        } else if (names.length === 2) {
          return `${names[0]} and ${names[1]}`;
        } else {
          const last = names.pop();
          return `${names.join(', ')} and ${last}`;
        }
    }
}

export class TooManyPositionalArgumentsError extends RuntimeSourceError {
    private functionName: string;
    private expectedCount: number;
    private givenCount: number;
  
    constructor(node: es.Node, functionName: string, params: es.Pattern[], args: any) {
      super(node);
      this.type = ErrorType.TYPE;
      this.functionName = functionName;
      this.expectedCount = params.length;
      this.givenCount = args.length;
    }
  
    public explain(): string {
      return `TypeError: ${this.functionName}() takes ${this.expectedCount} positional arguments but ${this.givenCount} were given`;
    }
  
    public elaborate(): string {
      return `You called ${this.functionName}() with ${this.givenCount} positional arguments, but it only expects ${this.expectedCount}. Make sure to pass the correct number of arguments when calling ${this.functionName}.`;
    }
}
