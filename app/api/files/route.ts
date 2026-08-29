import { cookies } from "next/headers";

import { db } from "@/lib/db";

import { verifySession } from "@/lib/auth/session";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get("session")?.value;

    if (!token) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = await verifySession(token);

    if (!userId) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Return ALL files belonging to the authenticated user.
    // My Files and Trash pages will filter using isDeleted.
    const files = await db.file.findMany({
      where: {
        ownerId: userId,
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        isPublic: true,
        isFavorite: true,
        isDeleted: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({
      files: files.map((file) => ({
        ...file,
        size: file.size.toString(),
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Files API error:", error);

    return Response.json(
      { error: "Unable to load files" },
      { status: 500 }
    );
  }
}
