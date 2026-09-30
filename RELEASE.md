# Release preparation

Prepared on 30 September 2026. Package: **n8n-nodes-browserflow-studio@1.0.0**.
Repository: **browserflow-io/n8n-nodes-browserflow-studio**. Display name: **Browserflow**.

## Evidence and remaining gates

- Local package build and nine behavioral tests pass; strict n8n lint and package
  boundary checks are part of `npm run check`.
- The actual tarball passed an independent disposable n8n 2.39.8 acceptance test:
  package/credential discovery, PKCE without managed instance overrides or client
  secret, dynamic schemas, real fixture browser output `{ "answer": 42 }`, token
  refresh and revoked-access rejection. The acceptance harness lives in the
  owning Browserflow app (`test/n8n-package.test.mjs`) because it runs the backend
  and its dedicated PostgreSQL test database as well.
- Raf reported a successful hosted workflow with the earlier local adapter. This
  is not a claim that this new package was installed from the npm registry.
- npm publication, registry provenance verification, the published-package n8n
  scanner and Creator Portal review have not yet completed.
- Arrange private-preview access and a review account with a harmless published
  flow. Do not publish preview passwords or account tokens in this repository.
- Coordinate with n8n about the existing LinkedIn listing and the new platform
  listing. Their rules reject duplicate nodes; a separate repository does not
  itself guarantee acceptance. Explain the different API/platform and ownership.

## First npm release

1. Confirm that the npm maintainer represents Browserflow and matches repository
   ownership. Confirm the package name is still available.
2. Run `npm ci --ignore-scripts` and `npm run check`. Push the reviewed commit to
   `main`, and require its **Check Browserflow plugin** workflow to pass.
3. Authorize GitHub Actions to publish. Prefer npm Trusted Publishing. For a new
   package that cannot yet configure a publisher, use an appropriately scoped,
   short-lived npm granular publication token as the `NPM_TOKEN` Actions secret
   (environment `npm` or repository). The account owner creates and enters this
   credential privately; never paste it in chat or commit it.
4. Manually run **Publish Browserflow plugin** from `main`, entering **1.0.0**.
   This checks that the version is unused and publishes with `--provenance`.
   A source push alone does not publish anything. Never publish the first
   verified-node release directly from a local computer.
5. Check the public npm version, repository link, maintainer and provenance
   against the exact GitHub workflow/commit. Then run:

   ```sh
   npm exec --ignore-scripts --yes --package=@n8n/scan-community-package@0.38.0 -- scan-community-package n8n-nodes-browserflow-studio@1.0.0
   ```

   The scanner requires a published npm package. Read the actual result; its
   displayed security-check failure must block submission even if the process
   exits successfully.

6. Install that registry version in a disposable self-hosted n8n and verify a
   hosted test account connection/run. Add npm Trusted Publishing with owner
   `browserflow-io`, repository `n8n-nodes-browserflow-studio`, workflow
   `publish.yml`, environment `npm`. Revoke the bootstrap token after setup.
7. Submit through the Creator Portal only after Raf finishes coordination and
   authorizes submission. Use the prepared text below and current evidence.

For later releases, update the version and lockfile together, run the checks,
push, and manually publish the exact version. npm versions cannot be overwritten.
The app and legacy LinkedIn node have independent release histories.

## Creator Portal handoff text

Use after npm publication and the remaining checks above. Do not claim n8n has
already approved the split or that private-preview access is public.

> We would like to submit Browserflow for the current browserflow.io platform.
> Package: n8n-nodes-browserflow-studio. Source:
> https://github.com/browserflow-io/n8n-nodes-browserflow-studio.
>
> This integration lets users connect their Browserflow account with OAuth2 PKCE,
> choose a published browser automation, map its typed inputs and receive
> structured JSON output. Tokens refresh automatically and access can be revoked
> in Browserflow. No API key or shared client secret is entered by the user.
>
> The existing n8n-nodes-browserflow integration serves the previous platform and
> LinkedIn operations. It has separate source and existing users. This new
> package uses the current platform API and does not migrate or replace existing
> workflows. Please confirm the appropriate separate listing and naming for
> these two platform generations.
>
> The repository includes an MIT license, English setup instructions, an example
> workflow, behavioral tests, strict n8n lint and GitHub Actions provenance
> publication. We can arrange private review access and a harmless test flow.
> Browserflow contact: hello@browserflow.io.

## Official requirements

- [Submission and GitHub Actions provenance](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes)
- [Technical verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines)
- [n8n Creator Portal](https://creators.n8n.io/nodes)
