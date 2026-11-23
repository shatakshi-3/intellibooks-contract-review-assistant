# IntelliBooks — AI Contract Review Assistant

IntelliBooks is an enterprise-grade AI contract review assistant that performs comprehensive 8-category checklist reviews, verbatim source quote verification, and interactive streaming contract Q&A.

Built on Next.js 16 App Router, Neon PostgreSQL with pgvector, Drizzle ORM, Clerk authentication, private Vercel Blob storage, OpenRouter AI, and the Vercel Workflow SDK for durable asynchronous execution.

> **Zero Docker Guarantee**: IntelliBooks is 100% container-free. It uses zero Dockerfiles, Docker Compose files, devcontainers, Redis, BullMQ, or local container databases. All services are serverless and cloud-native.

---

## Key Features

- **8-Category Contract Review Checklist**:
  1. Parties
  2. Start Date & Term
  3. Payment Terms
  4. Termination
  5. Limitation of Liability
  6. Confidentiality
  7. Governing Law
  8. Auto-Renewal
- **Exhaustive Candidate Coverage**: Hybrid vector search combined with full-text fallback scanning ensures clauses are never falsely marked `not_found`.
- **Verbatim Quote Verification Gate**: Every AI finding is verified against the raw extracted contract text via exact substring matching, mathematically preventing hallucinations.
- **Streaming Contract Chat (RAG)**: Multi-session interactive contract Q&A powered by pgvector cosine similarity and Server-Sent Events (SSE).
- **Prompt Injection Defense**: Contract context is isolated inside `<contract_context>` XML boundaries with strict instruction containment.
- **Durable Vercel Workflows**: Long-running extraction and review jobs execute with durable step boundaries (`"use workflow"`, `"use step"`).
- **Automated QA Evaluation Suite**: 32-case benchmark ground truth matrix measuring Precision, Recall, F1, and Quote Validity across adversarial fixtures.

---

## Architecture Overview

| Component | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript |
| **Proxy / Middleware** | `src/proxy.ts` (Next.js 16 proxy convention) |
| **Authentication** | Clerk (`@clerk/nextjs`) with multi-tenant isolation |
| **Database** | Neon Serverless PostgreSQL with `pgvector` |
| **ORM** | Drizzle ORM + Drizzle Kit |
| **File Storage** | Private Vercel Blob Storage (`@vercel/blob`) |
| **AI Inference** | OpenRouter (`text-embedding-3-small`, `gemini-2.0-flash-001`) |
| **Durable Workflows** | Vercel Workflow SDK (`workflow` package) |
| **Document Extractors**| `pdf-parse`, `mammoth`, UTF-8 text decoder |
| **Styling** | Tailwind CSS + Lucide Icons |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Neon PostgreSQL database with `pgvector` enabled
- Clerk account for authentication
- OpenRouter API key for embeddings and completions
- Vercel account for Blob storage and deployment

### 1. Installation

```bash
git clone <repository-url>
cd intellibooks
pnpm install
```

### 2. Environment Configuration

Create `.env.local` based on `.env.example`:

```bash
# Database (Neon PostgreSQL with pgvector)
DATABASE_URL="postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# OpenRouter AI
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_MODEL="google/gemini-2.0-flash-001"
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"

# Vercel Blob
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

### 3. Database Migrations

Generate and push schema changes to Neon:

```bash
# Push schema directly to Neon database
pnpm db:push

# Or run migrations
pnpm db:migrate

# Open Drizzle Studio to inspect data
pnpm db:studio
```

### 4. Running the Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Quality Verification

IntelliBooks includes a comprehensive automated test suite with 172+ unit, integration, and security tests:

```bash
# Run all unit and integration tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# TypeScript type check
pnpm typecheck

# ESLint code quality
pnpm lint

# Production Next.js build
pnpm build
```

---

## Documentation Index

- [Architecture Reference](file:///Users/shatakshidubey/Downloads/contract%20review/intellibooks/docs/architecture.md)
- [Security & Compliance](file:///Users/shatakshidubey/Downloads/contract%20review/intellibooks/docs/security.md)
- [REST API Specification](file:///Users/shatakshidubey/Downloads/contract%20review/intellibooks/docs/api.md)
- [Evaluation Suite & QA Dashboard](file:///Users/shatakshidubey/Downloads/contract%20review/intellibooks/docs/evaluation.md)

---

## License

MIT License.
