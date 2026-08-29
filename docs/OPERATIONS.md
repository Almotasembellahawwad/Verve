# Operations runbook

## Environments and secrets

Configure Vercel variables with explicit scopes. Production and Preview must use different Upstash databases/tokens. Provider and Pexels keys remain browser-local BYOK values and must not be added to Vercel or `.env` files, so preview deployments cannot consume shared server-side provider billing keys.

Recommended for every managed deployment:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Required for every managed deployment:

- `NEXT_PUBLIC_SITE_URL` with an environment-appropriate canonical URL

`.env*` is ignored except `.env.example`. Never commit a token. Rotate a suspected token by creating a replacement in the provider console, updating the scoped Vercel variable, redeploying, verifying `/api/health`, and only then revoking the old token. Preview rotation and Production rotation are separate changes.

The admission adapter uses the [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi). Keep the database REST URL and token from the same environment. Without both values, Verve uses a process-local memory store and reports `degraded` health so generation and AI development remain usable. This fallback is not globally coordinated across serverless instances. An unavailable configured Upstash store always fails closed.

## Health and observability

`GET /api/health` returns the Vercel environment, the source commit (`VERCEL_GIT_COMMIT_SHA`), and configuration readiness without pinging or spending quota on LLM providers. A managed deployment using the memory fallback returns HTTP 200 with `status: "degraded"`; strict mode without distributed configuration returns HTTP 503.

Generation stages emit one-line JSON logs with `requestId`, `pipelineEvent`, `stageId`, duration/reason metadata, and no brief, API key, generated code, or checkpoint payload. Search one `requestId` to reconstruct stage starts, completions, retries, and degradation. Terminal failures use the same ID through the sanitized error handler.

No Sentry or equivalent exception tracker is wired in this pass. Vercel logs are sufficient for request reconstruction, but alerting, retention, and cross-service tracing remain an explicit gap.

For a quota-free deployment smoke, run `npm run test:load`. It targets `/api/health` by default and can target the safely rejected generation-admission path without a provider key. Configure `VERVE_LOAD_URL`, `VERVE_LOAD_REQUESTS`, `VERVE_LOAD_CONCURRENCY`, `VERVE_LOAD_ROUTE=admission`, and `VERVE_LOAD_P95_MS` when recording an environment benchmark. This is an admission and latency smoke, not proof of provider throughput.

## Deployment and rollback

GitHub Actions runs typecheck, lint, unit tests, production build, and Playwright for every pull request and `main` push. CodeQL, pull-request dependency review, Dependabot, and a weekly production-dependency audit cover the software-supply-chain baseline. Actions are pinned to immutable commit SHAs. To make failures block merge, the GitHub ruleset for `main` must require the `CI / verify` status check; a workflow file cannot enforce that repository setting by itself.

Vercel deployments are traceable through the commit returned by `/api/health`. To restore the immediately previous production deployment:

```bash
vercel rollback
vercel rollback status
```

Verify `/api/health` and the affected route after rollback. When the repaired deployment is ready, restore normal promotion with `vercel promote <deployment-url>`. Note that an instant rollback restores the earlier build's environment snapshot; verify secrets/configuration as part of incident validation.

Command behavior and rollback limits are documented by [Vercel rollback](https://vercel.com/docs/cli/rollback) and [production rollback](https://vercel.com/docs/deployments/rollback-production-deployment).
