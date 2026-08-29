import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";

export async function GET() {
    try {
        // --------------------------------------------------
        // 1. Authentication
        // --------------------------------------------------

        const cookieStore = await cookies();
        const token = cookieStore.get("session")?.value;

        if (!token) {
            return Response.json(
                { error: "Unauthorized" },
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
        // 2. Get user's storage information
        // --------------------------------------------------

        const user = await db.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                storageQuota: true,
                files: {
                    where: {
                        isDeleted: false,
                    },
                    select: {
                        size: true,
                    },
                },
            },
        });

        if (!user) {
            return Response.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // --------------------------------------------------
        // 3. Calculate actual storage used
        // --------------------------------------------------

        const usedBytes = user.files.reduce(
            (total, file) => total + file.size,
            BigInt(0)
        );

        // --------------------------------------------------
        // 4. Return storage information
        // --------------------------------------------------

        return Response.json({
            usedBytes: usedBytes.toString(),
            totalBytes: user.storageQuota.toString(),
        });
    } catch (error) {
        console.error("Storage API error:", error);

        return Response.json(
            {
                error: "Unable to load storage information",
            },
            {
                status: 500,
            }
        );
    }
}
