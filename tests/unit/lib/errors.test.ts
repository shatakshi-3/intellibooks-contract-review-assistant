import { describe, it, expect } from "vitest";
import { AppError, formatErrorResponse } from "@/lib/errors";

describe("AppError", () => {
  it("creates unauthorized error with 401 status", () => {
    const error = AppError.unauthorized("Please log in");
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Please log in");
    expect(error.isOperational).toBe(true);
  });

  it("creates forbidden error with 403 status", () => {
    const error = AppError.forbidden("No access");
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("creates not found error with 404 status", () => {
    const error = AppError.notFound("Contract not found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("creates validation error with 400 status", () => {
    const error = AppError.validation("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it("creates file too large error with 400 status and default 20MB", () => {
    const error = AppError.fileTooLarge();
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("FILE_TOO_LARGE");
    expect(error.message).toContain("20 MB");
  });

  it("creates rate limited error with 429 status", () => {
    const error = AppError.rateLimited();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("formats AppError into client response correctly", () => {
    const error = AppError.notFound("Contract not found");
    const response = formatErrorResponse(error);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Contract not found",
      code: "NOT_FOUND",
    });
  });

  it("masks unexpected errors in non-development environment", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const unexpected = new Error("Database connection timeout at 10.0.0.1:5432");
    const response = formatErrorResponse(unexpected);
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("INTERNAL_ERROR");
    expect(response.body.error).toBe("Internal server error");
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });
});
