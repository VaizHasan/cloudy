import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  return verifySession(token);
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const folders = await db.folder.findMany({
    where: {
      ownerId: userId,
      isDeleted: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json({
    folders,
  });
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const parentId =
      typeof body.parentId === "string"
        ? body.parentId
        : null;

    if (!name) {
      return Response.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    if (name.length > 120) {
      return Response.json(
        { error: "Folder name is too long" },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await db.folder.findFirst({
        where: {
          id: parentId,
          ownerId: userId,
        },
      });

      if (!parent) {
        return Response.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }
    }

    const folder = await db.folder.create({
      data: {
        ownerId: userId,
        name,
        parentId,
      },
    });

    return Response.json({
      success: true,
      folder,
    });
  } catch (error) {
    console.error("Create folder error:", error);

    return Response.json(
      { error: "Unable to create folder" },
      { status: 500 }
    );
  }
}