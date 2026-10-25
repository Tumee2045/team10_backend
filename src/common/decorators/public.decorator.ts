import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Route works without a token. If a valid token is sent anyway,
 * `@CurrentUser()` is still filled (e.g. to show "isFavorite").
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
