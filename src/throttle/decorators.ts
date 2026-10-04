import { SetMetadata } from '@nestjs/common';

export const STRICT_THROTTLE_KEY = 'strictThrottle';
export const NO_THROTTLE_KEY = 'noThrottle';

/** Applies the strict per-route limit (login, change-password, refresh...). */
export const StrictThrottle = () => SetMetadata(STRICT_THROTTLE_KEY, true);

/** Exempts a route/controller from every limit (health probes). */
export const NoThrottle = () => SetMetadata(NO_THROTTLE_KEY, true);
