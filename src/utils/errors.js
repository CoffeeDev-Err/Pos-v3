const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

const TECHNICAL_PATTERNS = [
  /requestDevice\(\) chooser/i,
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /request failed with status/i,
];

export function normalizeError(error, options = {}) {
  const context = options.context || '';
  const fallback = options.fallback || DEFAULT_MESSAGE;
  const status = error?.status;
  const code = error?.code || error?.name || '';
  const rawMessage = String(error?.message || error || '').trim();

  if (status === 401) {
    return {
      title: 'Session expired',
      message: 'Please sign in again to continue.',
      severity: 'warning',
      status,
      code,
      original: error,
    };
  }

  if (status === 403) {
    return {
      title: 'Access denied',
      message: 'Your account does not have permission to do that action.',
      severity: 'warning',
      status,
      code,
      original: error,
    };
  }

  if (status === 422) {
    return {
      title: 'Please check the details',
      message: rawMessage || 'Some fields need your attention.',
      severity: 'warning',
      status,
      code,
      original: error,
    };
  }

  if (status >= 500) {
    return {
      title: 'Server error',
      message: 'The server had trouble completing the request. Please try again.',
      severity: 'danger',
      status,
      code,
      original: error,
    };
  }

  if (code === 'NotFoundError' && /requestDevice\(\) chooser/i.test(rawMessage)) {
    return {
      title: 'Printer not selected',
      message: 'Printing was cancelled. Choose a Bluetooth printer when you are ready to print.',
      severity: 'warning',
      status,
      code,
      original: error,
    };
  }

  if (context.includes('bluetooth')) {
    if (/bluetooth.*not.*available|web bluetooth/i.test(rawMessage)) {
      return {
        title: 'Bluetooth printing unavailable',
        message: 'Use Chrome or Edge on HTTPS or localhost, then try printing again.',
        severity: 'warning',
        status,
        code,
        original: error,
      };
    }

    if (/compatible esc\/pos|print service|printer/i.test(rawMessage)) {
      return {
        title: 'Printer not compatible',
        message: 'Could not find a compatible ESC/POS Bluetooth printer service on this device.',
        severity: 'warning',
        status,
        code,
        original: error,
      };
    }
  }

  if (/failed to fetch|networkerror|load failed/i.test(rawMessage)) {
    return {
      title: 'Connection problem',
      message: 'Cannot reach the server right now. Please check if the Laravel API is running.',
      severity: 'danger',
      status,
      code,
      original: error,
    };
  }

  const message = rawMessage && !TECHNICAL_PATTERNS.some(pattern => pattern.test(rawMessage))
    ? rawMessage
    : fallback;

  return {
    title: options.title || 'Unable to complete action',
    message,
    severity: options.severity || 'danger',
    status,
    code,
    original: error,
  };
}

export function getErrorMessage(error, options = {}) {
  return normalizeError(error, options).message;
}

export function notifyError(error, options = {}) {
  if (typeof window === 'undefined') return normalizeError(error, options);
  const normalized = normalizeError(error, options);
  window.dispatchEvent(new CustomEvent('app:error', { detail: normalized }));
  return normalized;
}

export function isErrorStatusMessage(message = '') {
  return /unable|failed|error|cancelled|not selected|not available|not compatible|cannot/i.test(String(message));
}
