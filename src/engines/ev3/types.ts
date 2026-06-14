export type EV3ExecutionResult = {
  status: 'finished' | 'error'
  output?: string
  error?: string
}

export type SlingRunRequest = {
  code: string
  svml?: unknown
}
