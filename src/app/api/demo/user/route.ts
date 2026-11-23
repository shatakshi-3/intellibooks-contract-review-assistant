import { NextResponse } from "next/server";
import { DEMO_USER, isDemoMode } from "@/demo/config";

export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode inactive" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    data: DEMO_USER,
  });
}
