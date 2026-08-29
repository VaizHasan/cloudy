import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),

  email: z.string().trim().email().max(254),

  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 }
      );
    }

    const {
      username,
      email,
      password,
    } = result.data;

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check email and username separately.
    const existingEmail = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    const existingUsername = await db.user.findUnique({
      where: {
        username: normalizedUsername,
      },
    });

    if (existingUsername) {
      return NextResponse.json(
        {
          error: "That username is already taken.",
        },
        { status: 409 }
      );
    }

    // Hash password.
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user.
    const user = await db.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    // Automatically create an authenticated session.
    const token = await createSession(user.id);

    // Return response.
    const response = NextResponse.json(
      {
        message: "Account created successfully",
        user,
      },
      { status: 201 }
    );

    // Store authentication session in HttpOnly cookie.
    response.cookies.set({
      name: "session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
