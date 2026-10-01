const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Browserflow } = require("../dist/nodes/Browserflow/Browserflow.node");
const {
  BrowserflowStudioOAuth2Api,
} = require("../dist/credentials/BrowserflowStudioOAuth2Api.credentials");
const node = new Browserflow();

function context(
  parameters = {},
  responder = async () => ({
    id: "run-1",
    status: "succeeded",
    output: { answer: 42 },
  }),
) {
  const calls = [];
  return {
    calls,
    getNode: () => ({
      id: "node-1",
      name: "Browserflow",
      type: "@browserflow/n8n-nodes-browser-flow.browserflow",
      typeVersion: 1,
      parameters: {},
    }),
    getInstanceId: () => parameters.instance ?? "instance-1",
    getExecutionId: () => "execution-1",
    getWorkflowDataProxy: () => ({ $runIndex: parameters.runIndex ?? 0 }),
    getExecutionCancelSignal: () => ({ aborted: !!parameters.aborted }),
    getCredentials: async () => ({
      baseUrl: parameters.baseUrl ?? "https://browserflow.example",
      oauthTokenData: parameters.disconnected
        ? undefined
        : { access_token: "fixture" },
    }),
    getInputData: () =>
      Array.from({ length: parameters.count ?? 1 }, () => ({ json: {} })),
    getNodeParameter(name, index, fallback) {
      return (
        parameters[name] ??
        {
          flowId: "flow-1",
          "inputs.value": { query: "test", enabled: false, limit: 0 },
        }[name] ??
        fallback
      );
    },
    continueOnFail: () => !!parameters.continue,
    helpers: {
      httpRequestWithAuthentication: async function (credential, options) {
        calls.push({ credential, ...options });
        return responder(options, calls.length);
      },
    },
  };
}

test("standalone node exposes only the new platform and its own OAuth credential", () => {
  assert.equal(node.description.name, "browserflow");
  assert.equal(node.description.version, 1);
  assert.equal(
    node.description.credentials[0].name,
    "browserflowStudioOAuth2Api",
  );
  assert.equal(
    new BrowserflowStudioOAuth2Api().test.request.url,
    "/api/v1/flows",
  );
});
test("lists flows, maps published typed inputs and handles no-input flows", async () => {
  const ctx = context({}, async (options) =>
    options.url.endsWith("/flows")
      ? {
          flows: [
            { id: "z", name: "Z" },
            { id: "a", name: "A" },
          ],
        }
      : {
          inputs: {
            price: { type: "number", required: true },
            optional: { type: "boolean", required: false },
          },
        },
  );
  assert.deepEqual(await node.methods.loadOptions.getFlows.call(ctx), [
    { name: "A", value: "a" },
    { name: "Z", value: "z" },
  ]);
  const fields = await node.methods.resourceMapping.getInputFields.call(ctx);
  assert.equal(fields.fields[0].type, "number");
  assert.equal(fields.fields[1].required, false);
  const empty = context({}, async () => ({ inputs: {} }));
  assert.deepEqual(
    await node.methods.resourceMapping.getInputFields.call(empty),
    { fields: [] },
  );
});
test("returns direct JSON output with item pairing and separate idempotency keys", async () => {
  const ctx = context({ count: 2 });
  const [items] = await node.execute.call(ctx);
  assert.deepEqual(items, [
    { json: { answer: 42 }, pairedItem: { item: 0 } },
    { json: { answer: 42 }, pairedItem: { item: 1 } },
  ]);
  assert.deepEqual(ctx.calls[0].body, {
    inputs: { query: "test", enabled: false, limit: 0 },
  });
  assert.notEqual(
    ctx.calls[0].headers["Idempotency-Key"],
    ctx.calls[1].headers["Idempotency-Key"],
  );
  const retry = context();
  await node.execute.call(retry);
  assert.equal(
    ctx.calls[0].headers["Idempotency-Key"],
    retry.calls[0].headers["Idempotency-Key"],
  );
  const loop = context({ runIndex: 1 });
  await node.execute.call(loop);
  assert.notEqual(
    ctx.calls[0].headers["Idempotency-Key"],
    loop.calls[0].headers["Idempotency-Key"],
  );
  const otherInstance = context({ instance: "other" });
  await node.execute.call(otherInstance);
  assert.notEqual(
    ctx.calls[0].headers["Idempotency-Key"],
    otherInstance.calls[0].headers["Idempotency-Key"],
  );
  assert.equal(ctx.calls[0].credential, "browserflowStudioOAuth2Api");
});
test("waits for completion using authenticated GETs on the configured origin", async () => {
  const ctx = context({}, async (_, count) =>
    count === 1
      ? {
          id: "run-1",
          status: "queued",
          resultUrl: "https://untrusted.example",
        }
      : { id: "run-1", status: "succeeded", output: { rows: [{ name: "A" }] } },
  );
  assert.deepEqual((await node.execute.call(ctx))[0][0].json, {
    rows: [{ name: "A" }],
  });
  assert.equal(ctx.calls.length, 2);
  assert.equal(
    ctx.calls[1].url,
    "https://browserflow.example/api/v1/runs/run-1",
  );
  assert.equal(ctx.calls[1].method, "GET");
});
test("failed runs and HTTP errors fail the node; continue-on-fail preserves pairing", async () => {
  await assert.rejects(
    () =>
      node.execute.call(
        context({}, async () => ({
          status: "failed",
          error: "Website login expired",
        })),
      ),
    /Website login expired/,
  );
  const ctx = context({ count: 2, continue: true }, async (_, count) => {
    if (count === 1) throw new Error("Access denied");
    return { status: "succeeded", output: { ok: true } };
  });
  const [items] = await node.execute.call(ctx);
  assert.equal(items[0].json.error, "Access denied");
  assert.deepEqual(items[1], { json: { ok: true }, pairedItem: { item: 1 } });
});
test("timeout and cancellation do not resubmit browser actions", async () => {
  const ctx = context({ "options.timeout": 1 }, async () => ({
    id: "run-1",
    status: "running",
  }));
  await assert.rejects(() => node.execute.call(ctx), /Check it in Browserflow/);
  assert.equal(ctx.calls.filter((call) => call.method === "POST").length, 1);
  const canceled = context({ aborted: true }, async () => ({
    id: "run-1",
    status: "queued",
  }));
  await assert.rejects(
    () => node.execute.call(canceled),
    /Execution cancelled/,
  );
  assert.equal(canceled.calls.length, 0);
});
test("invalid flow IDs and insecure remote URLs never receive credentials", async () => {
  for (const parameters of [
    { flowId: "../other" },
    { baseUrl: "http://remote.example" },
    { baseUrl: "https://user:secret@remote.example" },
    { baseUrl: "https://remote.example/path" },
  ]) {
    const ctx = context(parameters);
    await assert.rejects(() => node.execute.call(ctx));
    assert.equal(ctx.calls.length, 0);
  }
});

