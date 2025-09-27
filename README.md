# BestReads MCP Server

BestReads is a Cloudflare Workers-based Model Context Protocol (MCP) server that personalizes book recommendations. The server is now open to any MCP client and uses the experimental Codemode integration from the `agents` SDK to generate orchestration code for tool execution. Durable Objects retain each visitor's reading preferences while Workers AI provides personalized recommendations.

## Key capabilities

- **Open MCP server** – `/mcp` (streaming HTTP) and `/sse` (Server-Sent Events) endpoints are publicly available without an OAuth flow.
- **Codemode-ready** – The worker exports `globalOutbound` and `CodeModeProxy` bindings and initializes Codemode exactly as in the reference example so generated code can orchestrate tool calls.
- **Persistent reader profile** – Each user gets an isolated Durable Object that tracks genres, authors, reading history, and dislikes to continually refine recommendations.
- **AI-generated suggestions** – Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast` by default) turns the saved profile into contextual book suggestions on demand.
- **Ready-to-use tool catalog** – Includes helpers for inspecting, updating, and clearing preferences as well as triggering recommendations.

## Architecture overview

| Component | Purpose |
|-----------|---------|
| **Cloudflare Worker** (`src/index.ts`) | Entry point that wires together MCP routing, Codemode setup, Workers AI access, and Durable Objects. |
| **`MyMCP` Durable Object** | Hosts the MCP agent instance, registers tools, and forwards requests to the per-user storage Durable Object. |
| **`UserBookPreferences` Durable Object** | Persists each user’s genres, authors, reading history, and dislike lists. |
| **Workers AI binding** (`AI`) | Provides text generation for `getBookRecommendations`. |
| **Codemode exports** (`globalOutbound`, `CodeModeProxy`) | Allow Codemode-generated code to safely invoke MCP tools. |

The configuration lives in `wrangler.jsonc`. Durable Object migrations are tracked there, and the project opts into `nodejs_compat` to simplify package usage.

## Prerequisites

Before you start, make sure you have:

- **Cloudflare account** with access to Workers, Durable Objects, and Workers AI.
- **Node.js 18+** (Workers tooling relies on modern Node features).
- **Wrangler CLI v4** – install globally with `npm install -g wrangler` if needed.
- (Optional) **MCP client** such as Claude Desktop, Cursor, or any client that can connect to MCP servers over HTTP/SSE.

## Getting started

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd bestreads-demo
npm install
```

### 2. Supply secrets and environment configuration

`wrangler.jsonc` already contains the necessary bindings. Provide real values for the Durable Object and Workers AI bindings via `wrangler secret put` or by editing the file if you want defaults in source control.

### 3. Run locally

1. Authenticate Wrangler with your Cloudflare account: `wrangler login`.
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Wrangler serves the worker at `http://localhost:8788` by default.

You can inspect logs in a second terminal with `wrangler dev --remote --inspect` or `wrangler tail` while the dev server is running.

### 4. Deploy to Cloudflare Workers

```bash
npm run deploy
```

The deployment exposes the following routes:

- `GET/POST /mcp` – Streamable HTTP MCP transport.
- `GET /sse` – Server-Sent Events transport.
- `GET /` – Simple JSON metadata response confirming the worker is healthy.

## Tool catalog

| Tool | Description | Data touched |
|------|-------------|--------------|
| `getProfile` | Returns the user’s saved preferences and recent reads. | Read-only access to the user’s Durable Object state. |
| `addGenre` | Adds a favorite genre (deduplicated, stored lowercase). | Updates `favoriteGenres`. |
| `addFavoriteAuthor` | Records an author the user enjoys. | Updates `favoriteAuthors`. |
| `addBookRead` | Tracks a completed book with timestamp metadata. | Appends to `booksRead`. |
| `addDislikedBook` | Marks a book to avoid in future suggestions. | Appends to `dislikedBooks`. |
| `addDislikedAuthor` | Avoids recommendations from specific authors. | Updates `dislikedAuthors`. |
| `clearPreferences` | Resets the entire profile while retaining the display name. | Reinitializes all preference arrays. |
| `getBookRecommendations` | Calls Workers AI to generate contextualized suggestions. | Reads all preference fields; no writes. |

## Configuration reference

`wrangler.jsonc` exposes the following notable sections:

- `durable_objects.bindings` – Maps the MCP coordinator (`MCP_OBJECT`) and per-user storage (`USER_BOOK_PREFERENCES`). Wrangler’s `migrations` array bootstraps the Durable Object classes.
- `ai.binding` – Enables access to Workers AI. You can switch models by editing the `this.env.AI.run` call in `src/index.ts`.
- `dev.port` – Local development port (defaults to `8788`).

## Working with MCP clients

1. Configure your MCP client with one of the transport endpoints:
   - **SSE**: `https://<your-worker>/sse`
   - **Streamable HTTP**: `https://<your-worker>/mcp`
2. The client should now list the BestReads tools. Invoke them to seed genres/authors/books, then run `getBookRecommendations` for tailored suggestions.

Because authentication has been removed, any client can connect and experiment with the tools immediately.

## Development tips & troubleshooting

- **Type checking** – Run `npm run type-check` to validate the TypeScript source.
- **Generate types** – `npm run cf-typegen` refreshes type definitions for environment bindings.
- **View Durable Object storage** – Use `wrangler do storage get --class UserBookPreferences --id <id>` to inspect a user’s saved profile.
- **Reset a user profile** – Either call the `clearPreferences` tool or delete the Durable Object instance with `wrangler do storage delete`.
- **AI quota errors** – Ensure the Workers AI binding has access to the chosen model and that your account has sufficient quota.

## Useful links

- [Model Context Protocol docs](https://modelcontextprotocol.io/introduction)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Workers AI documentation](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare MCP Remote Server guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)

Happy reading! 🪄
