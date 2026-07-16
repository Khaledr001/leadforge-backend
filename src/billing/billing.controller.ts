import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  checkout(@Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(dto.leadId, dto.plan);
  }

  @Post('cancel')
  cancel(@Body() dto: CancelSubscriptionDto) {
    return this.billingService.cancelSubscription(dto.clientId);
  }

  @Get('clients/:clientId/invoices')
  invoices(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.billingService.getInvoices(clientId);
  }
}
