import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Lead, SocialPlatform, SocialPost, SocialPostStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AiCopyService } from '../ai-copy/ai-copy.service';
import { BusinessContext } from '../ai-copy/interfaces/ai-copy.types';

@Injectable()
export class SocialAgentService {
  private readonly logger = new Logger(SocialAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCopy: AiCopyService,
  ) {}

  async generateBatch(
    clientId: string,
    count: number,
    platform: SocialPlatform,
  ): Promise<SocialPost[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { lead: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    const posts = await this.aiCopy.generateSocialPosts(
      this.toContext(client.lead),
      count,
      platform,
    );

    const created = await this.prisma.$transaction(
      posts.map((post) =>
        this.prisma.socialPost.create({
          data: {
            clientId,
            platform,
            content: post.content,
            imagePrompt: post.imagePrompt,
            status: SocialPostStatus.DRAFT,
          },
        }),
      ),
    );
    this.logger.log(`Generated ${created.length} ${platform} posts for client ${clientId}`);
    return created;
  }

  async schedulePost(postId: string, scheduledFor: Date): Promise<SocialPost> {
    const post = await this.prisma.socialPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }
    return this.prisma.socialPost.update({
      where: { id: postId },
      data: { scheduledFor, status: SocialPostStatus.SCHEDULED },
    });
  }

  async getCalendar(clientId: string): Promise<SocialPost[]> {
    return this.prisma.socialPost.findMany({
      where: { clientId, status: SocialPostStatus.SCHEDULED, scheduledFor: { not: null } },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  private toContext(lead: Lead): BusinessContext {
    return {
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      state: lead.state,
      googleRating: lead.googleRating == null ? null : Number(lead.googleRating),
      googleReviewCount: lead.googleReviewCount,
    };
  }
}
