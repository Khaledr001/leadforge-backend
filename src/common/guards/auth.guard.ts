import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard validating a Supabase JWT from the Authorization header.
 *
 * - Routes marked with @Public() are skipped.
 * - If Supabase is not configured (local dev), non-public routes are allowed in
 *   non-production (with a one-time warning) and rejected in production.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly supabase: SupabaseClient | null;
  private readonly isProduction: boolean;
  private devBypassWarned = false;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('database.supabaseUrl') ?? '';
    const key =
      this.config.get<string>('database.supabaseServiceKey') ||
      this.config.get<string>('database.supabaseAnonKey') ||
      '';
    this.supabase = url && key ? createClient(url, key) : null;
    this.isProduction = this.config.get<boolean>('app.isProduction') ?? false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    if (!this.supabase) {
      if (this.isProduction) {
        throw new UnauthorizedException('Authentication is not configured');
      }
      if (!this.devBypassWarned) {
        this.logger.warn(
          'Supabase not configured — auth bypassed for non-public routes (development only).',
        );
        this.devBypassWarned = true;
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = data.user;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
