import { NextRequest, NextResponse } from 'next/server';
import { testQdrantConnection } from '@/lib/vector/qdrant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, apiKey } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, message: 'Qdrant cluster URL is required' },
        { status: 400 }
      );
    }

    const result = await testQdrantConnection(url, apiKey);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Connection test failed' },
      { status: 500 }
    );
  }
}
