import { NextRequest, NextResponse } from 'next/server';
import { getUserRole, isSuperAdminEmail, isAdminEmail } from '@/lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        role: 'user',
        isAdmin: false,
        isSuperAdmin: false,
      });
    }

    const role = await getUserRole(email);
    const superAdmin = isSuperAdminEmail(email);
    const admin = await isAdminEmail(email);

    return NextResponse.json(
      {
        email,
        role,
        isAdmin: admin,
        isSuperAdmin: superAdmin,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error verifying user role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify auth role' },
      { status: 500 }
    );
  }
}
