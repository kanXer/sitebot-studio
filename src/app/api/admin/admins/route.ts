import { NextRequest, NextResponse } from 'next/server';
import {
  isAdminEmail,
  isSuperAdminEmail,
  getAllAdmins,
  addAdminUser,
  removeAdminUser,
} from '@/lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  try {
    const userEmail = req.headers.get('x-user-email');
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    const admins = await getAllAdmins();
    const callerIsSuperAdmin = isSuperAdminEmail(userEmail);

    return NextResponse.json({
      success: true,
      admins,
      callerIsSuperAdmin,
    });
  } catch (error) {
    console.error('Error in admins GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch admin list' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const callerEmail = req.headers.get('x-user-email');

    // ONLY Super Admin can add new admins!
    if (!isSuperAdminEmail(callerEmail)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only Super Administrators can grant admin access to new users.',
        },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const email = body.email == null ? '' : String(body.email);
    const name = typeof body.name === 'string' ? body.name : undefined;

    if (!email || !String(email).includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const result = await addAdminUser(email, callerEmail || 'super_admin', name);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Admin access granted to ${email}`,
      admin: result.admin,
    });
  } catch (error) {
    console.error('Error in admins POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add admin' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const callerEmail = req.headers.get('x-user-email');

    // ONLY Super Admin can remove admins!
    if (!isSuperAdminEmail(callerEmail)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only Super Administrators can revoke admin access.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetEmail = searchParams.get('email');

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Target admin email is required.' },
        { status: 400 }
      );
    }

    const result = await removeAdminUser(targetEmail);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Admin access revoked for ${targetEmail}`,
    });
  } catch (error) {
    console.error('Error in admins DELETE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove admin' },
      { status: 500 }
    );
  }
}
