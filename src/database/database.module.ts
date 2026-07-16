import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global database module.
 *
 * Marked @Global so PrismaService can be injected into any feature module
 * without each module having to import DatabaseModule explicitly. Only import
 * this module once, in the root AppModule.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
