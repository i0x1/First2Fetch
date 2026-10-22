# TypeSafe Jev: API and pricing research

Checked 2026-10-21. This note records first-party documentation. It does not claim that Jev is accurate on this project's jobs; that needs a local evaluation.

## What the model does

TypeSafe's Jev is a **decision model**. It evaluates a supplied `state` against named questions. It returns typed answers, probabilities, and (for Choice and Score) confidence. It does not generate free-form job summaries, explanations, or chat text. Questions can use three main forms: **Noul** (yes/no probability), **Choice** (one of fixed options), and **Score** (ordered rubric). Multiple questions about the same state can be sent in one request and evaluated in parallel. Sources: [Introduction](https://docs.typesafe.ai/introduction), [Noul](https://docs.typesafe.ai/primitives/noul), [Choice](https://docs.typesafe.ai/primitives/choice), [API reference](https://docs.typesafe.ai/api/system-one).

`POST https://api.typesafe.ai/v1/systemone` takes `model`, `state`, and `questions`, with an API key in a Bearer header. `state` can be text or structured JSON, so a job description and candidate criteria can be sent as labeled fields. Answers retain the question names and the response includes token usage. The model treats each request as one state; multiple questions share that state. Sources: [API reference](https://docs.typesafe.ai/api/system-one), [State](https://docs.typesafe.ai/concepts/state).

The [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) is `@typesafe-ai/sdk` and exposes `TypeSafeClient.systemOne`, `choice`, `noul`, and `score`. The SDK page says Node.js 22 or newer; the [quick start](https://docs.typesafe.ai/introduction/quickstart) says Node.js 20 or later, so check the SDK's installed engine requirement before using it in an older runtime. Plain HTTP avoids that dependency.

## Models and price

The [Models page](https://docs.typesafe.ai/models) lists Jev `jev-1.13.0` and `jev-1.14.0`, each at **$0.042 per million input tokens** (or $42 per billion). Output tokens are free. Jev 1.14 was released 2026-10-14. The page currently maps `jev-latest` to `jev-1.13.0` and `jev-preview` to `jev-1.14.0`. Aliases can move without a code change; pin a version after validating thresholds. Default context limits are 64,000 tokens per request and 32,000 per question. Long context is available via a request header, but TypeSafe says it is slower and less accurate. `GET /v1/models` lists names available to the authenticated account. Source: [Models](https://docs.typesafe.ai/models).

At the published rate, cost is `input_tokens × $0.042 / 1,000,000`. For example, 1,000 input tokens cost $0.000042, and 100,000 such calls cost $4.20. This is the Jev charge only; any downstream chat model, job fetch, storage, or network charge is additional. The actual bill requires measured input tokens and call volume. Source for rate: [Models](https://docs.typesafe.ai/models).

## Design guidance and limits

TypeSafe recommends narrow questions and code that combines their outputs. Its [intent routing pattern](https://docs.typesafe.ai/patterns/intent-routing) uses a fast classification to choose deterministic code, a specialist LLM, or human review. Its [confidence routing pattern](https://docs.typesafe.ai/patterns/confidence-routing) uses thresholds chosen for the cost of a wrong action. For Noul, the single `noul` value is the yes probability; it has no separate confidence value. Source: [Noul](https://docs.typesafe.ai/primitives/noul).

The vendor's [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) say to perform counting, arithmetic, and date comparison in code; reduce irrelevant text in `state`; use explicit criteria and test boundary cases; and use a generative model when text generation is required. TypeSafe notes that Jev is trained mainly on English and other languages need local testing. The documentation says Jev does not train on customer requests or responses, and directs readers to its legal terms for retention details. Source: [Models](https://docs.typesafe.ai/models).

## Access and unknowns

The supplied [console URL](https://console.typesafe.ai/home) redirects to sign-in when viewed without the user's session. The organization's available models, rate limits (requests and tokens per second), balance, and observed latency could not be verified. TypeSafe says those limits are shown in the console and that exceeding them returns HTTP 429. Source: [Models](https://docs.typesafe.ai/models). No authenticated API calls or billable benchmark requests were made for this note.
