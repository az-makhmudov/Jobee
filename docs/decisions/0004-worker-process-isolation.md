# ADR 0004: Background Worker Process Isolation

## Status

Accepted

## Context

The AI Job Agent roadmap includes long-running asynchronous workflows: periodic job portal scraping, batch AI relevance scoring, mailbox polling, and headless browser automation (Playwright).
Running these CPU- and memory-intensive workflows inside the same process as the user-facing HTTP API introduces high risk of latency spikes, thread starvation, and complete API crashes upon memory exhaustion.

## Decision

We established `apps/worker` as an independent operating system process separated from `apps/api`.

- The worker executes as a distinct Node.js process with its own bootstrap, logging context, and lifecycle hooks.
- It shares domain schemas, database connection pooling, and configuration validation through workspace packages.
- Future browser automation (Playwright) will further be isolated into a dedicated sandbox within the worker domain.

## Consequences

- **Positive**: Complete process resilience—crashes or memory leaks in asynchronous tasks cannot bring down the web interface or API; both processes can be scaled or restarted independently.
- **Negative**: Requires launching two backend processes in development (`npm run dev:api` and `npm run dev:worker`), which is simplified by the root `npm run dev` script.
