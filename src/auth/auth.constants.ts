export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/** The refresh cookie is only sent to the auth routes. */
export const REFRESH_COOKIE_PATH = '/api/auth';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
