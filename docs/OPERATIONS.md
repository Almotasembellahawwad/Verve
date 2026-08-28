# Operations runbook

## Environments and secrets

Configure Vercel variables with explicit scopes. Production and Preview must use different Upstash databases/tokens. Provider and Pexels keys remain browser-local BYOK values and must not be added to Vercel or `.env` files, so preview deployments cannot consume shared server-side provider billing keys.

Required for every managed deployment:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_SITE_URL` with an environment-appropriate canonical URL

`.env*` is ignored except `.env.example`. Never commit a token. Rotate a suspected token by creating a replacement in the provider console, updating the scoped Vercel variable, redeploying, verifying `/api/health`, and only then revoking the old token. Preview rotation and Production rotation are separate changes.

The admission adapter uses the [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi). Keep the database REST URL and token from the same environment; a mismatched pair makes the deployment fail closed.

## Health and observability

`GET /api/health` returns the Vercel environment, the source commit (`VERCEL_GIT_COMMIT_SHA`), and configuration readiness without pinging or spending quota on LLM providers. A managed deployment without distributed rate-limit configuration returns HTTP 503.

Generation stages emit one-line JSON logs with `requestId`, `pipelineEvent`, `stageId`, duration/reason metadata, and no brief, API key, generated code, or checkpoint payload. Search one `requestId` to reconstruct stage starts, completions, retries, and degradation. Terminal failures use the same ID through the sanitized error handler.

No Sentry or equivalent exception tracker is wired in this pass. Vercel logs are sufficient for request reconstruction, but alerting, retention, and cross-service tracing remain an explicit gap.

## Deployment and rollback

GitHub Actions runs typecheck, lint, unit tests, production build, and Playwright for every pull request and `main` push. A separate weekly workflow runs the production-dependency audit. To make failures block merge, the GitHub ruleset for `main` must require the `CI / verify` status check; a workflow file cannot enforce that repository setting by itself.

Vercel deployments are traceable through the commit returned by `/api/health`. To restore the immediately previous production deployment:

```bash
vercel rollback
vercel rollback status
```

Verify `/api/health` and the affected route after rollback. When the repaired deployment is ready, restore normal promotion with `vercel promote <deployment-url>`. Note that an instant rollback restores the earlier build's environment snapshot; verify secrets/configuration as part of incident validation.

Command behavior and rollback limits are documented by [Vercel rollback](https://vercel.com/docs/cli/rollback) and [production rollback](https://vercel.com/docs/deployments/rollback-production-deployment).
