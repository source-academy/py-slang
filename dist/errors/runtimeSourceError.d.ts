import { ErrorSeverity, ErrorType, SourceError } from '../types';
import * as es from 'estree';
export declare const UNKNOWN_LOCATION: es.SourceLocation;
export declare class RuntimeSourceError implements SourceError {
    type: ErrorType;
    severity: ErrorSeverity;
    location: es.SourceLocation;
    message: string;
    constructor(node?: es.Node);
    explain(): string;
    elaborate(): string;
}
