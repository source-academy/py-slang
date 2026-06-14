import type { EV3ExecutionResult, SlingRunRequest } from './types'

class slingClient {
  constructor(
    private endpoint = 'http://localhost:3001/run'
  ) {}

  async run(
    request: SlingRunRequest
  ): Promise<EV3ExecutionResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(
          `Sling server returned ${response.status}`
        )
      }

      return await response.json()
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error
          ? err.message
          : String(err)
      }
    }
  }
}

export {slingClient}