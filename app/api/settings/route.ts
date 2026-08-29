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

export async function GET(request: Request) {
    try {
        const userId = await getAuthenticatedUser();

        if (!userId) {
            return Response.json(
                { error: "Authentication required" },
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
                storageQuota: true,
            },
        });

        if (!user) {
            return Response.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        return Response.json({
            user: {
                ...user,
                storageQuota: user.storageQuota.toString(),
            },
        });
    } catch (error) {
        console.error("Settings fetch error:", error);

        return Response.json(
            { error: "Unable to fetch settings" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = await getAuthenticatedUser();

        if (!userId) {
            return Response.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const updatedUser = await db.user.update({
            where: {
                id: userId,
            },
            data: {
                ...(typeof body.username === "string"
                    ? { username: body.username }
                    : {}),
            },
            select: {
                id: true,
                username: true,
                email: true,
            },
        });

        return Response.json({
            user: updatedUser,
        });
    } catch (error) {
        console.error("Settings update error:", error);

        return Response.json(
            { error: "Unable to update settings" },
            { status: 500 }
        );
    }
}
