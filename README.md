# Browserflow for n8n

Run your published Browserflow automations, map their inputs, and use structured
results in the next step of your n8n workflow.

This package connects to the current Browserflow platform at
[browserflow.io](https://browserflow.io). It is separate from the existing
`n8n-nodes-browserflow` package for the earlier platform and LinkedIn operations.
It does not replace or migrate those nodes or credentials.

Package: `n8n-nodes-browser-flow`. The node appears as **Browserflow**.
This initial version is being prepared for publication and n8n verification;
availability in n8n Cloud is not yet established.

## Requirements

- A Browserflow account with subscription access and at least one successfully
  tested, published flow. Draft flows do not appear in n8n.
- A self-hosted n8n installation that supports community nodes, or n8n Cloud once
  this package has been verified and made available by n8n.
- Browserflow must allow your exact n8n OAuth callback URL. Standard HTTPS n8n
  Cloud callbacks are supported; self-hosted callbacks require registration by
  the Browserflow operator. Contact support before connecting a new host.

## Install

Once the package is published, install `n8n-nodes-browser-flow` through
**Settings → Community Nodes** on self-hosted n8n. For development, run
`npm ci` and `npm run dev` from this repository.

## Credentials

1. Add the **Browserflow** node and create a **Browserflow OAuth2 API** credential.
2. Click **Connect**, sign in to Browserflow, and approve the displayed permissions.
3. Return to n8n and select your published flow. Refresh the list if needed.

You do not need to paste an API key or client secret. n8n may show its OAuth
Redirect URL; supply that exact URL to the Browserflow operator for a self-hosted
installation. The public client uses PKCE and has no shared secret.

The connection can list published flows, start runs, and read integration results
in your Browserflow account. Saved login profiles and draft definitions are not
returned. Your mapped inputs and run outputs are processed by your n8n instance.
Disconnect through **Account → Connected apps** in Browserflow. Existing runs may
finish after disconnection, but further API requests are denied.

## Run a flow

1. Select a flow under **Flow Name or ID**.
2. Fill in **Inputs**, or map values from earlier nodes.
3. Execute the workflow. Browserflow runs the published version and n8n waits for
   completion, then returns the flow output as JSON.

Each incoming n8n item starts one run and produces one linked output item.
Named output lists stay arrays. Use n8n's **Split Out** node when you need a
separate item for each row. For output `{"items":[{"name":"Example"}],"count":1}`,
later nodes can use `{{$json.items}}` and `{{$json.count}}`.

Optional input defaults remain on the Browserflow server, including secret
defaults. Omit an optional field to use its published default. After republishing
a flow, refresh its input fields in n8n.

The default wait limit is five minutes. **Options → Timeout (Seconds)** accepts
1–3600 seconds. A timeout or cancelled wait does not cancel the Browserflow run.
Inspect the run in Browserflow before starting another execution. A repeated
request within the same execution, node, loop iteration, and item reuses an
idempotency key. A fresh workflow execution starts a new run. Website actions
are not automatically retried by this node.

Import the [example workflow](examples/run-flow.json), choose your credential and
flow, then map inputs. The example contains no credentials and is inactive.

## Troubleshooting

- **No published flows:** test and publish a flow in the connected Browserflow
  account, then refresh the flow list.
- **Connect or reconnect:** open the credential and connect again if access was
  revoked or the refresh token expired. Access tokens refresh automatically.
- **Subscription required:** check billing in the same hosted Browserflow account.
  A localhost subscription does not grant access to browserflow.io.
- **Callback rejected:** register the exact callback shown by n8n; do not modify
  it or disable PKCE.
- **Run still running:** inspect the existing run before executing the workflow
  again to avoid repeating website actions.
- **Private preview password:** during private review, the Browserflow operator
  supplies preview access separately. Do not put preview passwords in node
  parameters or share them in workflows.

## Development and releases

Use Node.js 24. Run `npm ci`, `npm run check`, and `npm run dev`.
Tests cover input mapping, output linking, polling, failures, cancellation,
idempotency and OAuth defaults. The package check excludes application data,
server code and legacy nodes from publication.

Releases use this repository's manually triggered **Publish Browserflow plugin**
GitHub Actions workflow. The requested version must match `package.json` and
must not exist on npm. See [release preparation](https://github.com/browserflow-io/n8n-nodes-browser-flow/blob/main/RELEASE.md).

## Support and license

For account and callback setup, contact **hello@browserflow.io**.
For reproducible integration issues, use this repository's issue tracker.
Never include credentials, tokens or private website data in a public issue.

MIT. See [LICENSE.md](LICENSE.md).
