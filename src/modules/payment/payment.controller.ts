import type { Request, Response } from 'express';
import { CashfreeApiError } from './cashfree.client';
import { paymentService } from './payment.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

function getErrorStatus(error: unknown): number {
  if (error instanceof CashfreeApiError) return error.statusCode >= 500 ? 502 : 400;
  if (error instanceof Error && error.message.includes('not configured')) return 500;
  if (error instanceof Error && error.message.includes('signature')) return 401;
  if (error instanceof Error && error.message.includes('not found')) return 404;
  return 400;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export const createInvoiceCashfreeOrder = async (req: Request, res: Response) => {
  try {
    const result = await paymentService.createInvoiceCashfreeOrder({
      invoiceId: req.params.invoiceId as string,
      user: req.user!,
      returnUrl: req.body.returnUrl,
      notifyUrl: req.body.notifyUrl,
      customerPhone: req.body.customerPhone,
      customerEmail: req.body.customerEmail,
      customerName: req.body.customerName,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
      ...(error instanceof CashfreeApiError ? { details: error.responseBody } : {}),
    });
  }
};

export const getInvoiceCashfreeStatus = async (req: Request, res: Response) => {
  try {
    const result = await paymentService.getInvoiceCashfreeStatus(
      req.params.invoiceId as string,
      req.user!,
      req.query.sync === 'true',
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
      ...(error instanceof CashfreeApiError ? { details: error.responseBody } : {}),
    });
  }
};

export const cashfreeWebhook = async (req: RawBodyRequest, res: Response) => {
  try {
    const result = await paymentService.handleCashfreeWebhook(
      req.headers as Record<string, string | string[] | undefined>,
      req.rawBody,
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
