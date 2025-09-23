# BestReads MCP Server

BestReads is a Cloudflare Workers-based Model Context Protocol (MCP) server that personalizes book recommendations. It authenticates users with GitHub OAuth, captures their reading taste in Durable Objects, and calls Workers AI to propose what to read next. The server exposes both Streamable HTTP (`/mcp`) and Server-Sent Events (`/sse`) transports so it can plug into MCP-compatible clients.

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dinasaur404/BestReads-MCP-Server)

## Key capabilities

- **OAuth-protected MCP server** – GitHub authentication (via `@cloudflare/workers-oauth-provider`) ensures every tool invocation is associated with a specific user identity.
- **Persistent reader profile** – Each user gets an isolated Durable Object that tracks genres, authors, reading history, and dislikes to continually refine recommendations.
- **AI-generated suggestions** – Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast` by default) turns the saved profile into contextual book suggestions on demand.
- **Multiple MCP transports** – Connect through `/mcp` for streamable HTTP or `/sse` for Server-Sent Events depending on the client’s capabilities.
- **Ready-to-use tool catalog** – Includes helpers for inspecting, updating, and clearing preferences as well as triggering recommendations.

## Architecture overview

| Component | Purpose |
|-----------|---------|
| **Cloudflare Worker** (`src/index.ts`) | Entry point that wires together OAuth, MCP routing, Workers AI access, and Durable Objects. |
| **`MyMCP` Durable Object** | Hosts the MCP agent instance, registers tools, and forwards requests to the per-user storage Durable Object. |
| **`UserBookPreferences` Durable Object** | Persists each user’s genres, authors, reading history, and dislike lists. |
| **Workers AI binding** (`AI`) | Provides text generation for `getBookRecommendations`. |
| **KV namespace** (`OAUTH_KV`) | Stores OAuth state for the GitHub login flow. |
| **GitHub OAuth Handler** (`src/github-handler.ts`) | Implements the OAuth redirect/callback dance using the Workers OAuth Provider SDK. |

The configuration lives in `wrangler.jsonc`. Durable Object migrations are tracked there, and the project opts into `nodejs_compat` to simplify package usage.

## Prerequisites

Before you start, make sure you have:

- **Cloudflare account** with access to Workers, Durable Objects, KV, and Workers AI.
- **GitHub OAuth App** – required for user authentication.
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

### 2. Create and configure a GitHub OAuth App

1. Visit **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Use any application name and homepage URL you prefer.
3. Set the **Authorization callback URL**:
   - For production deployments, use `https://<your-worker-domain>/callback`.
   - During development with `wrangler dev --remote`, use the Cloudflare-provided tunnel URL: `https://<your-dev-subdomain>.workers.dev/callback`.
4. After creating the app, note the **Client ID** and **Client Secret**.
5. (Optional) Generate a 32-byte hex string (e.g., `openssl rand -hex 32`) to use as the cookie encryption key.

### 3. Supply secrets and environment configuration

`wrangler.jsonc` already contains the necessary bindings. You need to provide real values for the secrets at deploy time:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY
```

If you prefer storing them in source control, update the `vars` section in `wrangler.jsonc` instead (not recommended for sensitive values). Make sure the `OAUTH_KV`, `MCP_OBJECT`, `USER_BOOK_PREFERENCES`, and `AI` bindings correspond to resources that exist in your Cloudflare account.

### 4. Run locally

1. Authenticate Wrangler with your Cloudflare account: `wrangler login`.
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Wrangler serves the worker at `http://localhost:8788` by default. Because GitHub cannot call back to `localhost`, use `wrangler dev --remote` (or the `--remote` flag in `npm run dev`) so Cloudflare brokers a public tunnel suitable for the OAuth redirect.
4. After launching the dev server, copy the printed tunnel URL, update your GitHub OAuth app’s callback URL to `https://<tunnel-domain>/callback`, and then initiate the OAuth flow.

