import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  return await verifySession(token);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const file = await db.file.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!file) {
      return Response.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    if (!file.isPublic) {
      return Response.json(
        { error: "File must be public before sharing" },
        { status: 400 }
      );
    }

    const token = crypto.randomUUID();

    const shareLink = await db.shareLink.create({
      data: {
        fileId: file.id,
        token,
      },
    });

    return Response.json({
      success: true,
      token: shareLink.token,
      url: `/share/${shareLink.token}`,
    });
  } catch (error) {
    console.error("Create share link error:", error);

    return Response.json(
      { error: "Unable to create share link" },
      { status: 500 }
    );
  }
}
