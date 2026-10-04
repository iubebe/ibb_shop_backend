import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips the auth guard (login, guest menu, health...). CSRF still applies. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
