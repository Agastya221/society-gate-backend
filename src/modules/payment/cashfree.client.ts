import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

type CashfreeEnvironment = 'sandbox' | 'production';

interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  environment: CashfreeEnvironment;
  apiVersion: string;
  baseUrl: string;
}

export interface CashfreeCustomerDetails {
  customer_id: string;
  customer_phone: string;
  customer_email?: string;
  customer_name?: string;
}

export interface CreateCashfreeOrderInput {
  orderId: string;
  amount: number;
  currency: string;
  customer: CashfreeCustomerDetails;
  idempotencyKey: string;
  returnUrl?: string;
  notifyUrl?: string;
  orderNote?: string;
  orderTags?: Record<string, string>;
}

export interface CashfreeOrderResponse {
  cf_order_id?: string;
  order_id: string;
  order_amount?: number;
  order_currency?: string;
  order_status?: string;
  payment_session_id?: string;
  [key: string]: unknown;
}

export class CashfreeApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: unknown,
  ) {
    super(message);
    this.name = 'CashfreeApiError';
  }
}

class CashfreeClient {
  private getConfig(): CashfreeConfig {
    const clientId = process.env.CASHFREE_PG_CLIENT_ID || process.env.PAYMENTS_APP_ID;
    const clientSecret = process.env.CASHFREE_PG_CLIENT_SECRET || process.env.PAYMENTS_APP_SECRET;
    const environment = (process.env.CASHFREE_ENV || 'sandbox') as CashfreeEnvironment;
    const apiVersion = process.env.CASHFREE_API_VERSION || '2025-01-01';

    if (!clientId || !clientSecret) {
      throw new Error('Cashfree PG credentials are not configured');
    }

    const baseUrl =
      environment === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';

    return {
      clientId,
      clientSecret,
      environment,
      apiVersion,
      baseUrl,
    };
  }

  async createOrder(input: CreateCashfreeOrderInput): Promise<CashfreeOrderResponse> {
    const orderMeta: Record<string, string> = {};

    if (input.returnUrl) orderMeta.return_url = input.returnUrl;
    if (input.notifyUrl) orderMeta.notify_url = input.notifyUrl;

    const payload = {
      order_id: input.orderId,
      order_amount: input.amount,
      order_currency: input.currency,
      customer_details: input.customer,
      ...(Object.keys(orderMeta).length > 0 ? { order_meta: orderMeta } : {}),
      ...(input.orderNote ? { order_note: input.orderNote } : {}),
      ...(input.orderTags ? { order_tags: input.orderTags } : {}),
    };

    return this.request<CashfreeOrderResponse>('/orders', {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: payload,
      requestId: randomUUID(),
    });
  }

  async fetchOrder(orderId: string): Promise<CashfreeOrderResponse> {
    return this.request<CashfreeOrderResponse>(`/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      requestId: randomUUID(),
    });
  }

  verifyWebhookSignature(signature: string, rawBody: Buffer, timestamp: string): boolean {
    const { clientSecret } = this.getConfig();
    const signedPayload = Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]);
    const expectedSignature = createHmac('sha256', clientSecret)
      .update(signedPayload)
      .digest('base64');

    const expected = Buffer.from(expectedSignature, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  }

  private async request<T>(
    path: string,
    opts: {
      method: 'GET' | 'POST';
      requestId: string;
      idempotencyKey?: string;
      body?: unknown;
    },
  ): Promise<T> {
    const config = this.getConfig();
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': config.apiVersion,
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'x-request-id': opts.requestId,
        ...(opts.idempotencyKey ? { 'x-idempotency-key': opts.idempotencyKey } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });

    const text = await response.text();
    const body = parseResponseBody(text);

    if (!response.ok) {
      throw new CashfreeApiError(
        `Cashfree API request failed with status ${response.status}`,
        response.status,
        body,
      );
    }

    return body as T;
  }
}

function parseResponseBody(text: string): unknown {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export const cashfreeClient = new CashfreeClient();
