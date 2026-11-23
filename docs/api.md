# IntelliBooks — REST API Specification

All endpoints are hosted under `/api`. All requests and responses use JSON format (`application/json`), except where Server-Sent Events (`text/event-stream`) are used for real-time streaming.

---

## Authentication & Headers

Every request must include standard Clerk authentication session cookies or bearer credentials. Unauthenticated requests receive HTTP `401 Unauthorized`.

```
Content-Type: application/json
```

---

## 1. Document Upload & Storage

### Request Upload Token
Initiates document upload and obtains a private Vercel Blob client token.

- **URL**: `POST /api/upload`
- **Rate Limit**: 20 requests / 60 seconds
- **Request Body**:
  ```json
  {
    "fileName": "Master_Services_Agreement.pdf",
    "fileSize": 1048576,
    "fileType": "application/pdf"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "uploadToken": "vercel_blob_client_...",
      "contractId": "b1b11111-2222-3333-4444-555555555555",
      "pathname": "contracts/user_123/b1b11111-2222-3333-4444-555555555555-Master_Services_Agreement.pdf"
    }
  }
  ```

### Complete Upload Verification
Called by the client after direct-to-blob upload completes to verify file integrity and begin asynchronous ingestion.

- **URL**: `POST /api/upload/complete`
- **Request Body**:
  ```json
  {
    "contractId": "b1b11111-2222-3333-4444-555555555555",
    "blobUrl": "https://blob.vercel-storage.com/...",
    "fileName": "Master_Services_Agreement.pdf",
    "fileSize": 1048576,
    "fileType": "application/pdf"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "b1b11111-2222-3333-4444-555555555555",
      "status": "pending",
      "message": "Upload verified. Ingestion workflow queued."
    }
  }
  ```

---

## 2. Contracts Management

### List Contracts
Retrieves a paginated list of contracts owned by the authenticated user.

- **URL**: `GET /api/contracts?page=1&limit=20&search=Master`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "b1b11111-2222-3333-4444-555555555555",
          "title": "Master Services Agreement",
          "fileName": "Master_Services_Agreement.pdf",
          "fileSize": 1048576,
          "fileType": "application/pdf",
          "status": "processed",
          "pageCount": 12,
          "createdAt": "2026-11-23T18:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

### Get Contract Details
- **URL**: `GET /api/contracts/:id`
- **Response `200 OK`**: Contract record with metadata, page count, and status.

### Delete Contract
Safely removes contract, all database records (chunks, reviews, findings, chat history), and private blob storage.

- **URL**: `DELETE /api/contracts/:id`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Contract and associated resources deleted successfully"
  }
  ```

### Get Processing Status
- **URL**: `GET /api/contracts/:id/status`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "b1b11111-2222-3333-4444-555555555555",
      "status": "processed",
      "chunkCount": 38,
      "errorMessage": null
    }
  }
  ```

---

## 3. Contract Reviews & Checklist Analysis

### Trigger Contract Review
Initiates an asynchronous, durable 8-category contract checklist review.

- **URL**: `POST /api/contracts/:id/reviews`
- **Rate Limit**: 10 requests / 60 seconds
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "reviewId": "r1r11111-2222-3333-4444-555555555555",
      "contractId": "b1b11111-2222-3333-4444-555555555555",
      "status": "running"
    }
  }
  ```

### List Reviews
- **URL**: `GET /api/contracts/:id/reviews`
- **Response `200 OK`**: List of all review executions for the contract.

### Get Review Details & Findings
- **URL**: `GET /api/contracts/:id/reviews/:reviewId`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "r1r11111-2222-3333-4444-555555555555",
      "status": "completed",
      "summary": "Review complete. 7 clauses identified, 1 not found.",
      "findings": [
        {
          "id": "f1f11111-2222-3333-4444-555555555555",
          "category": "limitation_of_liability",
          "status": "found",
          "summary": "Aggregate liability is capped at total fees paid in previous 12 months.",
          "quote": "In no event shall either party's aggregate liability exceed the total amounts paid under this Agreement in the twelve (12) months preceding the claim.",
          "location": "Section 9.2 (Page 7)",
          "confidence": "high",
          "reasoning": "Standard mutual liability cap tied to trailing twelve months."
        }
      ]
    }
  }
  ```

---

## 4. Contract Q&A Chat & Streaming RAG

### List Chat Sessions
- **URL**: `GET /api/contracts/:id/chat/sessions`

### Create Chat Session
- **URL**: `POST /api/contracts/:id/chat/sessions`
- **Request Body**: `{ "title": "Liability Clarifications" }`
- **Response `201 Created`**: Returns newly created session record.

### Get Chat Session Details
- **URL**: `GET /api/contracts/:id/chat/sessions/:sessionId`
- **Response `200 OK`**: Session object including chronologically sorted message history.

### Send Message & Stream Response (SSE)
- **URL**: `POST /api/contracts/:id/chat/sessions/:sessionId/messages`
- **Rate Limit**: 30 requests / 60 seconds
- **Request Body**:
  ```json
  {
    "content": "What is the notice period required for termination for convenience?"
  }
  ```
- **Response `200 OK` (`text/event-stream`)**:
  ```
  event: context
  data: {"sources":[{"id":"c1","section":"Termination","pageNumber":5,"excerpt":"Either party may terminate..."}]}

  event: token
  data: {"token":"According"}

  event: token
  data: {"token":" to"}

  event: token
  data: {"token":" Section 8.2..."}

  event: done
  data: {"messageId":"m1m11111-2222-3333-4444-555555555555"}
  ```

### Quick Chat
Convenience endpoint auto-attaching questions to the active session.
- **URL**: `POST /api/contracts/:id/chat`

---

## 5. Evaluation & QA Dashboard (Admin Only)

*Requires role: `admin` via Clerk public metadata.*

### Trigger Benchmark Evaluation
Runs the 32-case benchmark suite across 4 standard contract fixtures.

- **URL**: `POST /api/evaluation/runs`
- **Request Body**:
  ```json
  {
    "description": "Post-deployment regression test"
  }
  ```
- **Response `201 Created`**: Returns evaluation run summary and metrics.

### Get Evaluation Dashboard Aggregates
- **URL**: `GET /api/evaluation/dashboard`
- **Response `200 OK`**: High-level KPIs (average precision, recall, F1, verbatim quote validity) and historical run list.
