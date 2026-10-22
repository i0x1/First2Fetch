# Gemini model choices (21 October 2026)

The app has three separate model settings in **Settings → AI providers**. New settings use Gemini 3.1 Flash-Lite for JD filtering and custom JD parsing, and Gemini 3.8 Flash for custom job-list extraction. Saved choices are not changed. All three tasks use the same direct Gemini API key if Google Gemini is selected.

## Current standard-tier prices

These are Google Gemini Developer API paid **Standard** prices in USD per 1 million text tokens. Output includes thinking tokens. Credits can reduce the amount charged to the account, but do not change these unit prices. Free-tier and other service-tier limits and prices differ.

| Model ID | Input | Output | Role in this app |
|---|---:|---:|---|
| `gemini-3.1-flash-lite` | $0.25 | $1.50 | Lowest-cost current-generation choice for JD filtering and first-pass JD parsing |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | Alternate if it produces better parsing results on a sample |
| `gemini-3.8-flash` | $0.75 | $3.75 | Stronger choice for irregular custom listing pages; introductory price through 31 December 2026 |
| `gemini-2.5-flash-lite` | $0.10 | $0.40 | Cheaper legacy option if this Gemini project still has access |

Google limits 2.5 model access for new projects. The app retains its 2.5 entries so existing saved choices continue to work. Gemini 2.0 Flash was shut down on 1 June 2026 and is removed from the catalog. Gemini 3.8 Flash is scheduled to rise to $1.50 input and $7.50 output per million tokens on 1 January 2027.

Sources: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [model list](https://ai.google.dev/gemini-api/docs/models), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [SDK migration](https://ai.google.dev/gemini-api/docs/migrate).

## Suggested starting choices

| Task | Start with | When to try another model |
|---|---|---|
| JD filter | `gemini-3.1-flash-lite` | Try `gemini-3.8-flash` only if a review sample shows material false exclusions or missed matches. |
| Custom job-list scraping | `gemini-3.8-flash` | Try `gemini-3.1-flash-lite` on representative pages if every required card and URL is extracted accurately. |
| Custom JD parsing | `gemini-3.1-flash-lite` | Try `gemini-3.5-flash-lite`, then `gemini-3.8-flash`, if it misses content or emits invalid JSON on a review sample. |

The ordinary job boards use site-specific parsers. The job-list and JD-parse AI settings apply to **custom** sites. The JD filter runs only when advanced matching is enabled and a job has both a description and a saved filter prompt. Custom job-list pages are skipped for 24 hours after a successful scrape unless a scan is forced. Up to 25 custom links are allowed per user.

## Cost examples

These are illustrative paid Standard costs **per 1,000 calls**, before credits. The input and output token counts are assumptions, not measured production averages. Retries, failed responses, and thinking tokens can increase cost. The application does not yet store per-task request totals or per-task token histories, so it cannot derive an exact monthly bill from the job count.

| Task | Assumed tokens per call (input / output) | Suggested model | Estimated cost per 1,000 calls |
|---|---:|---|---:|
| JD filter | 1,500 / 100 | 3.1 Flash-Lite | $0.53 |
| Custom job list | 15,000 / 3,000 | 3.8 Flash | $22.50 |
| Custom JD parse | 5,000 / 1,500 | 3.1 Flash-Lite | $3.50 |

At the cap of 25 custom links, one successful list scan per link per day is at most about 750 list calls in a 30-day month, or about **$16.88** with the example token sizes and 3.8 Flash. Forced scans and retries can add calls. The 13,078 jobs recorded on 15 October 2026 are a cumulative database count; they do not establish how many calls any of the three tasks made in one month.

Use this formula with measured usage after a small controlled run: `calls × (input tokens × input price + output tokens × output price) / 1,000,000`. Compare model output on the same saved pages and JDs before changing a task's saved choice.
