/**
 * Centralized API Service
 * Production-ready HTTP client for Lapis API integration
 *
 * Key Features:
 * - Automatic token management
 * - Request/response interceptors for error handling
 * - Automatic retry on transient failures
 * - Form data encoding for Lapis compatibility
 * - Proper timeout handling
 */

const axios = require('axios');
const querystring = require('querystring');
const config = require('../config');

const API_URL = config.apiUrl;

// Request timeout configurations
const TIMEOUTS = {
  default: 30000,
  upload: 120000,
  long: 60000,
};

// HTTP status codes that should trigger a retry
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Network error codes that should trigger a retry
const RETRYABLE_ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'ENOTFOUND'];

/**
 * Create a configured axios instance for API requests
 * @param {import('electron-store')} store - Electron store instance
 * @param {Object} options - Configuration options
 * @param {boolean} options.useFormData - Use form-urlencoded instead of JSON
 * @param {number} options.timeout - Request timeout in ms
 * @returns {import('axios').AxiosInstance}
 */
const createApiClient = (store, options = {}) => {
  const { useFormData = false, timeout = TIMEOUTS.default } = options;
  const auth = store?.get('auth');

  const headers = {
    Accept: 'application/json',
  };

  // Set content type based on request type
  if (useFormData) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else {
    headers['Content-Type'] = 'application/json';
  }

  // Add auth headers if available
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  if (auth?.user?.uuid) {
    headers['X-User-Id'] = auth.user.uuid;
  }

  if (auth?.user?.uuid_business_id) {
    headers['X-Business-Id'] = auth.user.uuid_business_id;
  }

  const instance = axios.create({
    baseURL: API_URL,
    headers,
    timeout,
    validateStatus: (status) => status < 500,
  });

  // Request interceptor - transform data for form-urlencoded
  instance.interceptors.request.use(
    (config) => {
      if (useFormData && config.data && typeof config.data === 'object') {
        config.data = querystring.stringify(config.data);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle errors consistently
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config: reqConfig, response } = error;

      // Log error for debugging
      console.error('[API Error]', {
        url: reqConfig?.url,
        method: reqConfig?.method,
        status: response?.status,
        error: error.message,
      });

      return Promise.reject(error);
    }
  );

  return instance;
};

/**
 * Encode data as form-urlencoded string
 * @param {Object} data - Data to encode
 * @returns {string}
 */
const encodeFormData = (data) => {
  if (!data || typeof data !== 'object') {
    return '';
  }
  return querystring.stringify(flattenObject(data));
};

/**
 * Flatten nested object for form encoding
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Key prefix
 * @returns {Object}
 */
const flattenObject = (obj, prefix = '') => {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;

    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
        } else {
          result[`${newKey}[${index}]`] = item;
        }
      });
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (value instanceof Date) {
      result[newKey] = value.toISOString();
    } else if (typeof value === 'boolean') {
      result[newKey] = value ? '1' : '0';
    } else {
      result[newKey] = value;
    }
  }

  return result;
};

/**
 * Handle network errors with user-friendly messages
 * @param {Error} error - The error object
 * @param {string} defaultMessage - Default error message
 * @returns {{ success: false, error: string, code?: string }}
 */
const handleNetworkError = (error, defaultMessage = 'Request failed') => {
  const errorMessages = {
    ECONNREFUSED: 'Cannot connect to server. Please check if the API is running.',
    ENOTFOUND: 'Server not found. Please check your network connection.',
    ETIMEDOUT: 'Request timed out. Please try again.',
    TIMEOUT: 'Request timed out. Please try again.',
    ECONNRESET: 'Connection was reset. Please try again.',
    ECONNABORTED: 'Connection was aborted. Please try again.',
    ERR_NETWORK: 'Network error. Please check your internet connection.',
  };

  // Network-level errors
  if (error.code && errorMessages[error.code]) {
    return {
      success: false,
      error: errorMessages[error.code],
      code: error.code,
    };
  }

  // Axios timeout
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return {
      success: false,
      error: 'Request timed out. Please try again.',
      code: 'TIMEOUT',
    };
  }

  // HTTP error responses
  if (error.response) {
    const status = error.response.status;
    const serverError = error.response.data?.error || error.response.data?.message;

    if (status === 401) {
      return {
        success: false,
        error: serverError || 'Authentication required. Please log in again.',
        code: 'UNAUTHORIZED',
      };
    }

    if (status === 403) {
      return {
        success: false,
        error: serverError || 'You do not have permission to perform this action.',
        code: 'FORBIDDEN',
      };
    }

    if (status === 404) {
      return {
        success: false,
        error: serverError || 'The requested resource was not found.',
        code: 'NOT_FOUND',
      };
    }

    if (status === 422) {
      return {
        success: false,
        error: serverError || 'Validation error. Please check your input.',
        code: 'VALIDATION_ERROR',
      };
    }

    if (status >= 500) {
      return {
        success: false,
        error: 'Server error. Please try again later.',
        code: 'SERVER_ERROR',
      };
    }

    return {
      success: false,
      error: serverError || defaultMessage,
      code: `HTTP_${status}`,
    };
  }

  // Generic error
  return {
    success: false,
    error: error.message || defaultMessage,
  };
};

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
const isRetryableError = (error) => {
  if (RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }

  if (error.response && RETRYABLE_STATUS_CODES.includes(error.response.status)) {
    return true;
  }

  return false;
};

/**
 * Make an API request with automatic retry
 * @param {Function} requestFn - Function that returns a promise
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.retryDelay - Delay between retries in ms
 * @returns {Promise}
 */
const withRetry = async (requestFn, options = {}) => {
  const { maxRetries = 2, retryDelay = 1000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error)) {
        console.log(`[API] Retry attempt ${attempt + 1}/${maxRetries} after ${retryDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
};

/**
 * Validate API response and extract data
 * @param {import('axios').AxiosResponse} response - Axios response
 * @param {string} errorMessage - Default error message
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
const validateResponse = (response, errorMessage = 'Request failed') => {
  if (response.status >= 400) {
    const serverError = response.data?.error || response.data?.message;
    return {
      success: false,
      error: serverError || errorMessage,
    };
  }

  return {
    success: true,
    data: response.data,
  };
};

/**
 * Standard API request wrapper
 * @param {import('electron-store')} store - Electron store
 * @param {Object} config - Request configuration
 * @param {string} config.method - HTTP method
 * @param {string} config.url - Request URL
 * @param {Object} config.data - Request body
 * @param {Object} config.params - Query parameters
 * @param {boolean} config.useFormData - Use form-urlencoded
 * @param {string} config.errorMessage - Default error message
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
const apiRequest = async (store, config) => {
  const {
    method = 'GET',
    url,
    data,
    params,
    useFormData = false,
    errorMessage = 'Request failed',
    timeout,
  } = config;

  try {
    const api = createApiClient(store, { useFormData, timeout });

    const response = await withRetry(
      () =>
        api.request({
          method,
          url,
          data,
          params,
        }),
      { maxRetries: 1 }
    );

    return validateResponse(response, errorMessage);
  } catch (error) {
    return handleNetworkError(error, errorMessage);
  }
};

module.exports = {
  createApiClient,
  encodeFormData,
  flattenObject,
  handleNetworkError,
  isRetryableError,
  withRetry,
  validateResponse,
  apiRequest,
  TIMEOUTS,
  API_URL,
};
