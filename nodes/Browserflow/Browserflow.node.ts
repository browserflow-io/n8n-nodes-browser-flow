import { createHash } from "node:crypto";
import {
  NodeApiError,
  NodeOperationError,
  NodeConnectionTypes,
  sleep,
} from "n8n-workflow";
import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeType,
  INodeProperties,
  INodeTypeDescription,
  INodeListSearchResult,
  JsonObject,
  ResourceMapperFields,
} from "n8n-workflow";

type Context = IExecuteFunctions | ILoadOptionsFunctions;
type Flow = {
  id: string;
  name: string;
  inputs: Record<string, { type: string; required: boolean; secret: boolean }>;
};
type Run = {
  id: string;
  flowId: string;
  status: string;
  output?: IDataObject;
  error?: string;
};

async function request(
  ctx: Context,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: IDataObject,
  headers?: Record<string, string>,
) {
  const credentials = await ctx.getCredentials("browserflowStudioOAuth2Api");
  let url: URL;
  try {
    url = new URL(String(credentials.baseUrl));
  } catch {
    throw new NodeOperationError(
      ctx.getNode(),
      "Enter a valid Browserflow URL in your credentials.",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new NodeOperationError(
      ctx.getNode(),
      "Use the Browserflow origin without a path, query, or embedded credentials.",
    );
  }
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new NodeOperationError(
      ctx.getNode(),
      "Use HTTPS for your Browserflow connection. HTTP is only supported for localhost development.",
    );
  }
  return ctx.helpers.httpRequestWithAuthentication.call(
    ctx,
    "browserflowStudioOAuth2Api",
    {
      method,
      url: `${url.origin}/api/v1${path}`,
      body,
      headers,
      json: true,
      timeout: 30000,
      disableFollowRedirect: true,
    },
  );
}

// Normalize request failures to actionable messages for the parameter UI.
async function loadMetadata(ctx: ILoadOptionsFunctions, path: string) {
  try {
    const credentials = await ctx.getCredentials("browserflowStudioOAuth2Api");
    const token = credentials.oauthTokenData as IDataObject | undefined;
    if (!token?.access_token)
      throw new NodeOperationError(
        ctx.getNode(),
        "Browserflow account is not connected",
      );
    return await request(ctx, path);
  } catch (error) {
    const failure = error as {
      message?: string;
      httpCode?: string;
      statusCode?: number;
    };
    const status = Number(failure.httpCode ?? failure.statusCode);
    if (
      status === 401 ||
      /not connected|without access token|invalid.grant/i.test(
        failure.message ?? "",
      )
    )
      throw new NodeOperationError(
        ctx.getNode(),
        "Open your Browserflow credential and click Connect. After connecting, refresh the flow list.",
      );
    if (status === 402)
      throw new NodeOperationError(
        ctx.getNode(),
        "Your Browserflow account needs an active subscription. Check Billing in Browserflow.",
      );
    if (status === 403)
      throw new NodeOperationError(
        ctx.getNode(),
        "Browserflow access was denied. Reconnect your account and approve access to your flows.",
      );
    throw new NodeOperationError(
      ctx.getNode(),
      "Could not load Browserflow flows or inputs. Check that Browserflow is available, then refresh the list.",
    );
  }
}

