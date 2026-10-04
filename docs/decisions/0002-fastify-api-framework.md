# ADR 0002: Fastify as Backend API Framework

## Status

Accepted

## Context

The backend API requires high throughput, minimal overhead, low latency, robust plugin architecture, schema validation integration, and built-in structured logging capabilities.

## Decision

We chose **Fastify** (v5) as the backend framework over alternatives such as Express or NestJS.

Key reasons:

1. **Performance & Low Overhead**: Significantly higher throughput and lower memory footprint compared to legacy Express.
2. **First-Class TypeScript Support**: Native type safety for routes, schemas, request parameters, and response envelopes.
3. **Pino Structured Logging**: Native integration with high-performance structured logging.
4. **Encapsulated Plugin Architecture**: Clean lifecycle hooks (`onRequest`, `onError`, `setNotFoundHandler`) and modular route registration without global monkey-patching.

## Consequences

- **Positive**: Clean asynchronous route handlers; lightweight codebase; straightforward testing using Fastify's in-memory `.inject()` runner without opening TCP sockets.
- **Negative**: Middleware ecosystems from Express require `@fastify/express` adapters if used, but native Fastify plugins exist for all requirements (CORS, cookies, auth).
