import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface ResponseEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

interface PaginatedPayload {
  items: unknown[];
  total: number;
  page?: number;
  limit?: number;
}

function isPaginated(payload: unknown): payload is PaginatedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as PaginatedPayload).items) &&
    typeof (payload as PaginatedPayload).total === 'number'
  );
}

/**
 * Wraps responses in a `{ data, meta? }` envelope. A paginated payload
 * (`{ items, total, page?, limit? }`) becomes `{ data: items, meta }`.
 * Opt out per-route with @SkipTransform() (health checks, webhooks, pixels).
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((payload: unknown): ResponseEnvelope<unknown> => {
        if (isPaginated(payload)) {
          const { items, total, page, limit } = payload;
          return { data: items, meta: { total, page, limit } };
        }
        return { data: payload ?? null };
      }),
    );
  }
}
