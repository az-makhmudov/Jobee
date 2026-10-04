export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface SerializedError {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(options: {
    code: ErrorCode | string;
    message: string;
    statusCode?: number;
    details?: unknown;
    cause?: unknown;
    isOperational?: boolean;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  public toJSON(): SerializedError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }

  public static badRequest(message: string, details?: unknown): AppError {
    return new AppError({
      code: ErrorCodes.BAD_REQUEST,
      message,
      statusCode: 400,
      details,
    });
  }

  public static validation(message: string, details?: unknown): AppError {
    return new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      statusCode: 400,
      details,
    });
  }

  public static notFound(message: string = 'Resource not found'): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: 404,
    });
  }

  public static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError({
      code: ErrorCodes.UNAUTHORIZED,
      message,
      statusCode: 401,
    });
  }

  public static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError({
      code: ErrorCodes.FORBIDDEN,
      message,
      statusCode: 403,
    });
  }

  public static conflict(message: string): AppError {
    return new AppError({
      code: ErrorCodes.CONFLICT,
      message,
      statusCode: 409,
    });
  }

  public static internal(
    message: string = 'An unexpected internal error occurred',
    cause?: unknown,
  ): AppError {
    return new AppError({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      statusCode: 500,
      cause,
      isOperational: false,
    });
  }

  public static database(message: string = 'A database error occurred', cause?: unknown): AppError {
    return new AppError({
      code: ErrorCodes.DATABASE_ERROR,
      message,
      statusCode: 500,
      cause,
      isOperational: true,
    });
  }

  public static serviceUnavailable(message: string = 'Service temporarily unavailable'): AppError {
    return new AppError({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message,
      statusCode: 503,
    });
  }
}
