import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { deleteObject } from "@/lib/storage/s3";

async function getSessionUserId(request: Request) {
  const cookieHeader = request.headers.get("cookie");

  const sessionToken = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("session="))
    ?.split("=")[1];

  if (!sessionToken) return null;

  return await verifySession(sessionToken);
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("ME API ERROR:", error);

    return NextResponse.json(
      { error: "Unable to load account information." },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128)
    .optional(),
});

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { username, currentPassword, newPassword } = result.data;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // If updating password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change password." },
          { status: 400 }
        );
      }

      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );

      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 401 }
        );
      }
    }

    // Update user
    const updateData: any = {};

    if (username) {
      const normalizedUsername = username.trim().toLowerCase();

      // Check if username is taken
      const existingUser = await db.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          { error: "That username is already taken." },
          { status: 409 }
        );
      }

      updateData.username = normalizedUsername;
    }

    if (newPassword) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    return NextResponse.json({
      message: "Account updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("ME PATCH ERROR:", error);

    return NextResponse.json(
      { error: "Unable to update account." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.password) {
      return NextResponse.json(
        { error: "Password is required to delete account." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    const passwordMatch = await bcrypt.compare(body.password, user.passwordHash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Password is incorrect." },
        { status: 401 }
      );
    }

    // Delete all files from storage
    const files = await db.file.findMany({
      where: { ownerId: userId },
      select: { storageKey: true },
    });

    for (const file of files) {
      try {
        await deleteObject(file.storageKey);
      } catch (error) {
        console.error("Failed to delete storage object:", error);
      }
    }

    // Delete user (cascades to folders, files, sharelinks)
    await db.user.delete({
      where: { id: userId },
    });

    const response = NextResponse.json({
      message: "Account deleted successfully",
    });

    response.cookies.set({
      name: "session",
      value: "",
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("ME DELETE ERROR:", error);

    return NextResponse.json(
      { error: "Unable to delete account." },
      { status: 500 }
    );
  }
}
