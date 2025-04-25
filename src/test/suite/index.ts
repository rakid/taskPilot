import * as path from "path";
import Mocha from "mocha"; // Use default import for Mocha class
import { glob } from "glob"; // Use named import for glob function

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd", // Use TDD interface
    color: true,
    timeout: 10000, // Increase timeout for potentially longer running tests
  });

  const testsRoot = path.resolve(__dirname, ".."); // Correctly point to src/test

  return new Promise((c, e) => {
    // Standard promise executor
    // Immediately Invoked Async Function Expression (IIAFE)
    (async () => {
      try {
        // Use glob asynchronously to find all test files
        const files = await glob("suite/**/*.test.js", { cwd: testsRoot });

        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        // Run the mocha test and handle its result within the async function
        mocha.run((failures: number) => {
          if (failures > 0) {
            // Reject the outer promise if tests fail
            e(new Error(`${failures} tests failed.`));
          } else {
            // Resolve the outer promise if tests pass
            c();
          }
        });
      } catch (err) {
        // Catch errors from glob or synchronous parts of mocha setup
        console.error("Error finding or running tests:", err);
        e(err); // Reject the outer promise on error
      }
    })(); // Immediately invoke the async function
  });
}
