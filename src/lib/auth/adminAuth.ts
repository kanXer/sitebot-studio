import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { AdminUser } from '@/lib/models/AdminUser';
import { MemoryDb } from '@/lib/memoryDb';

export function getSuperAdminEmail(): string | null {
  const raw = process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || '';
  const clean = raw.replace(/["']/g, '').trim().toLowerCase();
  if (clean && clean.includes('@')) {
    const first = clean.split(/[,;\s]+/)[0]?.trim();
    return first || null;
  }
  return null;
}

export function getSuperAdminEmails(): string[] {
  const email = getSuperAdminEmail();
  return email ? [email] : [];
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const superAdmin = getSuperAdminEmail();
  return Boolean(superAdmin && clean === superAdmin);
}

export async function isAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (isSuperAdminEmail(clean)) return true;

  try {
    await connectToDatabase();
    if (isUsingMemoryDb()) {
      const found = MemoryDb.findAdminByEmail(clean);
      return !!found;
    } else {
      const found = await AdminUser.findOne({ email: clean }).lean();
      return !!found;
    }
  } catch (err) {
    console.error('Error checking admin status:', err);
    return false;
  }
}

export async function getUserRole(email?: string | null): Promise<'super_admin' | 'admin' | 'user'> {
  if (!email) return 'user';
  const clean = email.trim().toLowerCase();
  if (isSuperAdminEmail(clean)) return 'super_admin';

  const isAdmin = await isAdminEmail(clean);
  if (isAdmin) return 'admin';

  return 'user';
}

export async function getAllAdmins(): Promise<
  Array<{
    email: string;
    role: 'super_admin' | 'admin';
    addedBy: string;
    name?: string;
    createdAt: Date;
    isEnv: boolean;
  }>
> {
  const superEmails = getSuperAdminEmails();
  const result: Array<{
    email: string;
    role: 'super_admin' | 'admin';
    addedBy: string;
    name?: string;
    createdAt: Date;
    isEnv: boolean;
  }> = [];

  // 1. Add Super Admins from .env
  for (const sEmail of superEmails) {
    result.push({
      email: sEmail,
      role: 'super_admin',
      addedBy: 'Environment (.env)',
      name: 'Super Administrator',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      isEnv: true,
    });
  }

  // 2. Add Database/In-Memory Admins
  try {
    await connectToDatabase();
    let dbAdmins: any[] = [];
    if (isUsingMemoryDb()) {
      dbAdmins = MemoryDb.findAllAdmins();
    } else {
      dbAdmins = await AdminUser.find().sort({ createdAt: -1 }).lean();
    }

    for (const a of dbAdmins) {
      if (!superEmails.includes(a.email.toLowerCase())) {
        result.push({
          email: a.email,
          role: a.role || 'admin',
          addedBy: a.addedBy || 'super_admin',
          name: a.name || '',
          createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
          isEnv: false,
        });
      }
    }
  } catch (err) {
    console.error('Error fetching admins from DB:', err);
  }

  return result;
}

export async function addAdminUser(
  email: string,
  addedBy: string,
  name?: string
): Promise<{ success: boolean; error?: string; admin?: any }> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Valid email address is required' };
  }

  if (isSuperAdminEmail(cleanEmail)) {
    return { success: false, error: 'This email is already designated as a Super Admin in .env' };
  }

  try {
    await connectToDatabase();
    if (isUsingMemoryDb()) {
      const existing = MemoryDb.findAdminByEmail(cleanEmail);
      if (existing) {
        return { success: false, error: 'This user is already an admin' };
      }
      const admin = MemoryDb.createAdmin({
        email: cleanEmail,
        role: 'admin',
        addedBy,
        name: name?.trim() || '',
      });
      return { success: true, admin };
    } else {
      const existing = await AdminUser.findOne({ email: cleanEmail });
      if (existing) {
        return { success: false, error: 'This user is already an admin' };
      }
      const admin = await AdminUser.create({
        email: cleanEmail,
        role: 'admin',
        addedBy,
        name: name?.trim() || '',
      });
      return { success: true, admin };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add admin user' };
  }
}

export async function removeAdminUser(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (isSuperAdminEmail(cleanEmail)) {
    return { success: false, error: 'Super Admin defined in .env cannot be removed' };
  }

  try {
    await connectToDatabase();
    if (isUsingMemoryDb()) {
      const deleted = MemoryDb.deleteAdmin(cleanEmail);
      if (!deleted) {
        return { success: false, error: 'Admin not found' };
      }
      return { success: true };
    } else {
      const res = await AdminUser.findOneAndDelete({ email: cleanEmail });
      if (!res) {
        return { success: false, error: 'Admin not found' };
      }
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to remove admin user' };
  }
}
