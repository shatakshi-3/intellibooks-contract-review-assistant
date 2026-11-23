import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isDemoMode, DEMO_USERS, DEMO_USER_1, DEMO_USER_2 } from "@/demo/config";
import { getActiveDemoUser } from "@/lib/auth/protect";

export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode inactive" }, { status: 403 });
  }

  const activeUser = await getActiveDemoUser();

  return NextResponse.json({
    success: true,
    data: {
      activeUser,
      allUsers: DEMO_USERS,
    },
  });
}

export async function POST(req: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode inactive" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId;

    const matchedUser = DEMO_USERS.find((u) => u.id === targetUserId);
    const selectedUser = matchedUser || (targetUserId === "2" ? DEMO_USER_2 : DEMO_USER_1);

    const cookieStore = await cookies();
    cookieStore.set("demo_user_id", selectedUser.id, {
      path: "/",
      httpOnly: false, // Accessible to client components for reactive UI state
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return NextResponse.json({
      success: true,
      message: `Switched demo identity to ${selectedUser.name}`,
      activeUser: selectedUser,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to switch user" },
      { status: 500 }
    );
  }
}
