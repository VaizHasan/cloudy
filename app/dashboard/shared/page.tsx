"use client";

import { useEffect, useMemo, useState } from "react";

type UserFile = {
    id: string;
    name: string;
    size: string;
    mimeType: string;
    isPublic: boolean;
    isFavorite: boolean;
    createdAt: string;
};

function formatSize(bytes: string | number) {
    const size = Number(bytes);

    if (!Number.isFinite(size)) return "0 B";

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getFileIcon(mimeType: string) {
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("image")) return "IMG";
    if (mimeType.includes("video")) return "VID";
    if (mimeType.includes("audio")) return "AUD";

    if (
        mimeType.includes("zip") ||
        mimeType.includes("compressed")
    ) {
        return "ZIP";
    }

    return "FILE";
}

export default function SharedPage() {
    const [files, setFiles] = useState<UserFile[]>([]);
    const [loading, setLoading] = useState(true);

    const [toast, setToast] = useState<{
        type: "success" | "error" | "info";
        text: string;
    } | null>(null);

    const [search, setSearch] = useState("");

    const [sort, setSort] = useState<
        "newest" | "oldest" | "name" | "size"
    >("newest");

    const [menuId, setMenuId] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);

    function showToast(
        text: string,
        type: "success" | "error" | "info" = "success"
    ) {
        setToast({ text, type });

        window.setTimeout(() => {
            setToast(null);
        }, 3000);
    }

    async function loadFiles() {
        try {
            const response = await fetch("/api/files", {
                method: "GET",
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to load files."
                );
            }

            setFiles(data.files ?? []);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to load files.",
                "error"
            );
        }
    }

    useEffect(() => {
        async function initializePage() {
            setLoading(true);

            try {
                await loadFiles();
            } finally {
                setLoading(false);
            }
        }

        initializePage();
    }, []);

    async function toggleVisibility(item: UserFile) {
        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        isPublic: !item.isPublic,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to update file."
                );
            }

            setFiles((current) =>
                current.map((file) =>
                    file.id === item.id
                        ? {
                            ...file,
                            isPublic: data.file.isPublic,
                        }
                        : file
                )
            );

            setMenuId(null);

            showToast(
                data.file.isPublic
                    ? "File is now public."
                    : "File is now private.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to update file.",
                "error"
            );
        }
    }

    async function deleteFile(item: UserFile) {
        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        isDeleted: true,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to delete file."
                );
            }

            setFiles((current) =>
                current.filter(
                    (file) => file.id !== item.id
                )
            );

            setMenuId(null);

            showToast(
                "File deleted successfully.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to delete file.",
                "error"
            );
        }
    }

    async function createShareLink(item: UserFile) {
        try {
            const response = await fetch(
                `/api/files/${item.id}/share`,
                {
                    method: "POST",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to create share link."
                );
            }

            const url = `${window.location.origin}${data.url}`;

            setShareUrl(url);
            setMenuId(null);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to create share link.",
                "error"
            );
        }
    }

    async function copyShareLink() {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);

            showToast(
                "Share link copied.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to copy share link.",
                "error"
            );
        }
    }

    const visibleFiles = useMemo(() => {
        const result = files.filter((file) => {
            const matchesSearch = file.name
                .toLowerCase()
                .includes(search.toLowerCase());

            const isShared = file.isPublic;

            return matchesSearch && isShared;
        });

        return [...result].sort((a, b) => {
            if (sort === "name") {
                return a.name.localeCompare(b.name);
            }

            if (sort === "size") {
                return Number(b.size) - Number(a.size);
            }

            const first = new Date(
                a.createdAt
            ).getTime();

            const second = new Date(
                b.createdAt
            ).getTime();

            return sort === "newest"
                ? second - first
                : first - second;
        });
    }, [files, search, sort]);

    return (
        <main className="h-full overflow-x-hidden overflow-y-auto bg-[#f5f7fb] text-slate-900">
            {toast && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-32px)] max-w-sm sm:right-5 sm:top-5 sm:w-[calc(100%-40px)]">
                    <div
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${toast.type === "success"
                                ? "border-emerald-200 bg-white text-emerald-700"
                                : toast.type === "error"
                                    ? "border-red-200 bg-white text-red-700"
                                    : "border-slate-200 bg-white text-slate-700"
                            }`}
                    >
                        <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toast.type === "success"
                                    ? "bg-emerald-100"
                                    : toast.type === "error"
                                        ? "bg-red-100"
                                        : "bg-slate-100"
                                }`}
                        >
                            {toast.type === "success"
                                ? "✓"
                                : toast.type === "error"
                                    ? "!"
                                    : "i"}
                        </div>

                        <p className="min-w-0 flex-1 text-sm font-medium">
                            {toast.text}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setToast(null)
                            }
                            className="shrink-0 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <section className="mt-2 sm:mt-4 lg:mt-8">
                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1e3a5f]">
                                Workspace
                            </p>

                            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                                Shared Files
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {visibleFiles.length} shared{" "}
                                {visibleFiles.length === 1
                                    ? "file"
                                    : "files"}
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                            <div className="relative w-full sm:w-56">
                                <svg
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    width="17"
                                    height="17"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="7"
                                    />
                                    <path d="m20 20-4-4" />
                                </svg>

                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Search shared files..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
                                />
                            </div>

                            <select
                                value={sort}
                                onChange={(event) =>
                                    setSort(
                                        event.target
                                            .value as
                                        | "newest"
                                        | "oldest"
                                        | "name"
                                        | "size"
                                    )
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-[#6f8da8] sm:w-auto"
                            >
                                <option value="newest">
                                    Newest
                                </option>

                                <option value="oldest">
                                    Oldest
                                </option>

                                <option value="name">
                                    Name
                                </option>

                                <option value="size">
                                    Largest
                                </option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="divide-y divide-slate-100">
                                {[1, 2, 3, 4, 5].map(
                                    (item) => (
                                        <div
                                            key={item}
                                            className="px-4 py-4 sm:px-5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-200" />

                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <div className="h-4 w-40 max-w-full animate-pulse rounded bg-slate-200" />

                                                    <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    ) : visibleFiles.length === 0 ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:p-14">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <svg
                                    width="25"
                                    height="25"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M12 16.5c2.49 0 4.5-2.01 4.5-4.5S14.49 7.5 12 7.5 7.5 9.51 7.5 12s2.01 4.5 4.5 4.5z" />
                                    <path d="M4.5 12h-3M22.5 12h-3M12 4.5v-3M12 22.5v-3" />
                                </svg>
                            </div>

                            <h3 className="mt-5 font-semibold text-slate-800">
                                No shared files
                            </h3>

                            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                Make files public to share
                                them with others.
                            </p>
                        </div>
                    ) : (
                        <div className="relative mt-5 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {/* Desktop table header */}
                            <div className="hidden border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid md:grid-cols-[minmax(0,1fr)_120px_130px_50px] md:gap-4">
                                <span>File</span>
                                <span>Access</span>
                                <span>Modified</span>
                                <span />
                            </div>

                            <div className="divide-y divide-slate-100">
                                {visibleFiles.map(
                                    (item, index) => (
                                        <div
                                            key={item.id}
                                            className="group relative overflow-visible px-4 py-4 transition hover:bg-slate-50/70 sm:px-5"
                                        >
                                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-start gap-3 md:grid-cols-[minmax(0,1fr)_120px_130px_50px] md:items-center md:gap-4">
                                                {/* File */}
                                                <div className="min-w-0">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4f8] text-[10px] font-bold text-[#1e3a5f] ring-1 ring-[#d5e0eb]">
                                                            {getFileIcon(
                                                                item.mimeType
                                                            )}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-slate-800">
                                                                {
                                                                    item.name
                                                                }
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-400">
                                                                {formatSize(
                                                                    item.size
                                                                )}
                                                            </p>

                                                            {/* Mobile access */}
                                                            <span
                                                                className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold md:hidden ${item.isPublic
                                                                        ? "bg-emerald-50 text-emerald-700"
                                                                        : "bg-slate-100 text-slate-600"
                                                                    }`}
                                                            >
                                                                <span
                                                                    className={`h-1.5 w-1.5 rounded-full ${item.isPublic
                                                                            ? "bg-emerald-500"
                                                                            : "bg-slate-400"
                                                                        }`}
                                                                />

                                                                {item.isPublic
                                                                    ? "Public"
                                                                    : "Private"}
                                                            </span>

                                                            {/* Mobile modified date */}
                                                            <p className="mt-1 text-xs text-slate-400 md:hidden">
                                                                Modified{" "}
                                                                {formatDate(
                                                                    item.createdAt
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desktop access */}
                                                <div className="hidden md:block">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.isPublic
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : "bg-slate-100 text-slate-600"
                                                            }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${item.isPublic
                                                                    ? "bg-emerald-500"
                                                                    : "bg-slate-400"
                                                                }`}
                                                        />

                                                        {item.isPublic
                                                            ? "Public"
                                                            : "Private"}
                                                    </span>
                                                </div>

                                                {/* Desktop date */}
                                                <p className="hidden text-xs text-slate-500 md:block">
                                                    {formatDate(
                                                        item.createdAt
                                                    )}
                                                </p>

                                                {/* Actions */}
                                                <div className="relative flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setMenuId(
                                                                menuId ===
                                                                    item.id
                                                                    ? null
                                                                    : item.id
                                                            )
                                                        }
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                                    >
                                                        <svg
                                                            width="18"
                                                            height="18"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                cx="5"
                                                                cy="12"
                                                                r="1"
                                                            />
                                                            <circle
                                                                cx="12"
                                                                cy="12"
                                                                r="1"
                                                            />
                                                            <circle
                                                                cx="19"
                                                                cy="12"
                                                                r="1"
                                                            />
                                                        </svg>
                                                    </button>

                                                    {menuId ===
                                                        item.id && (
                                                            <div
                                                                className={`absolute right-0 z-[80] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${index ===
                                                                        visibleFiles.length -
                                                                        1
                                                                        ? "bottom-11"
                                                                        : "top-11"
                                                                    }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleVisibility(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                >
                                                                    {item.isPublic
                                                                        ? "Make private"
                                                                        : "Make public"}
                                                                </button>

                                                                {item.isPublic && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            createShareLink(
                                                                                item
                                                                            )
                                                                        }
                                                                        className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                    >
                                                                        Create share
                                                                        link
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        deleteFile(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                                                                >
                                                                    Delete file
                                                                </button>
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </section>

                <footer className="py-10 text-center text-xs text-slate-400">
                    Cloudy · Store. Share. Secure.
                </footer>
            </div>

            {/* Share modal */}
            {shareUrl && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-5">
                    <div className="my-auto w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    ✓
                                </div>

                                <h2 className="mt-5 text-xl font-bold">
                                    Share link created
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Anyone with this link can
                                    access the public file.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setShareUrl(null)
                                }
                                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-6 flex min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <input
                                readOnly
                                value={shareUrl}
                                className="min-w-0 flex-1 bg-transparent px-2 text-xs text-slate-600 outline-none"
                            />

                            <button
                                type="button"
                                onClick={copyShareLink}
                                className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                                Copy
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setShareUrl(null)
                            }
                            className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}