import { EV3Engine } from '../engines/ev3'

async function runSling(code: string) {
  const engine = new EV3Engine()
  return engine.execute(
    code.endsWith('\n') ? code : code + '\n'
  )
}

describe('EV3 Sling smoke test', () => {
  test('sends request to fake sling server', async () => {
    const result = await runSling('1 + 1')

    expect(result).toBeDefined()
    expect(result.status).toBe('finished')
  })
})
