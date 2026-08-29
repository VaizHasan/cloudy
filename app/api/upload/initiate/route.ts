import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { createUploadUrl } from "@/lib/storage/s3";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

export async function POST(request: Request) {
  let userId: string | null = null;
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
      folderId?: unknown;
    };

    // --------------------------------------------------
    // 3. Validate file information
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

    const size =
      typeof data.size === "number"
        ? data.size
        : Number(data.size);

    const folderId =
      typeof data.folderId === "string" &&
        data.folderId.trim()
        ? data.folderId.trim()
        : null;

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

    if (
      !Number.isSafeInteger(size) ||
      size <= 0
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

    if (size > MAX_FILE_SIZE) {
      return Response.json(
        {
          error:
            "File size cannot exceed 1 GB",
        },
        {
          status: 413,
        }
      );
    }

    const fileSize = BigInt(size);

    // --------------------------------------------------
    // 4. Validate folder ownership
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
    // 5. Load user's storage information
    // --------------------------------------------------

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        storageQuota: true,
        storageUsed: true,
      },
    });

    if (!user) {
      return Response.json(
        {
          error: "User account not found",
        },
        {
          status: 404,
        }
      );
    }

    const remainingStorage =
      user.storageQuota - user.storageUsed;

    if (fileSize > remainingStorage) {
      return Response.json(
        {
          error: "Not enough storage space.",
          storageQuota:
            user.storageQuota.toString(),
          storageUsed:
            user.storageUsed.toString(),
          remainingStorage:
            remainingStorage.toString(),
          fileSize:
            fileSize.toString(),
        },
        {
          status: 413,
        }
      );
    }

    // --------------------------------------------------
    // 6. Atomically reserve storage
    // --------------------------------------------------

    const reservation =
      await db.user.updateMany({
        where: {
          id: userId,
          storageUsed: {
            lte:
              user.storageQuota -
              fileSize,
          },
        },
        data: {
          storageUsed: {
            increment: fileSize,
          },
        },
      });

    if (reservation.count !== 1) {
      return Response.json(
        {
          error:
            "Storage changed while preparing the upload. Please try again.",
        },
        {
          status: 409,
        }
      );
    }

    reservedSize = fileSize;

    // --------------------------------------------------
    // 7. Generate safe B2 storage key
    // --------------------------------------------------

    const safeName = name
      .replace(/[^\w.\-() ]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const storageKey =
      `${userId}/${crypto.randomUUID()}-${safeName}`;

    // --------------------------------------------------
    // 8. Create presigned B2 upload URL
    // --------------------------------------------------

    try {
      const uploadUrl =
        await createUploadUrl(
          storageKey,
          mimeType
        );

      // Reservation remains active until
      // /api/files/upload/complete confirms
      // the object exists in B2.

      return Response.json({
        success: true,
        uploadUrl,
        storageKey,
        folderId,
        expiresIn: 600,
      });
    } catch (error) {
      console.error(
        "CREATE UPLOAD URL ERROR:",
        error
      );

      // ------------------------------------------------
      // Release reservation
      // ------------------------------------------------

      if (reservedSize > BigInt(0)) {
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
      }

      throw error;
    }
  } catch (error) {
    console.error(
      "UPLOAD INITIATE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to prepare upload.",
      },
      {
        status: 500,
      }
    );
  }
}