async function getFlows(this: ILoadOptionsFunctions) {
  const data = (await loadMetadata(this, "/flows")) as { flows: Flow[] };
  if (!data.flows.length)
    return [
      {
        name: "No Published Flows — Publish a Flow in Browserflow First",
        value: "",
      },
    ];
  return data.flows
    .map((flow) => ({ name: flow.name, value: flow.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function searchFlows(
  this: ILoadOptionsFunctions,
  filter?: string,
): Promise<INodeListSearchResult> {
  const options = await getFlows.call(this);
  return {
    results: options.filter(
      (flow) =>
        flow.value &&
        (!filter || flow.name.toLowerCase().includes(filter.toLowerCase())),
    ),
  };
}

function flowIdValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof value.value === "string"
  )
    return value.value;
  return "";
}

async function getInputFields(
  this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
  const flowId = flowIdValue(this.getNodeParameter("flowId", ""));
  if (!flowId) return { fields: [] };
  const flow = (await loadMetadata(
    this,
    `/flows/${encodeURIComponent(flowId)}`,
  )) as Flow;
  return {
    fields: Object.entries(flow.inputs).map(([name, field]) => ({
      id: name,
      displayName: name,
      required: field.required,
      defaultMatch: false,
      display: true,
      type:
        field.type === "number"
          ? "number"
          : field.type === "boolean"
            ? "boolean"
            : "string",
    })),
  };
}

export class Browserflow implements INodeType {
  description: INodeTypeDescription = {
    usableAsTool: true,
    displayName: "Browserflow for Growth Automation",
    name: "browserflow",
    icon: { light: "file:browserflow.svg", dark: "file:browserflow.dark.svg" },
    group: ["transform"],
    version: [1, 1.1],
    description: "Scrape leads, collect market data, and automate sales tasks",
    subtitle: "Run Flow",
    defaults: { name: "Browserflow for Growth Automation" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "browserflowStudioOAuth2Api", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "hidden",
        default: "runFlow",
      },
      {
        displayName: "Flow Name or ID",
        name: "flowId",
        type: "options",
        default: "",
        required: true,
        displayOptions: { show: { "@version": [1] } },
        typeOptions: { loadOptionsMethod: "getFlows" },
        description:
          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
      },
      {
        displayName: "Flow",
        name: "flowId",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        required: true,
        displayOptions: { show: { "@version": [1.1] } },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "searchFlows", searchable: true },
          },
          {
            displayName: "By ID",
            name: "id",
            type: "string",
            placeholder: "e.g. flow-123",
            validation: [
              {
                type: "regex",
                properties: {
                  regex: "^[a-zA-Z0-9_-]+$",
                  errorMessage: "Enter a valid published flow ID.",
                },
              },
            ],
          },
        ],
        description: "Published Browserflow flow to run",
      },
      ...[1, 1.1].map(
        (version): INodeProperties => ({
          displayName: "Inputs",
          name: "inputs",
          type: "resourceMapper",
          noDataExpression: true,
          displayOptions: { show: { "@version": [version] } },
          default: { mappingMode: "defineBelow", value: null },
          typeOptions: {
            loadOptionsDependsOn: [version === 1 ? "flowId" : "flowId.value"],
            resourceMapper: {
              resourceMapperMethod: "getInputFields",
              mode: "add",
              valuesLabel: "Inputs",
              supportAutoMap: false,
              fieldWords: { singular: "input", plural: "inputs" },
              addAllFields: true,
            },
          },
        }),
      ),
      {
        displayName: "Options",
        name: "options",
        type: "collection",
        default: {},
        placeholder: "Add Option",
        options: [
          {
            displayName: "Limit",
            name: "limit",
            type: "number",
            default: 50,
            typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 0 },
            description: "Max number of results to return",
          },
          {
            displayName: "Offset",
            name: "offset",
            type: "number",
            default: 0,
            typeOptions: { minValue: 0, maxValue: 250000, numberPrecision: 0 },
            description:
              "Items to skip per list. Use 0, 100, 200 with Limit 100 for successive batches. Recorded pagination and page limits apply; every batch reruns the recorded actions.",
          },
          {
            displayName: "Timeout (Seconds)",
            name: "timeout",
            type: "number",
            default: 300,
            typeOptions: { minValue: 1, maxValue: 3600 },
            description:
              "How long to wait for the result. A timed-out run may still finish in Browserflow.",
          },
        ],
      },
    ],
  };
  methods = {
    loadOptions: { getFlows },
    listSearch: { searchFlows },
    resourceMapping: { getInputFields },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const output: INodeExecutionData[] = [];
    for (let i = 0; i < this.getInputData().length; i++) {
      try {
        const flowId = flowIdValue(this.getNodeParameter("flowId", i));
        if (!flowId || !/^[\w-]+$/.test(flowId))
          throw new NodeOperationError(
            this.getNode(),
            "Choose a published Browserflow flow.",
            { itemIndex: i },
          );
        const inputs = this.getNodeParameter(
          "inputs.value",
          i,
          {},
        ) as IDataObject | null;
        const runWindow: IDataObject = {};
        for (const [name, min, max] of [
          ["limit", 1, 100],
          ["offset", 0, 250000],
        ] as const) {
          const value = this.getNodeParameter(`options.${name}`, i, null);
          if (value === null || value === undefined) continue;
          if (
            typeof value !== "number" ||
            !Number.isInteger(value) ||
            value < min ||
            value > max
          )
            throw new NodeOperationError(
              this.getNode(),
              `${name} must be an integer between ${min} and ${max}.`,
              { itemIndex: i },
            );
          runWindow[name] = value;
        }
        const seconds = this.getNodeParameter(
          "options.timeout",
          i,
          300,
        ) as number;
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600)
          throw new NodeOperationError(
            this.getNode(),
            "Timeout must be between 1 and 3600 seconds.",
            { itemIndex: i },
          );
        if (this.getExecutionCancelSignal()?.aborted)
          throw new NodeOperationError(
            this.getNode(),
            "Execution cancelled before starting Browserflow.",
            { itemIndex: i },
          );
        const deadline = Date.now() + seconds * 1000;
        // A retry within the same n8n execution must not run browser actions twice.
        const idempotencyKey = createHash("sha256")
          .update(
            JSON.stringify([
              this.getInstanceId(),
              this.getExecutionId(),
              this.getNode().id,
              this.getWorkflowDataProxy(i).$runIndex,
              i,
            ]),
          )
          .digest("hex");
        let run = (await request(
          this,
          `/flows/${encodeURIComponent(flowId)}/runs`,
          "POST",
          { inputs: inputs ?? {}, ...runWindow },
          { "Idempotency-Key": idempotencyKey },
        )) as Run;
        while (!["succeeded", "failed"].includes(run.status)) {
          if (
            !["queued", "running", "validating"].includes(run.status) ||
            !run.id ||
            !/^[\w-]+$/.test(run.id)
          ) {
            throw new NodeOperationError(
              this.getNode(),
              "Browserflow returned an unexpected run response.",
              { itemIndex: i },
            );
          }
          if (this.getExecutionCancelSignal()?.aborted)
            throw new NodeOperationError(
              this.getNode(),
              `Stopped waiting for Browserflow run ${run.id}. The run may still finish in Browserflow.`,
              { itemIndex: i },
            );
          const remaining = deadline - Date.now();
          if (remaining <= 0)
            throw new NodeOperationError(
              this.getNode(),
              `Browserflow run ${run.id} is still ${run.status}. Check it in Browserflow before starting a new execution.`,
              { itemIndex: i },
            );
          await sleep(Math.min(2000, remaining));
          if (Date.now() >= deadline)
            throw new NodeOperationError(
              this.getNode(),
              `Browserflow run ${run.id} is still ${run.status}. Check it in Browserflow before starting a new execution.`,
              { itemIndex: i },
            );
          run = (await request(
            this,
            `/runs/${encodeURIComponent(run.id)}`,
          )) as Run;
        }
        if (run.status === "failed")
          throw new NodeOperationError(
            this.getNode(),
            run.error || `Browserflow run ${run.id} failed.`,
            { itemIndex: i },
          );
        output.push({ json: run.output ?? {}, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        if (error instanceof NodeOperationError)
          throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
        throw new NodeApiError(this.getNode(), error as JsonObject, {
          itemIndex: i,
        });
      }
    }
    return [output];
  }
}
