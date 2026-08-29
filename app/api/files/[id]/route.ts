import { cookies } from "next/headers";

import { db } from "@/lib/db";

import { verifySession } from "@/lib/auth/session";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  return await verifySession(token);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const body = await request.json();

    /*
     * Supported partial updates:
     * - isPublic
     * - isFavorite
     * - isDeleted
     * - name
     * - folderId
     */

    const hasValidUpdate =
      typeof body.isPublic === "boolean" ||
      typeof body.isFavorite === "boolean" ||
      typeof body.isDeleted === "boolean" ||
      (typeof body.name === "string" &&
        body.name.trim().length > 0) ||
      body.folderId === null ||
      typeof body.folderId === "string";

    if (!hasValidUpdate) {
      return Response.json(
        {
          error:
            "Provide isPublic, isFavorite, isDeleted, name, or folderId",
        },
        { status: 400 }
      );
    }

    const existingFile = await db.file.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!existingFile) {
      return Response.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    /*
     * If moving the file into a folder,
     * make sure that folder belongs to the same user.
     */

    if (
      typeof body.folderId === "string" &&
      body.folderId !== existingFile.folderId
    ) {
      const folder = await db.folder.findFirst({
        where: {
          id: body.folderId,
          ownerId: userId,
        },
      });

      if (!folder) {
        return Response.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    const updatedFile = await db.file.update({
      where: {
        id,
      },

      data: {
        ...(typeof body.isPublic === "boolean"
          ? {
            isPublic: body.isPublic,
          }
          : {}),

        ...(typeof body.isFavorite === "boolean"
          ? {
            isFavorite: body.isFavorite,
          }
          : {}),

        ...(typeof body.isDeleted === "boolean"
          ? {
            isDeleted: body.isDeleted,
          }
          : {}),

        ...(typeof body.name === "string" &&
          body.name.trim().length > 0
          ? {
            name: body.name.trim(),
          }
          : {}),

        ...(body.folderId === null ||
          typeof body.folderId === "string"
          ? {
            folderId: body.folderId,
          }
          : {}),
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
      success: true,

      file: {
        ...updatedFile,

        size: updatedFile.size.toString(),

        createdAt: updatedFile.createdAt.toISOString(),

        updatedAt: updatedFile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update file error:", error);

    return Response.json(
      { error: "Unable to update file" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const url = new URL(request.url);

    const permanent =
      url.searchParams.get("permanent") === "true";

    const existingFile = await db.file.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!existingFile) {
      return Response.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    /*
     * ============================================================
     * PERMANENT DELETE
     * ============================================================
     *
     * 1. Delete ALL B2 versions of the file.
     * 2. Only after B2 deletion succeeds, delete the Prisma row.
     * 3. Decrease the user's storageUsed by the file size.
     *
     * This prevents the database from saying a file is gone
     * while the actual storage still exists.
     */

    if (permanent) {
      try {
        const { deleteObject } = await import(
          "@/lib/storage/s3"
        );

        /*
         * IMPORTANT:
         *
         * deleteObject() now removes every B2 version belonging
         * to this storageKey.
         */
        await deleteObject(existingFile.storageKey);
      } catch (error) {
        console.error(
          "Failed to permanently delete file from B2:",
          error
        );

        /*
         * Do NOT delete the database record if B2 deletion
         * failed. This keeps the file recoverable/retryable.
         */
        return Response.json(
          {
            error:
              "Unable to permanently delete file from storage",
          },
          { status: 500 }
        );
      }

      /*
       * B2 deletion succeeded.
       *
       * Now update database and storage quota together.
       */
      await db.$transaction(async (tx) => {
        await tx.file.delete({
          where: {
            id,
          },
        });

        /*
         * Release the logical storage quota used by this file.
         *
         * Prevent it from becoming negative in case the database
         * was previously out of sync.
         */
        const user = await tx.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            storageUsed: true,
          },
        });

        if (!user) {
          throw new Error("User not found");
        }

        const newStorageUsed =
          user.storageUsed > existingFile.size
            ? user.storageUsed - existingFile.size
            : BigInt(0);

        await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            storageUsed: newStorageUsed,
          },
        });
      });

      return Response.json({
        success: true,
        message: "File permanently deleted",
      });
    }

    /*
     * ============================================================
     * MOVE TO TRASH
     * ============================================================
     *
     * The physical B2 object remains.
     *
     * storageUsed also remains unchanged because the user
     * can still restore this file.
     */

    const deletedFile = await db.file.update({
      where: {
        id,
      },

      data: {
        isDeleted: true,
      },

      select: {
        id: true,
        name: true,
        isDeleted: true,
      },
    });

    return Response.json({
      success: true,
      message: "File moved to trash",
      file: deletedFile,
    });
  } catch (error) {
    console.error("Delete file error:", error);

    return Response.json(
      { error: "Unable to delete file" },
      { status: 500 }
    );
  }
}