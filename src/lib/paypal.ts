/**
 * Minimal PayPal REST API helper (no external SDK).
 * Credentials come from the environment:
 *   PAYPAL_MODE=sandbox|live
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
 */
import { PAYPAL_PLAN_PRICE, PAYPAL_PLAN_LABEL } from '@/lib/plans';

export function paypalBase(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function paypalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
  );
}

export interface PayPalAccessToken {
  access_token: string;
  app_id: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

let cachedToken: { token: string | null; expiresAt: number } = { token: null, expiresAt: 0 };

export async function getPayPalAccessToken(): Promise<PayPalAccessToken> {
  if (!paypalConfigured()) {
    throw new Error('PayPal is not configured (add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env)');
  }
  if (cachedToken.token && cachedToken.expiresAt > Date.now() + 30000) {
    return { access_token: cachedToken.token } as PayPalAccessToken;
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data: PayPalAccessToken = await res.json();
  if (!res.ok) {
    throw new Error(data.app_id || `PayPal auth failed (${res.status}): ${JSON.stringify(data)}`);
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data;
}

export interface PayPalOrderResponse {
  id?: string;
  status?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
  purchase_units?: Array<{ amount: { currency_code: string; value: string } }>;
  [key: string]: unknown;
}

export async function createPayPalOrder(email: string): Promise<PayPalOrderResponse> {
  const token = await getPayPalAccessToken();
  const returnUrl =
    process.env.PAYPAL_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?paypal=success`;
  const cancelUrl =
    process.env.PAYPAL_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?paypal=cancelled`;

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `pro-${email}`,
        description: `${PAYPAL_PLAN_LABEL} plan – Rivafy Studio subscription`,
        custom_id: email,
        amount: {
          currency_code: 'USD',
          value: PAYPAL_PLAN_PRICE.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: 'Rivafy Studio',
      landing_page: 'BILLING',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data: PayPalOrderResponse = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data) || `PayPal order create failed (${res.status})`);
  }
  return data;
}

export interface PayPalCaptureResponse {
  id?: string;
  status?: string;
  payer?: { email_address?: string; payer_id?: string };
  purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; amount?: { value: string } }> } }>;
  [key: string]: unknown;
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalCaptureResponse> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
  });
  const data: PayPalCaptureResponse = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data) || `PayPal capture failed (${res.status})`);
  }
  return data;
}