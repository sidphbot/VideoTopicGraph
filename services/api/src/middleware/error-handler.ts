/**
 * Global Error Handler
 * 
 * Formats errors according to the OpenAPI specification.
 */

import type { FastifyInstance, FastifyError } from 'fastify';

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

export function errorHandler(
  error: FastifyError,
  request: Parameters<FastifyInstance['errorHandler']>[1],
  reply: Parameters<FastifyInstance['errorHandler']>[2]
): void {
  const requestId = request.id as string;

  // Log error
  request.log.error({ err: error, requestId }, 'Request error');

  // Format error response
  let statusCode = error.statusCode ?? 500;
  let apiError: ApiError;

  if (error.validation) {
    // Validation error
    statusCode = 400;
    apiError = {
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: { validation: error.validation },
      request_id: requestId,
    };
  } else if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE' ||
             error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    // Auth error
    statusCode = 401;
    apiError = {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      request_id: requestId,
    };
  } else if (error.code === 'FST_RATE_LIMIT') {
    // Rate limit error
    statusCode = 429;
    apiError = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Please try again later.',
      request_id: requestId,
    };
  } else {
    // Generic error
    apiError = {
      code: error.code || 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      request_id: requestId,
    };
  }

  reply.status(statusCode).send(apiError);
}
