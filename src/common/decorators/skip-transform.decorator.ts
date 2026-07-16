import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Opt a route out of the global TransformInterceptor's `{ data, meta }`
 * envelope. Use for health checks, tracking pixels, webhooks, and any
 * endpoint that must return a raw/binary body.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
