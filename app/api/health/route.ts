// app/api/health/route.ts
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY! // atau Service Key
  );

  try {
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });

    // Jika error koneksi
    if (error) {
        throw new Error(error.message);
    }

    // Jika sukses
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    // Jika Gagal
    return NextResponse.json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    }, { status: 503 }); // 503 artinya Service Unavailable
  }
}
