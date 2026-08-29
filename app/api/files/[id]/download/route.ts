import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { createDownloadUrl } from "@/lib/storage/s3";

async function getAuthenticatedUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
        return null;
    }

    return await verifySession(token);
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthenticatedUser();

        if (!userId) {
            return Response.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const { id } = await context.params;

        const file = await db.file.findFirst({
            where: {
                id,
                ownerId: userId,
            },
            select: {
                name: true,
                storageKey: true,
            },
        });

        if (!file) {
            return Response.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        try {
            const downloadUrl = await createDownloadUrl(
                file.storageKey
            );

            return Response.json({
                url: downloadUrl,
            });
        } catch (error) {
            console.error("S3 download error:", error);

            return Response.json(
                { error: "Unable to download file" },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Download error:", error);

        return Response.json(
            { error: "Unable to download file" },
            { status: 500 }
        );
    }
}
