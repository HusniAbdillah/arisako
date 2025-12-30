// app/api/kyc/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setup Supabase Client untuk Server
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image_path } = body;

    if (!image_path) {
      return NextResponse.json({ error: "Image path is required" }, { status: 400 });
    }

    // --- LOGIKA DATABASE & ID PALSU PINDAH KE SINI ---
    const FAKE_USER_ID = "00000000-0000-0000-0000-000000000000";

    const { error: dbError } = await supabase
      .from("kyc_requests")
      .insert({
        user_id: FAKE_USER_ID,
        image_path: image_path,
        status: "pending",
      });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, message: "KYC Data Saved" });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
