import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const [packed] = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
  }),
);
const files = new Set(packed.files.map(({ path }) => path));
assert.equal(pkg.name, "n8n-nodes-browser-flow");
assert.equal(pkg.license, "MIT");
assert.equal(pkg.n8n.strict, true);
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
assert.equal(pkg.n8n.nodes.length, 1);
assert.equal(pkg.n8n.credentials.length, 1);
for (const path of [
  ...pkg.n8n.nodes,
  ...pkg.n8n.credentials,
  "README.md",
  "LICENSE.md",
  "examples/run-flow.json",
]) {
  assert.ok(files.has(path), `Missing package file: ${path}`);
}
for (const path of files) {
  assert.match(
    path,
    /^(dist\/(package\.json$|nodes\/Browserflow\/|credentials\/BrowserflowStudioOAuth2Api\.)|examples\/|package\.json$|README\.md$|LICENSE\.md$)/,
    `Unexpected published file: ${path}`,
  );
  assert.doesNotMatch(
    path,
    /LinkedIn|BrowserflowV2|\.env|\.npmrc|\.data|\.deploy|test-results/i,
  );
}
const example = JSON.parse(readFileSync("examples/run-flow.json", "utf8"));
assert.equal(example.active, false);
assert.ok(example.nodes.every((node) => !node.credentials));
assert.ok(
  example.nodes.some(
    (node) => node.type === `${pkg.name}.browserflow` && node.typeVersion === 1,
  ),
);
console.log(
  `Package boundary verified: ${files.size} files; one node, one OAuth credential, no application or legacy code.`,
);