You can inspect logs in a second terminal with `wrangler dev --remote --inspect` or `wrangler tail` while the dev server is running.

### 5. Deploy to Cloudflare Workers

```bash
npm run deploy
```

The deployment exposes the following routes (all OAuth-protected unless noted):

- `GET/POST /mcp` – Streamable HTTP MCP transport.
- `GET /sse` – Server-Sent Events transport.
- `/authorize`, `/token`, `/register` – OAuth endpoints managed by the Workers OAuth Provider.

Once deployed, update your MCP client with the production URLs (e.g., `https://bestreads.example.workers.dev/sse`).

## Tool catalog

| Tool | Description | Data touched |
|------|-------------|--------------|
| `getProfile` | Returns the user’s saved preferences, recent reads, and GitHub identity. | Read-only access to the user’s Durable Object state. |
| `addGenre` | Adds a favorite genre (deduplicated, stored lowercase). | Updates `favoriteGenres`. |
| `addFavoriteAuthor` | Records an author the user enjoys. | Updates `favoriteAuthors`. |
| `addBookRead` | Tracks a completed book with timestamp metadata. | Appends to `booksRead`. |
| `addDislikedBook` | Marks a book to avoid in future suggestions. | Appends to `dislikedBooks`. |
| `addDislikedAuthor` | Avoids recommendations from specific authors. | Updates `dislikedAuthors`. |
| `clearPreferences` | Resets the entire profile while retaining the display name. | Reinitializes all preference arrays. |
| `getBookRecommendations` | Calls Workers AI to generate contextualized suggestions. | Reads all preference fields; no writes. |

## Configuration reference

`wrangler.jsonc` exposes the following notable sections:

- `vars` – Default values for GitHub OAuth credentials and cookie key. Override via `wrangler secret put` for production.
- `kv_namespaces` – Binds the `OAUTH_KV` namespace. Create the namespace with `wrangler kv namespace create OAUTH_KV` if you fork the project.
- `durable_objects.bindings` – Maps the MCP coordinator (`MCP_OBJECT`) and per-user storage (`USER_BOOK_PREFERENCES`). Wrangler’s `migrations` array bootstraps the Durable Object classes.
- `ai.binding` – Enables access to Workers AI. You can switch models by editing the `this.env.AI.run` call in `src/index.ts`.
- `dev.port` – Local development port (defaults to `8788`).

## Working with MCP clients

1. Complete the OAuth login by visiting the Worker URL in a browser; GitHub will redirect back and issue a session cookie.
2. Configure your MCP client with one of the transport endpoints:
   - **SSE**: `https://<your-worker>/sse`
   - **Streamable HTTP**: `https://<your-worker>/mcp`
3. The client should now list the BestReads tools. Invoke them to seed genres/authors/books, then run `getBookRecommendations` for tailored suggestions.

If a client does not support cookie-based auth, you can exchange the GitHub OAuth code for a bearer token using the `/token` endpoint and supply it manually—see the [Workers OAuth Provider documentation](https://github.com/cloudflare/workers-oauth-provider) for details.

## Development tips & troubleshooting

- **Type checking** – Run `npm run type-check` to validate the TypeScript source.
- **Generate types** – `npm run cf-typegen` refreshes type definitions for environment bindings.
- **View Durable Object storage** – Use `wrangler do storage get --class UserBookPreferences --id <id>` to inspect a user’s saved profile.
- **Reset a user profile** – Either call the `clearPreferences` tool or delete the Durable Object instance with `wrangler do storage delete`.
- **AI quota errors** – Ensure the Workers AI binding has access to the chosen model and that your account has sufficient quota.
- **OAuth callback mismatch** – Double-check the GitHub OAuth app’s callback URL whenever you change the Worker hostname or dev tunnel address.

## Useful links

- [Model Context Protocol docs](https://modelcontextprotocol.io/introduction)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Workers AI documentation](https://developers.cloudflare.com/workers-ai/)
- [Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)
- [Cloudflare MCP Remote Server guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)

Happy reading! 🪄
