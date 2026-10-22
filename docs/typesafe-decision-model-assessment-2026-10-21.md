# TypeSafe decision model assessment (21 October 2026)

## Recommendation

Pilot TypeSafe Jev for the **JD filter** only. Keep the existing chat models for custom job-list extraction and custom JD parsing. Jev returns typed decisions; it does not return the extracted text or summary those two tasks need. Pin a tested Jev version instead of using a moving alias. The provider API and prices are documented in [the companion research note](typesafe-provider-research-2026-10-21.md).

This is a feasibility assessment, not a tested speed claim. The [TypeSafe console](https://console.typesafe.ai/home) requires sign-in. We have not checked the account's model access, rate limits, latency, or a Jev decision against a real job.

A [TypeSafe case study of Jack & Jill](https://typesafe.ai/blog/jack-jill-jev-case-study) reports that replacing Gemini 3.1 Flash-Lite in one candidate screening stage reduced median task time from 20.3 to 10.3 seconds and token cost from $0.755 to $0.092 per 1,000 candidates, with similar recall in its evaluation. This is a vendor-published result for another pipeline. It supports running a pilot, but it is not a speed or accuracy estimate for First2Fetch.

## Fit with the current flow

`scan-job-description` parses a description, then calls `applyAdvancedMatchingFilters`, then saves the result. The filter first checks subscription and company blacklist. If there is a description and a saved `chatgpt_prompt`, it sends the user's criteria, title, company, location, tags, and a description capped at 32,000 characters to the configured chat model. It expects `{ excluded: boolean, reason?: string }`. See [`scan-job-description/index.ts`](../apps/backend/supabase/functions/scan-job-description/index.ts), [`advancedMatching.ts`](../apps/backend/supabase/functions/_shared/advancedMatching.ts), and [`aiHtmlLimits.ts`](../apps/backend/supabase/functions/_shared/aiHtmlLimits.ts).

The existing saved criteria and job description can be reused, but the request format must change. Send labeled criteria and job fields as the Jev `state`, and send a narrow question such as `Does this job clearly violate the user's stated requirements?` as a Noul or two-option Choice. The current chat system prompt and `Return JSON only` instruction do not map directly to Jev. Convert the default interpretation rules into explicit criteria in the state or a documented decision policy. Avoid an ambiguous `match` label: the current app stores the negative decision, `excluded`.

Jev does not generate an exclusion reason. At first, retain the existing chat filter for uncertain decisions and for exclusions that need a specific reason. A final Jev-only exclusion could use a generic reason only if the product accepts it. A stronger later design uses several narrow Jev questions for categories such as location, employment type, and required skills, then derives the reason from the highest-confidence violated category. Keep numeric, salary, years-of-experience, and date comparisons in deterministic code or route them to the chat model until verified: TypeSafe warns that Jev 1.13 can struggle with arithmetic and date comparisons. [TypeSafe Jev limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13), [Noul](https://docs.typesafe.ai/primitives/noul), [State](https://docs.typesafe.ai/concepts/state).

Add TypeSafe as a **JD-filter-only provider** rather than forcing it through `createChatCompletion`. The current `AIProvider` interface and OpenAI-compatible adapter expect chat messages and a text response. A small `JobDecisionProvider` adapter should call `POST /v1/systemone`, validate the typed answer and token usage, and return the app's `excluded` decision. Add a provider key and model entry to the shared catalog, existing encrypted per-provider key storage, Settings UI, and the task resolver. Do not present Jev as an option for `job_list` or `jd_parse`. Add per-task request, token, latency, route, and fallback counts to usage telemetry; `ai_usage_daily` only records daily token and cost totals. [API reference](https://docs.typesafe.ai/api/system-one), [`aiProvider.ts`](../apps/backend/supabase/functions/_shared/aiProvider.ts), [`aiProviderConfig.ts`](../libraries/core/src/aiProviderConfig.ts), [`ai_usage_daily` migration](../apps/backend/supabase/migrations/20240101000007_create_ai_usage_daily.sql).

Validate against saved jobs before switching the filter: compare Jev and chat decisions on a labeled sample with clear matches, clear exclusions, missing details, contradictory criteria, long descriptions, and numeric requirements. Give false exclusions a stricter threshold than false keeps. Route low-confidence or unsupported cases to the current chat filter. Measure end-to-end scan time; the desktop scanner also fetches HTML, processes jobs in chunks of 10, and may spend time in custom parsing and database calls. A faster decision call only shortens the decision part. [`jobScanner.ts`](../apps/desktopProbe/src/server/jobScanner.ts), [TypeSafe confidence routing](https://docs.typesafe.ai/patterns/confidence-routing).

## Observed demand and cost

Read-only counts from the connected **First2Fetch** Supabase project on 21 October 2026 (UTC database dates): 13,901 jobs in total; 823 jobs created in the last 30 days, all since 18 October; 460 of those currently have a description; 129 currently have `excluded_by_advanced_matching` status. On 21 October, the snapshot showed 384 new jobs and about 147 with a description. These are changing counts. A job with a description is only a potential filter request: subscription, saved criteria, blacklist, retries, and previous state also matter. The daily AI ledger showed about 759,000 input tokens, 100,000 output tokens, and $0.62 estimated cost on 21 October, across all AI tasks. It does not identify filter calls or provider invoices. Source: read-only aggregate queries on `public.jobs`, `public.advanced_matching`, and `public.ai_usage_daily` in project `sjxdeuxixacmasfxuaon`.

TypeSafe's published Jev rate is **$0.042 per million input tokens, with free output**. Thus `monthly Jev cost = decision calls × measured input tokens per call × 0.042 / 1,000,000`. [TypeSafe models and pricing](https://docs.typesafe.ai/models).

| Illustrative load | 1,500 input tokens/call | 5,000 input tokens/call |
|---|---:|---:|
| 150 decisions/day for 30 days | $0.28/month | $0.95/month |
| 500 decisions/day for 30 days | $0.95/month | $3.15/month |
| 1,000 decisions/day for 30 days | $1.89/month | $6.30/month |

The 1,500-token case is an assumption, not a measured Jev payload. Today’s job descriptions average about 4,500 characters, before criteria and metadata. Token count varies with content and formatting. At today's roughly 147 described jobs, 1,500 input tokens each would cost about **$0.009** for one Jev pass. An illustrative 10% chat fallback adds its own charge. Retries and failed billable requests may add cost. The live account's actual price terms, credits, and limits need confirmation in the console. Do not multiply the $0.62 daily ledger by a Jev discount: it includes other AI tasks.

## Decision

Feasible for job filtering, with a small adapter and a changed request shape. It cannot replace text extraction or supply the current exclusion reason by itself. Start with a shadow comparison and measured latency and token counts. Enable automatic routing only after the false-exclusion rate and account limits are known.
