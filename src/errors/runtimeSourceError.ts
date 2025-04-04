import { ErrorSeverity, ErrorType, SourceError } from '../types'
import * as es from 'estree'

// todo
// just put on here temporarily
export const UNKNOWN_LOCATION: es.SourceLocation = {
    start: {
      line: -1,
      column: -1
    },
    end: {
      line: -1,
      column: -1
    }
}

export class RuntimeSourceError implements SourceError {
    public type = ErrorType.RUNTIME
    public severity = ErrorSeverity.ERROR
    public location: es.SourceLocation
    public message = 'Error'
  
    constructor(node?: es.Node) {
      this.location = node?.loc ?? UNKNOWN_LOCATION
    }
  
    public explain() {
      return ''
    }
  
    public elaborate() {
      return this.explain()
    }
}


