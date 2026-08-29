import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import {
  deleteObject,
  getObjectSize,
} from "@/lib/storage/s3";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

export async function POST(request: Request) {
  let userId: string | null = null;
  let storageKey: string | null = null;
  let reservedSize = BigInt(0);

  try {
    // --------------------------------------------------
    // 1. Authentication
    // --------------------------------------------------

    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return Response.json(
        {
          error: "Authentication required",
        },
        {
          status: 401,
        }
      );
    }

    userId = await verifySession(token);

    if (!userId) {
      return Response.json(
        {
          error: "Invalid or expired session",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------
    // 2. Parse request
    // --------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON request",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return Response.json(
        {
          error: "Invalid request body",
        },
        {
          status: 400,
        }
      );
    }

    const data = body as {
      name?: unknown;
      mimeType?: unknown;
      size?: unknown;
      storageKey?: unknown;
      folderId?: unknown;
    };

    // --------------------------------------------------
    // 3. Read fields
    // --------------------------------------------------

    const name =
      typeof data.name === "string"
        ? data.name.trim()
        : "";

    const mimeType =
      typeof data.mimeType === "string" &&
        data.mimeType.trim()
        ? data.mimeType.trim()
        : "application/octet-stream";

    storageKey =
      typeof data.storageKey === "string"
        ? data.storageKey.trim()
        : null;

    const folderId =
      typeof data.folderId === "string" &&
        data.folderId.trim()
        ? data.folderId.trim()
        : null;

    const expectedSize =
      typeof data.size === "number"
        ? data.size
        : Number(data.size);

    // --------------------------------------------------
    // 4. Validate request
    // --------------------------------------------------

    if (!name) {
      return Response.json(
        {
          error: "File name is required",
        },
        {
          status: 400,
        }
      );
    }

    if (name.length > 255) {
      return Response.json(
        {
          error:
            "File name cannot exceed 255 characters",
        },
        {
          status: 400,
        }
      );
    }

    if (!storageKey) {
      return Response.json(
        {
          error: "Storage key is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isSafeInteger(expectedSize) ||
      expectedSize <= 0 ||
      expectedSize > MAX_FILE_SIZE
    ) {
      return Response.json(
        {
          error: "Invalid file size",
        },
        {
          status: 400,
        }
      );
    }

    reservedSize = BigInt(expectedSize);

    // --------------------------------------------------
    // 5. Validate storage key ownership
    // --------------------------------------------------

    const userPrefix = `${userId}/`;

    if (!storageKey.startsWith(userPrefix)) {
      return Response.json(
        {
          error: "Invalid storage key",
        },
        {
          status: 403,
        }
      );
    }

    // Prevent strange keys such as:
    // userId//something
    // userId/../something

    const relativeKey =
      storageKey.slice(userPrefix.length);

    if (
      !relativeKey ||
      relativeKey.includes("..") ||
      relativeKey.startsWith("/")
    ) {
      return Response.json(
        {
          error: "Invalid storage key",
        },
        {
          status: 403,
        }
      );
    }

    // --------------------------------------------------
    // 6. Validate folder ownership
    // --------------------------------------------------

    if (folderId) {
      const folder = await db.folder.findFirst({
        where: {
          id: folderId,
          ownerId: userId,
        },
        select: {
          id: true,
        },
      });

      if (!folder) {
        return Response.json(
          {
            error: "Folder not found",
          },
          {
            status: 404,
          }
        );
      }
    }

    // --------------------------------------------------
    // 7. Check whether this file was already completed
    // --------------------------------------------------

    const existingFile =
      await db.file.findUnique({
        where: {
          storageKey,
        },
        select: {
          id: true,
          ownerId: true,
          name: true,
          size: true,
          mimeType: true,
          isPublic: true,
          folderId: true,
          createdAt: true,
        },
      });

    if (existingFile) {
      // Never allow another user to access
      // another user's storage object.
      if (existingFile.ownerId !== userId) {
        return Response.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          }
        );
      }

      // This is an idempotent retry.
      //
      // IMPORTANT:
      // Do NOT decrement storage here.
      // The original completion already consumed
      // the reservation.

      reservedSize = BigInt(0);

      return Response.json({
        success: true,
        alreadyCompleted: true,
        file: {
          id: existingFile.id,
          name: existingFile.name,
          size: existingFile.size.toString(),
          mimeType: existingFile.mimeType,
          isPublic: existingFile.isPublic,
          folderId: existingFile.folderId,
          createdAt: existingFile.createdAt,
        },
      });
    }

    // --------------------------------------------------
    // 8. Verify object exists in B2
    // --------------------------------------------------

    let actualSize: number;

    try {
      actualSize =
        await getObjectSize(storageKey);
    } catch (error) {
      console.error(
        "B2 HEAD error:",
        error
      );

      return Response.json(
        {
          error:
            "Uploaded file could not be found in storage.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 9. Validate actual B2 size
    // --------------------------------------------------

    if (
      !Number.isSafeInteger(actualSize) ||
      actualSize <= 0 ||
      actualSize > MAX_FILE_SIZE
    ) {
      console.error(
        "Invalid B2 object size:",
        actualSize
      );

      try {
        await deleteObject(storageKey);
      } catch (cleanupError) {
        console.error(
          "B2 cleanup error:",
          cleanupError
        );
      }

      // Release reservation.
      await db.user.updateMany({
        where: {
          id: userId,
          storageUsed: {
            gte: reservedSize,
          },
        },
        data: {
          storageUsed: {
            decrement: reservedSize,
          },
        },
      });

      reservedSize = BigInt(0);

      return Response.json(
        {
          error:
            "Invalid uploaded object size.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 10. Make sure requested size matches B2
    // --------------------------------------------------

    if (actualSize !== expectedSize) {
      console.error(
        "Upload size mismatch:",
        {
          expectedSize,
          actualSize,
          storageKey,
        }
      );

      try {
        await deleteObject(storageKey);
      } catch (cleanupError) {
        console.error(
          "B2 cleanup error:",
          cleanupError
        );
      }

      await db.user.updateMany({
        where: {
          id: userId,
          storageUsed: {
            gte: reservedSize,
          },
        },
        data: {
          storageUsed: {
            decrement: reservedSize,
          },
        },
      });

      reservedSize = BigInt(0);

      return Response.json(
        {
          error:
            "Uploaded file size does not match the requested size.",
          expectedSize,
          actualSize,
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 11. Create database record
    // --------------------------------------------------

    let savedFile;

    try {
      savedFile = await db.file.create({
        data: {
          ownerId: userId,
          folderId,
          name,
          size: BigInt(actualSize),
          mimeType,
          storageKey,
          isPublic: false,
        },
        select: {
          id: true,
          name: true,
          size: true,
          mimeType: true,
          isPublic: true,
          folderId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      // ------------------------------------------------
      // Handle race condition.
      //
      // Another request may have completed the exact
      // same upload between our duplicate check and
      // create().
      // ------------------------------------------------

      const raceFile =
        await db.file.findUnique({
          where: {
            storageKey,
          },
          select: {
            id: true,
            ownerId: true,
            name: true,
            size: true,
            mimeType: true,
            isPublic: true,
            folderId: true,
            createdAt: true,
          },
        });

      if (raceFile) {
        if (raceFile.ownerId !== userId) {
          return Response.json(
            {
              error: "Forbidden",
            },
            {
              status: 403,
            }
          );
        }

        // The other request consumed the reservation.
        reservedSize = BigInt(0);

        return Response.json({
          success: true,
          alreadyCompleted: true,
          file: {
            id: raceFile.id,
            name: raceFile.name,
            size: raceFile.size.toString(),
            mimeType: raceFile.mimeType,
            isPublic: raceFile.isPublic,
            folderId: raceFile.folderId,
            createdAt: raceFile.createdAt,
          },
        });
      }

      throw error;
    }

    // --------------------------------------------------
    // 12. Upload successfully completed
    // --------------------------------------------------

    // The reserved storage is now consumed.
    reservedSize = BigInt(0);

    return Response.json({
      success: true,
      alreadyCompleted: false,
      file: {
        id: savedFile.id,
        name: savedFile.name,
        size: savedFile.size.toString(),
        mimeType: savedFile.mimeType,
        isPublic: savedFile.isPublic,
        folderId: savedFile.folderId,
        createdAt: savedFile.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "UPLOAD COMPLETE ERROR:",
      error
    );

    // --------------------------------------------------
    // IMPORTANT:
    //
    // Only clean up when we still own an active
    // reservation.
    // --------------------------------------------------

    if (
      storageKey &&
      userId &&
      reservedSize > BigInt(0)
    ) {
      try {
        await deleteObject(storageKey);
      } catch (cleanupError) {
        console.error(
          "B2 cleanup error:",
          cleanupError
        );
      }

      try {
        await db.user.updateMany({
          where: {
            id: userId,
            storageUsed: {
              gte: reservedSize,
            },
          },
          data: {
            storageUsed: {
              decrement: reservedSize,
            },
          },
        });
      } catch (rollbackError) {
        console.error(
          "Storage rollback error:",
          rollbackError
        );
      }

      reservedSize = BigInt(0);
    }

    return Response.json(
      {
        error:
          "Unable to complete upload.",
      },
      {
        status: 500,
      }
    );
  }
}