test("OAuth defaults need no pasted credentials and use the confirmed production origin", () => {
  const credential = new BrowserflowStudioOAuth2Api();
  assert.deepEqual(credential.extends, ["oAuth2Api"]);
  const defaults = Object.fromEntries(
    credential.properties.map((p) => [p.name, p.default]),
  );
  assert.equal(defaults.baseUrl, "https://browserflow.io");
  assert.equal(defaults.grantType, "pkce");
  assert.equal(defaults.clientId, "browserflow-n8n");
  assert.equal(defaults.clientSecret, "");
  assert.ok(credential.properties.every((p) => p.type === "hidden"));
});

test("metadata shows useful connection errors and an empty published-flow hint", async () => {
  const disconnected = context({ disconnected: true });
  await assert.rejects(
    () => node.methods.loadOptions.getFlows.call(disconnected),
    /click Connect/,
  );
  assert.equal(disconnected.calls.length, 0);
  const empty = context({}, async () => ({ flows: [] }));
  const options = await node.methods.loadOptions.getFlows.call(empty);
  assert.match(options[0].name, /No Published Flows/);
  assert.equal(options[0].value, "");
  for (const [httpCode, expected] of [
    ["401", /click Connect/],
    ["402", /active subscription/],
    ["403", /access was denied/],
    ["500", /Check that Browserflow is available/],
  ]) {
    const broken = context({}, async () => {
      throw Object.assign(new Error("[object Object]"), { httpCode });
    });
    await assert.rejects(
      () => node.methods.loadOptions.getFlows.call(broken),
      expected,
    );
    await assert.rejects(
      () => node.methods.resourceMapping.getInputFields.call(broken),
      expected,
    );
  }
});

test("maps batch options separately from website inputs and rejects invalid windows", async () => {
  const ctx = context({ "options.limit": 25, "options.offset": 50 });
  await node.execute.call(ctx);
  assert.equal(ctx.calls[0].body.limit, 25);
  assert.equal(ctx.calls[0].body.offset, 50);
  assert.equal(ctx.calls[0].body.inputs.limit, 0);
  const defaults = context();
  await node.execute.call(defaults);
  assert.equal(Object.hasOwn(defaults.calls[0].body, "limit"), false);
  assert.equal(Object.hasOwn(defaults.calls[0].body, "offset"), false);
  const firstBatch = context({ "options.limit": 100, "options.offset": 0 });
  await node.execute.call(firstBatch);
  assert.deepEqual(firstBatch.calls[0].body, {
    inputs: { query: "test", enabled: false, limit: 0 },
    limit: 100,
    offset: 0,
  });
  const offsetOnly = context({ "options.offset": 250000 });
  await node.execute.call(offsetOnly);
  assert.equal(offsetOnly.calls[0].body.offset, 250000);
  assert.equal(Object.hasOwn(offsetOnly.calls[0].body, "limit"), false);
  for (const [name, value] of [
    ["limit", 0],
    ["limit", 1.5],
    ["limit", 101],
    ["limit", "25"],
    ["limit", NaN],
    ["offset", -1],
    ["offset", 0.5],
    ["offset", Infinity],
    ["offset", 250001],
  ]) {
    const invalid = context({ [`options.${name}`]: value });
    await assert.rejects(node.execute.call(invalid), /must be an integer/);
    assert.equal(invalid.calls.length, 0);
  }
});
