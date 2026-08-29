import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";

async function getUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) return null;

    return verifySession(token);
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return Response.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const { id } = await context.params;

        // Make sure the folder belongs to the authenticated user
        const folder = await db.folder.findFirst({
            where: {
                id,
                ownerId: userId,
                isDeleted: false,
            },
        });

        if (!folder) {
            return Response.json(
                { error: "Folder not found" },
                { status: 404 }
            );
        }

        /*
         * Soft-delete the folder tree and all files inside it.
         *
         * Nothing is physically deleted from the database.
         * Everything remains available for Restore / Delete permanently.
         */

        await db.$transaction(async (tx) => {
            // Find all descendant folders
            const folderIds = [id];
            let index = 0;

            while (index < folderIds.length) {
                const currentFolderId = folderIds[index++];

                const children = await tx.folder.findMany({
                    where: {
                        parentId: currentFolderId,
                        ownerId: userId,
                        isDeleted: false,
                    },
                    select: {
                        id: true,
                    },
                });

                for (const child of children) {
                    folderIds.push(child.id);
                }
            }

            // Move every file in the folder tree to Trash
            await tx.file.updateMany({
                where: {
                    ownerId: userId,
                    folderId: {
                        in: folderIds,
                    },
                    isDeleted: false,
                },
                data: {
                    isDeleted: true,
                },
            });

            // Move the complete folder tree to Trash
            await tx.folder.updateMany({
                where: {
                    ownerId: userId,
                    id: {
                        in: folderIds,
                    },
                    isDeleted: false,
                },
                data: {
                    isDeleted: true,
                },
            });
        });

        return Response.json({
            success: true,
            message: "Folder and its contents moved to Trash",
        });
    } catch (error) {
        console.error("Delete folder error:", error);

        return Response.json(
            { error: "Unable to delete folder" },
            { status: 500 }
        );
    }
}