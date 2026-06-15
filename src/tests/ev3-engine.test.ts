import { EV3Engine } from "../engines/ev3"

async function runEV3(code: string) {
  const engine = new EV3Engine()

  return engine.execute(
    code.endsWith("\n")
      ? code
      : code + "\n"
  )
}

describe("EV3 engine", () => {
  describe("HTTP Sling transport", () => {
    test("basic program reaches fake sling server", async () => {
      const result = await runEV3(
        "x = 1\ny = 2\nx + y\n"
      )

      expect(result).toBeDefined()
      expect(result.status).toBe("finished")
    })

    test("does not throw for arithmetic program", async () => {
      await expect(
        runEV3("1 + 1\n")
      ).resolves.toBeDefined()
    })

    test("does not throw for for-loop program", async () => {
      await expect(
        runEV3(
          "for i in range(3):\n    i\n"
        )
      ).resolves.toBeDefined()
    })

    test("does not throw for function program", async () => {
      await expect(
        runEV3(
          "def add(x, y):\n    return x + y\n\nadd(1, 2)\n"
        )
      ).resolves.toBeDefined()
    })
  })

  describe("fake sling response", () => {
    test("returns finished status", async () => {
      const result = await runEV3("42\n")

      expect(result.status).toBe("finished")
    })

    test("returns fake sling output", async () => {
      const result = await runEV3("42\n")

      expect(result.output).toBe(
        "Fake Sling server received request"
      )
    })
  })
})
