/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as createContract, GET as listContracts } from "@/app/api/contracts/route";
import { GET as getContract, DELETE as deleteContract } from "@/app/api/contracts/[id]/route";
import { GET as getReviewFindings } from "@/app/api/contracts/[id]/reviews/[reviewId]/findings/route";
import { GET as getChatSession } from "@/app/api/contracts/[id]/chat/sessions/[sessionId]/route";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { ContractsService } from "@/modules/contracts/service";
import { ChatService } from "@/modules/chat/service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireAuth: vi.fn(),
  requireContractOwnership: vi.fn(),
}));

// Mock @/modules/contracts/service
vi.mock("@/modules/contracts/service", () => ({
  ContractsService: {
    createPendingContract: vi.fn(),
    listContracts: vi.fn(),
    getContractById: vi.fn(),
    deleteContract: vi.fn(),
  },
}));

// Mock @/modules/chat/service
vi.mock("@/modules/chat/service", () => ({
  ChatService: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Multi-User Tenant Isolation and Anti-Leak Security Tests", () => {
  const userA = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userB = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const contractA_Id = "aaaaaaaa-1111-4111-8111-111111111111";
  const contractB_Id = "bbbbbbbb-2222-4222-8222-222222222222";
  const reviewA_Id = "33333333-3333-4333-8333-333333333333";
  const sessionA_Id = "55555555-5555-4555-8555-555555555555";

  const mockContractA = {
    id: contractA_Id,
    userId: userA,
    originalFilename: "Contract_A_Enterprise.pdf",
    fileType: "pdf",
    fileSizeBytes: 1024 * 100,
    status: "ready",
    extractedText: "Agreement A between CloudScale and Alpha Corp.",
    contentHash: "hash_alpha",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockContractB = {
    id: contractB_Id,
    userId: userB,
    originalFilename: "Contract_B_Vendor.pdf",
    fileType: "pdf",
    fileSizeBytes: 1024 * 80,
    status: "ready",
    extractedText: "Agreement B between CloudScale and Beta Corp.",
    contentHash: "hash_beta",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: User A can create and view their own contract
  it("1. User A can create their own contract under their own user ID", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userA, clerkId: "clerk_user_a" });
    vi.mocked(ContractsService.createPendingContract).mockResolvedValueOnce(mockContractA as any);

    const req = new Request("http://localhost:3000/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "Contract_A_Enterprise.pdf",
        fileSize: 1024 * 100,
        fileType: "pdf",
        contentType: "application/pdf",
      }),
    });

    const res = await createContract(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.contract.userId).toBe(userA);
    expect(data.contract.id).toBe(contractA_Id);
  });

  // Test 2: User B can create their own contract under their own user ID
  it("2. User B can create their own contract under their own user ID", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userB, clerkId: "clerk_user_b" });
    vi.mocked(ContractsService.createPendingContract).mockResolvedValueOnce(mockContractB as any);

    const req = new Request("http://localhost:3000/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "Contract_B_Vendor.pdf",
        fileSize: 1024 * 80,
        fileType: "pdf",
        contentType: "application/pdf",
      }),
    });

    const res = await createContract(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.contract.userId).toBe(userB);
    expect(data.contract.id).toBe(contractB_Id);
  });

  // Test 3: User A's contract list strictly excludes User B's contracts
  it("3. User A cannot list or see User B's contracts", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userA, clerkId: "clerk_user_a" });
    vi.mocked(ContractsService.listContracts).mockImplementation(async (uid: string) => {
      if (uid === userA) {
        return { data: [mockContractA as any], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };
      }
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    });

    const req = new Request("http://localhost:3000/api/contracts", { method: "GET" });
    const res = await listContracts(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(contractA_Id);
    expect(data.data.some((c: any) => c.userId === userB)).toBe(false);
  });

  // Test 4: User B's contract list strictly excludes User A's contracts
  it("4. User B cannot list or see User A's contracts", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userB, clerkId: "clerk_user_b" });
    vi.mocked(ContractsService.listContracts).mockImplementation(async (uid: string) => {
      if (uid === userB) {
        return { data: [mockContractB as any], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };
      }
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    });

    const req = new Request("http://localhost:3000/api/contracts", { method: "GET" });
    const res = await listContracts(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(contractB_Id);
    expect(data.data.some((c: any) => c.userId === userA)).toBe(false);
  });

  // Test 5: User B directly accessing User A's contract ID receives 404 (Anti-Leak)
  it("5. User B directly requesting User A's contract ID receives HTTP 404 Not Found", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userB, clerkId: "clerk_user_b" });
    vi.mocked(ContractsService.getContractById).mockRejectedValueOnce(
      AppError.notFound("Contract not found")
    );

    const req = new Request(`http://localhost:3000/api/contracts/${contractA_Id}`, { method: "GET" });
    const res = await getContract(req, { params: Promise.resolve({ id: contractA_Id }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Contract not found");
  });

  // Test 6: User B attempting to delete User A's contract receives 404 (Anti-Leak)
  it("6. User B attempting to delete User A's contract ID receives HTTP 404 Not Found", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userB, clerkId: "clerk_user_b" });
    vi.mocked(ContractsService.deleteContract).mockRejectedValueOnce(
      AppError.notFound("Contract not found")
    );

    const req = new Request(`http://localhost:3000/api/contracts/${contractA_Id}`, { method: "DELETE" });
    const res = await deleteContract(req, { params: Promise.resolve({ id: contractA_Id }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Contract not found");
  });

  // Test 7: User B attempting to fetch User A's review findings receives 404
  it("7. User B requesting User A's contract findings receives HTTP 404 Not Found", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userB, clerkId: "clerk_user_b" });
    vi.mocked(requireContractOwnership).mockRejectedValueOnce(
      AppError.notFound("Contract not found")
    );

    const req = new Request(
      `http://localhost:3000/api/contracts/${contractA_Id}/reviews/${reviewA_Id}/findings`,
      { method: "GET" }
    );
    const res = await getReviewFindings(req, {
      params: Promise.resolve({ id: contractA_Id, reviewId: reviewA_Id }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Contract not found");
  });

  // Test 8: User B attempting to access User A's chat session receives 404
  it("8. User B requesting User A's chat session receives HTTP 404 Not Found", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userB, clerkId: "clerk_user_b" });
    vi.mocked(requireContractOwnership).mockRejectedValueOnce(
      AppError.notFound("Contract not found")
    );

    const req = new Request(
      `http://localhost:3000/api/contracts/${contractA_Id}/chat/sessions/${sessionA_Id}`,
      { method: "GET" }
    );
    const res = await getChatSession(req, {
      params: Promise.resolve({ id: contractA_Id, sessionId: sessionA_Id }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Contract not found");
  });

  // Test 9: Sign-out and sign-in preserves User A's contracts in database
  it("9. User A's data persists across sign-out and re-authentication", async () => {
    // 1st login
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userA, clerkId: "clerk_user_a" });
    vi.mocked(ContractsService.getContractById).mockResolvedValueOnce(mockContractA as any);

    const req1 = new Request(`http://localhost:3000/api/contracts/${contractA_Id}`, { method: "GET" });
    const res1 = await getContract(req1, { params: Promise.resolve({ id: contractA_Id }) });
    expect(res1.status).toBe(200);

    // User signs out (simulated by gap), then signs back in with User A's credentials
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: userA, clerkId: "clerk_user_a" });
    vi.mocked(ContractsService.getContractById).mockResolvedValueOnce(mockContractA as any);

    const req2 = new Request(`http://localhost:3000/api/contracts/${contractA_Id}`, { method: "GET" });
    const res2 = await getContract(req2, { params: Promise.resolve({ id: contractA_Id }) });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.contract.id).toBe(contractA_Id);
    expect(data2.contract.userId).toBe(userA);
  });

  // Test 10: Unauthenticated requests are rejected with 401 Unauthorized
  it("10. Unauthenticated requests are rejected with HTTP 401 Unauthorized", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      AppError.unauthorized("Authentication required. Please sign in.")
    );

    const req = new Request("http://localhost:3000/api/contracts", { method: "GET" });
    const res = await listContracts(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required. Please sign in.");
  });
});
