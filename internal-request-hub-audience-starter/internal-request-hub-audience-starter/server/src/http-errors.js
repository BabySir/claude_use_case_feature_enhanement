export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(error) {
  return {
    error: {
      code: error.code ?? "INTERNAL_ERROR",
      message: error.message ?? "An unexpected error occurred.",
    },
  };
}
