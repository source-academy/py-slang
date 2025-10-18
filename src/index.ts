import { initialise } from "@sourceacademy/conductor/runner";
import PyEvaluator from "./conductor/PyEvaluator";
import { PyContext } from "./cse-machine/py_context";
import { PyRunInContext } from "./runner/pyRunner";
import { Finished } from "./types";

export * from "./errors";
import * as fs from "fs";

if (require.main === module) {
    (async () => {
      if (process.argv.length < 3) {
        console.error("Usage: npm run start:dev -- <python-file>");
        process.exit(1);
      }
      const options = {};
      const context = new PyContext();

      const filePath = process.argv[2];
  
      try {
        //await loadModulesFromServer(context, "http://localhost:8022");

        const code = fs.readFileSync(filePath, "utf8") + "\n";
        console.log(`Parsing Python file: ${filePath}`);
  
        const result = await PyRunInContext(code, context, options);
        console.info(result);
        console.info((result as Finished).value);
        console.info((result as Finished).representation.toString());
  
      } catch (e) {
        console.error("Error:", e);
      }

    })();
}
const {runnerPlugin, conduit} = initialise(PyEvaluator);
