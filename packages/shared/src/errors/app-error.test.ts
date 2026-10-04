import { describe, it, expect } from 'vitest';
import { AppError, ErrorCodes } from './app-error.js';

describe('AppError', () => {
  it('creates validation error with 400 status and correct code', () => {
    const error = AppError.validation('Invalid input field', { field: 'email' });
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input field');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.isOperational).toBe(true);

    const json = error.toJSON();
    expect(json).toEqual({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid input field',
      details: { field: 'email' },
    });
  });

  it('creates internal error with 500 status and non-operational flag', () => {
    const cause = new Error('Underlying failure');
    const error = AppError.internal('Something went wrong', cause);
    expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.cause).toBe(cause);
    expect(error.isOperational).toBe(false);
  });

  it('creates notFound error with 404 status', () => {
    const error = AppError.notFound();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(ErrorCodes.NOT_FOUND);
  });
});
