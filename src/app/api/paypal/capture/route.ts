import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { UserProfile } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = req.headers.get('x-user-email') || searchParams.get('email');

    const body = await req.json().catch(() => ({}));
    const orderId = body.orderId || searchParams.get('orderId');

    if (!email) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }
    if (!orderId) {
      return NextResponse.json(
        { error: 'PayPal order ID is required' },
        { status: 400 }
      );
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'PayPal is not configured on this server.' },
        { status: 501 }
      );
    }

    const capture = await capturePayPalOrder(orderId);

    if (capture.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `Payment was not completed (status: ${capture.status || 'unknown'})` },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const paidAmount = Number(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0
    );

    // Note: in sandbox mode, always allow upgrade for testing.
    if (process.env.PAYPAL_MODE !== 'sandbox' && paidAmount < 9) {
      return NextResponse.json(
        { error: `Payment amount $${paidAmount} does not match the Pro plan.` },
        { status: 400 }
      );
    }

    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await connectToDatabase();
    if (isUsingMemoryDb()) {
      MemoryDb.updateUserProfile(cleanEmail, {
        plan: 'pro',
        planExpiresAt,
        botLimit: 10,
        tokenQuota: 2500000,
        chatQuota: 50000,
      });
    } else {
      await UserProfile.updateOne(
        { email: cleanEmail },
        {
          $set: {
            plan: 'pro',
            planExpiresAt,
            botLimit: 10,
            tokenQuota: 2500000,
            chatQuota: 50000,
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pro plan activated. Welcome aboard!',
      plan: 'pro',
      planExpiresAt,
      captureId: capture.id,
    });
  } catch (error: any) {
    console.error('Error capturing PayPal order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}