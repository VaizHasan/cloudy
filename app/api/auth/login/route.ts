import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(254),

  password: z
    .string()
    .min(1, "Please enter your password.")
    .max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.error.issues[0]?.message ??
            "Please check your email and password.",
        },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const normalizedEmail = email.trim().toLowerCase();

    const user = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    // Email is not registered
    if (!user) {
      return NextResponse.json(
        {
          error:
            "Please create an account before signing in.",
          code: "ACCOUNT_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Account exists, but password is incorrect
    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          error: "Incorrect password. Please try again.",
          code: "INVALID_PASSWORD",
        },
        { status: 401 }
      );
    }

    // Create authenticated session
    const token = await createSession(user.id);

    // Create response
    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      },
      { status: 200 }
    );

    // Secure HttpOnly session cookie
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
    console.error("Login error:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong while signing you in. Please try again.",
      },
      { status: 500 }
    );
  }
}
