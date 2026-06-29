import { EV3Engine } from "../engines/ev3"

async function runEV3(code: string) {
  const engine = new EV3Engine()
  return engine.execute(
    code.endsWith("\n") ? code : code + "\n"
  )
}

describe("EV3 engine", () => {
  describe("parse and compile", () => {
    test("basic program compiles and returns SVML", async () => {
      const result = await runEV3("x = 1\ny = 2\nx + y\n")
      expect(result).toBeDefined()
      expect(result.status).toBe("finished")
      expect(result.output).toBeDefined()
      console.log("SVML output:", result.output)
    })

    test("arithmetic program compiles successfully", async () => {
      const result = await runEV3("1 + 1\n")
      expect(result.status).toBe("finished")
    })

    test("for-loop program compiles successfully", async () => {
      const result = await runEV3("for i in range(3):\n    i\n")
      expect(result.status).toBe("finished")
    })

    test("function program compiles successfully", async () => {
      const result = await runEV3("def add(x, y):\n    return x + y\n\nadd(1, 2)\n")
      expect(result.status).toBe("finished")
    })

    test("returns error for invalid code", async () => {
      const result = await runEV3("def invalid(:\n")
      expect(result.status).toBe("error")
      expect(result.error).toBeDefined()
    })
  })
})
