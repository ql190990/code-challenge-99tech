/**
 * Shared API response envelopes used by every controller.
 *
 * The shape is intentionally tagged on the `success` field so clients can
 * discriminate between success and error results at the type level.
 */

/**
 * Pagination meta returned on list endpoints.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/**
 * Successful response envelope.
 *
 * @typeParam T - The payload type carried on `data`.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/**
 * Error response envelope emitted by the global error middleware.
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Discriminated union of the two envelopes above.
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
