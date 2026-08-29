import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { deleteObject } from "@/lib/storage/s3";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Authentication
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 2. Parse request
    // --------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON request" },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const data = body as {
      storageKey?: unknown;
      size?: unknown;
    };

    // --------------------------------------------------
    // 3. Read fields
    // --------------------------------------------------

    const storageKey =
      typeof data.storageKey === "string"
        ? data.storageKey.trim()
        : "";

    const size =
      typeof data.size === "number"
        ? data.size
        : Number(data.size);

    // --------------------------------------------------
    // 4. Validate storage key
    // --------------------------------------------------

    if (!storageKey) {
      return Response.json(
        { error: "Storage key is required" },
        { status: 400 }
      );
    }

    const userPrefix = `${userId}/`;

    if (!storageKey.startsWith(userPrefix)) {
      return Response.json(
        { error: "Invalid storage key" },
        { status: 403 }
      );
    }

    const relativeKey =
      storageKey.slice(userPrefix.length);

    if (
      !relativeKey ||
      relativeKey.includes("..") ||
      relativeKey.startsWith("/")
    ) {
      return Response.json(
        { error: "Invalid storage key" },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 5. Validate reserved size
    // --------------------------------------------------

    if (
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > MAX_FILE_SIZE
    ) {
      return Response.json(
        { error: "Invalid file size" },
        { status: 400 }
      );
    }

    const reservedSize = BigInt(size);

    // --------------------------------------------------
    // 6. Delete incomplete B2 object
    // --------------------------------------------------

    try {
      await deleteObject(storageKey);
    } catch (error) {
      console.error(
        "B2 abort cleanup error:",
        error
      );

      // We continue because the database
      // reservation still needs to be released.
    }

    // --------------------------------------------------
    // 7. Release reserved storage
    // --------------------------------------------------

    const result = await db.user.updateMany({
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

    if (result.count !== 1) {
      console.error(
        "Storage reservation rollback failed:",
        {
          userId,
          storageKey,
          size,
        }
      );

      return Response.json(
        {
          error:
            "Upload was aborted, but storage reservation could not be released.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 8. Success
    // --------------------------------------------------

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Upload abort error:",
      error
    );

    return Response.json(
      {
        error: "Unable to abort upload",
      },
      { status: 500 }
    );
  }
}