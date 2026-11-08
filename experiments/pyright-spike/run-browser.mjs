// Serves web/ + the worker bundle over HTTP and runs the case corpus in a real browser engine.
//   node run-browser.mjs [chromium|firefox|webkit] [build/worker.min.js]
import http from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import pw from "playwright-core";

const engine = process.argv[2] ?? "chromium";
const workerPath = process.argv[3] ?? "build/worker.min.js";
// A fixed table of the files the page needs: no path is built from the request.
const routes = {
  "/": ["web/index.html", "text/html"],
  "/checker.js": ["web/checker.js", "text/javascript"],
  "/worker.js": [workerPath, "text/javascript"],
};
const server = http.createServer((req, res) => {
  const route = Object.hasOwn(routes, req.url) ? routes[req.url] : undefined;
  if (!route) {
    res.writeHead(404).end();
    return;
  }
  const [file, contentType] = route;
  res.writeHead(200, { "content-type": contentType, "content-encoding": "gzip" });
  res.end(gzipSync(readFileSync(file)));
});
// Loopback only: the server is for the local browser that Playwright starts.
await new Promise(r => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await pw[engine].launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("pageerror", e.message));
const tNav = Date.now();
await page.goto(url);
const prelude = readFileSync("prelude/__builtins__.pyi", "utf8");
const startup = await page.evaluate(async prelude => {
  const t = performance.now();
  window.checker = await createChecker({
    workerUrl: "/worker.js",
    files: { "__builtins__.pyi": prelude },
    config: {},
  });
  return performance.now() - t;
}, prelude);
console.log(
  `${engine} ${await browser.version()}  worker ${workerPath} (${(statSync(workerPath).size / 1e6).toFixed(1)} MB raw)`,
);
console.log(
  `  page load + worker startup: ${startup.toFixed(0)} ms (nav ${Date.now() - tNav} ms incl.)`,
);
for (const name of readdirSync("cases")
  .filter(f => f.endsWith(".py"))
  .sort()) {
  const text = readFileSync(`cases/${name}`, "utf8");
  const { diagnostics, ms } = await page.evaluate(([n, t]) => checker.check(n, t), [name, text]);
  const errs = diagnostics.filter(d => d.severity === 1).map(d => d.range.start.line + 1);
  console.log(
    `  ${name.padEnd(22)} ${ms.toFixed(0).padStart(4)} ms  error lines: ${[...new Set(errs)].join(",") || "-"}`,
  );
}
// re-check timing (incremental edit of a typical program)
const t = readFileSync("cases/ok_state.py", "utf8");
const times = [];
for (let i = 0; i < 5; i++)
  times.push(
    (await page.evaluate(([n, s]) => checker.check(n, s), ["ok_state.py", t + `\nprint(${i})\n`]))
      .ms,
  );
console.log(
  `  re-check after edit (ok_state.py, 5x): ${times.map(x => x.toFixed(0)).join(", ")} ms`,
);
await browser.close();
server.close();
