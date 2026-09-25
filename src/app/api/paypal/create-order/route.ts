import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = req.headers.get('x-user-email') || searchParams.get('email');
    if (!email) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error:
            'PayPal is not configured yet on this server. Please contact support to upgrade.',
        },
        { status: 501 }
      );
    }

    const order = await createPayPalOrder(email.toLowerCase().trim());

    const approveLink =
      order.links?.find((l) => l.rel === 'approve')?.href || '';

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: order.status,
      approveUrl: approveLink,
    });
  } catch (error: any) {
    console.error('Error creating PayPal order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}