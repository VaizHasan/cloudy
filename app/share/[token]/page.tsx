import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const shareLink = await db.shareLink.findUnique({
    where: { token },
    include: { file: true },
  });

  if (!shareLink || !shareLink.file.isPublic) {
    notFound();
  }

  if (
    shareLink.expiresAt &&
    shareLink.expiresAt.getTime() < Date.now()
  ) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-zinc-900">
          Cloudy
        </h1>

        <p className="mt-2 text-zinc-600">
          Shared file
        </p>

        <div className="mt-8 rounded-xl border border-zinc-200 p-5">
          <p className="font-semibold text-zinc-900">
            {shareLink.file.name}
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            {(Number(shareLink.file.size) / 1024).toFixed(1)} KB
          </p>

          <a
            href={`/api/share/${shareLink.token}`}
            className="mt-6 block w-full rounded-lg bg-black px-6 py-3 text-center font-medium text-white hover:bg-zinc-800"
          >
            Download file
          </a>
        </div>
      </div>
    </main>
  );
}
