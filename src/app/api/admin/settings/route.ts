import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { getSystemSettings, updateSystemSettings } from '@/lib/systemSettings';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callerEmail = (req.headers.get('x-user-email') || searchParams.get('email') || '').toLowerCase().trim();

    if (!callerEmail) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const isAdmin = await isAdminEmail(callerEmail);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const settings = await getSystemSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Error fetching admin system settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callerEmail = (req.headers.get('x-user-email') || searchParams.get('email') || '').toLowerCase().trim();

    if (!callerEmail) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const isAdmin = await isAdminEmail(callerEmail);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updated = await updateSystemSettings(body);

    return NextResponse.json({
      success: true,
      message: 'System settings updated successfully.',
      settings: updated,
    });
  } catch (error: any) {
    console.error('Error updating admin system settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
