import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { deleteObject } from "@/lib/storage/s3";

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  return verifySession(token);
}

export async function DELETE() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all files for this user
    const files = await db.file.findMany({
      where: { ownerId: userId },
      select: { id: true, storageKey: true },
    });

    // Delete files from storage
    for (const file of files) {
      try {
        await deleteObject(file.storageKey);
      } catch (error) {
        console.error(`Failed to delete storage object ${file.storageKey}:`, error);
      }
    }

    // Delete all file records
    await db.file.deleteMany({
      where: { ownerId: userId },
    });

    // Delete all folders
    await db.folder.deleteMany({
      where: { ownerId: userId },
    });

    // Reset storage used
    await db.user.update({
      where: { id: userId },
      data: { storageUsed: BigInt(0) },
    });

    return Response.json({
      message: "All files and folders deleted successfully",
      deletedCount: files.length,
    });
  } catch (error) {
    console.error("DELETE ALL FILES ERROR:", error);

    return Response.json(
      { error: "Unable to delete all files." },
      { status: 500 }
    );
  }
}
