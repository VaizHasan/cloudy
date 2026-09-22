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

export default function FavoritesPage() {
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

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;

            if (!target.closest("[data-file-menu]")) {
                setMenuId(null);
            }
        }

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    async function toggleFavorite(item: UserFile) {
        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        isFavorite: !item.isFavorite,
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
                              isFavorite:
                                  data.file.isFavorite,
                          }
                        : file
                )
            );

            setMenuId(null);

            showToast(
                data.file.isFavorite
                    ? "Added to favorites."
                    : "Removed from favorites.",
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

    const visibleFiles = useMemo(() => {
        const result = files.filter((file) => {
            const matchesSearch = file.name
                .toLowerCase()
                .includes(search.toLowerCase());

            return matchesSearch && file.isFavorite;
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
            {/* Toast */}
            {toast && (
                <div className="fixed right-3 top-3 z-[100] w-[calc(100%-24px)] max-w-sm sm:right-5 sm:top-5 sm:w-[calc(100%-40px)]">
                    <div
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
                            toast.type === "success"
                                ? "border-emerald-200 bg-white text-emerald-700"
                                : toast.type === "error"
                                    ? "border-red-200 bg-white text-red-700"
                                    : "border-slate-200 bg-white text-slate-700"
                        }`}
                    >
                        <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                toast.type === "success"
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
                            onClick={() => setToast(null)}
                            className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <section className="mt-2 sm:mt-4 lg:mt-8">
                    {/* Header */}
                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1e3a5f]">
                                Workspace
                            </p>

                            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                                Favorites
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {visibleFiles.length} favorite{" "}
                                {visibleFiles.length === 1
                                    ? "file"
                                    : "files"}
                            </p>
                        </div>

                        {/* Search + Sort */}
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
                                    placeholder="Search favorites..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
                                />
                            </div>

                            <select
                                value={sort}
                                onChange={(event) =>
                                    setSort(
                                        event.target.value as
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

                    {/* Loading */}
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
                        /* Empty state */
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
                                    <path d="M11.5 10l-2-2M11.5 10l2-2M11.5 10v4m0-9C6.8 3 3 6.8 3 11.5S6.8 20 11.5 20s8.5-3.8 8.5-8.5S16.2 3 11.5 3z" />
                                </svg>
                            </div>

                            <h3 className="mt-5 font-semibold text-slate-800">
                                No favorites yet
                            </h3>

                            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                Add files to your favorites by
                                starring them to see them here.
                            </p>
                        </div>
                    ) : (
                        /* Files */
                        <div className="relative mt-5 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {/* Desktop header */}
                            <div className="hidden border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid md:grid-cols-[minmax(0,1fr)_120px_130px_50px] md:gap-4">
                                <span>File</span>
                                <span>Access</span>
                                <span>Modified</span>
                                <span />
                            </div>

                            <div className="divide-y divide-slate-100">
                                {visibleFiles.map((item, index) => {
                                    const isLast =
                                        index ===
                                        visibleFiles.length - 1;

                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative overflow-visible px-4 py-4 transition hover:bg-slate-50/70 sm:px-5"
                                        >
                                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-center gap-3 md:grid-cols-[minmax(0,1fr)_120px_130px_50px] md:gap-4">
                                                {/* File */}
                                                <div className="min-w-0">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4f8] text-[10px] font-bold text-[#1e3a5f] ring-1 ring-[#d5e0eb]">
                                                            {getFileIcon(
                                                                item.mimeType
                                                            )}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-semibold text-slate-800">
                                                                {item.name}
                                                            </p>

                                                            <div className="mt-1 flex min-w-0 items-center gap-2">
                                                                <p className="shrink-0 text-xs text-slate-400">
                                                                    {formatSize(
                                                                        item.size
                                                                    )}
                                                                </p>

                                                                {/* Mobile access */}
                                                                <span
                                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold md:hidden ${
                                                                        item.isPublic
                                                                            ? "bg-emerald-50 text-emerald-700"
                                                                            : "bg-slate-100 text-slate-600"
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                                            item.isPublic
                                                                                ? "bg-emerald-500"
                                                                                : "bg-slate-400"
                                                                        }`}
                                                                    />

                                                                    {item.isPublic
                                                                        ? "Public"
                                                                        : "Private"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desktop access */}
                                                <div className="hidden md:block">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            item.isPublic
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : "bg-slate-100 text-slate-600"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${
                                                                item.isPublic
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

                                                {/* Menu */}
                                                <div
                                                    data-file-menu
                                                    className="relative flex justify-end"
                                                >
                                                    <button
                                                        type="button"
                                                        aria-label={`Actions for ${item.name}`}
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
                                                            className={`absolute right-0 z-[80] w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl ${
                                                                isLast
                                                                    ? "bottom-11"
                                                                    : "top-11"
                                                            }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleFavorite(
                                                                        item
                                                                    )
                                                                }
                                                                className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                {item.isFavorite
                                                                    ? "Remove from favorites"
                                                                    : "Add to favorites"}
                                                            </button>

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
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>

                <footer className="py-8 text-center text-xs text-slate-400 sm:py-10">
                    Cloudy · Store. Share. Secure.
                </footer>
            </div>
        </main>
    );
}
