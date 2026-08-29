import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/lib/db";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const shareLink = await db.shareLink.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!shareLink || !shareLink.file.isPublic) {
      return Response.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    if (
      shareLink.expiresAt &&
      shareLink.expiresAt.getTime() < Date.now()
    ) {
      return Response.json(
        { error: "Share link has expired" },
        { status: 410 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: shareLink.file.storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
        shareLink.file.name
      )}"`,
      ResponseContentType: shareLink.file.mimeType,
    });

    const url = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    return Response.redirect(url);
  } catch (error) {
    console.error("Share download error:", error);

    return Response.json(
      { error: "Unable to download file" },
      { status: 500 }
    );
  }
}
