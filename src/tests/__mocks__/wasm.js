// Stub for .wasm files in Jest. Sinter WASM cannot run in Node; the evaluator
// test catches the resulting error and checks that either a result or error was sent.
module.exports = () => Promise.reject(new Error("WASM not available in test environment"));
