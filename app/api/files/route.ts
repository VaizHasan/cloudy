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
        shareLinks: {
          select: {
            token: true,
          },
          take: 1,
        },
      },
    });

    return Response.json({
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size.toString(),
        mimeType: file.mimeType,
        isPublic: file.isPublic,
        isFavorite: file.isFavorite,
        isDeleted: file.isDeleted,
        folderId: file.folderId,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),

        // Only expose a share token when the file is public.
        shareToken: file.isPublic
          ? file.shareLinks[0]?.token ?? null
          : null,
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
