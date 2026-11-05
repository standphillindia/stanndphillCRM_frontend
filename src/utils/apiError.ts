// src/utils/apiError.ts
//
// One place that knows how to pull a readable message out of a failed API
// call.
//
// The backend answers every error with the same shape — {status, message,
// timestamp} — but the code reading it was copy-pasted into a dozen files,
// each with its own `err?.response?.data?.message ?? err?.message ?? "…"`
// chain and its own fallback wording. When one of them forgot a step the
// user got "[object Object]" or a blank alert, and the real reason (which
// the server had spelled out) never reached the screen.

/** The error shape axios throws, narrowed to what we actually read. */
interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Record<string, string>;
    };
  };
  message?: string;
}

/**
 * The message to show the user for a failed request.
 *
 * Order matters: the server's own message first (it knows the business
 * rule that failed), then field-level validation errors, then the network
 * error, then the caller's fallback.
 */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = error as ApiError;

  const serverMessage = err?.response?.data?.message?.trim();
  if (serverMessage) return serverMessage;

  // @Valid failures arrive as {"email": "must be a valid email", …}.
  const fieldErrors = err?.response?.data?.errors;
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return Object.values(fieldErrors).join("\n");
  }

  // No response at all means the request never reached the server — worth
  // saying so, because "try again" is genuinely the right advice here and
  // the raw axios text ("Network Error") tells the user nothing.
  if (err?.response === undefined && err?.message) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  return err?.message?.trim() || fallback;
}

/** Title for the error toast, chosen from the HTTP status. */
export function getApiErrorTitle(error: unknown, fallback = "Failed"): string {
  const status = (error as ApiError)?.response?.status;

  switch (status) {
    case 400: return "Check the details";
    case 401: return "Please sign in again";
    case 403: return "Not allowed";
    case 404: return "Not found";
    case 409: return "Already exists";
    case 500: return "Server error";
    default:  return fallback;
  }
}