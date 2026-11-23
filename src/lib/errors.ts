/**
 * Error types for IntelliBooks.
 *
 * AppError provides structured error responses with:
 * - User-safe message (always returned to client)
 * - Internal details (logged server-side only)
 * - HTTP status codes
 * - Error codes for client handling
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "PROCESSING_ERROR"
  | "AI_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(message, 401, "UNAUTHORIZED");
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError(message, 403, "FORBIDDEN");
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(message, 404, "NOT_FOUND");
  }

  static validation(message: string): AppError {
    return new AppError(message, 400, "VALIDATION_ERROR");
  }

  static fileTooLarge(maxSizeMB = 20): AppError {
    return new AppError(
      `File exceeds maximum size of ${maxSizeMB} MB`,
      400,
      "FILE_TOO_LARGE"
    );
  }

  static invalidFileType(allowedTypes: string[]): AppError {
    return new AppError(
      `Invalid file type. Allowed: ${allowedTypes.join(", ")}`,
      400,
      "INVALID_FILE_TYPE"
    );
  }

  static rateLimited(message = "Too many requests"): AppError {
    return new AppError(message, 429, "RATE_LIMITED");
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError(message, 500, "INTERNAL_ERROR", false);
  }
}

/**
 * Formats an error for HTTP response.
 * In production, internal error details are hidden.
 */
export function formatErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  // Unknown errors — don't leak internals
  const isDev = process.env.NODE_ENV === "development";
  return {
    status: 500,
    body: {
      error: isDev && error instanceof Error ? error.message : "Internal server error",
      code: "INTERNAL_ERROR",
    },
  };
}
