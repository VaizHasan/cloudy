"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UserFile = {
    id: string;
    name: string;
    size: string;
    mimeType: string;
    isPublic: boolean;
    isDeleted: boolean;
    createdAt: string;
};

type MenuPosition = {
    top: number;
    right: number;
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

export default function TrashPage() {
    const [allFiles, setAllFiles] = useState<UserFile[]>([]);
    const [loading, setLoading] = useState(true);

    const [toast, setToast] = useState<{
        type: "success" | "error" | "info";
        text: string;
    } | null>(null);

    const [search, setSearch] = useState("");

    const [sort, setSort] = useState<
        "newest" | "oldest" | "name" | "size"
    >("newest");

    /*
     * Instead of positioning the dropdown inside the row,
     * we render it fixed relative to the viewport.
     *
     * This prevents:
     * - overflow clipping
     * - dropdown going inside the card
     * - dropdown being hidden behind the card
     * - problems when there is only one row
     */
    const [menuId, setMenuId] = useState<string | null>(null);

    const [menuPosition, setMenuPosition] =
        useState<MenuPosition | null>(null);

    const menuRef = useRef<HTMLDivElement | null>(null);

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

            setAllFiles(data.files ?? []);
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

    /*
     * Close dropdown when clicking outside.
     */
    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;

            if (
                menuRef.current &&
                !menuRef.current.contains(target)
            ) {
                setMenuId(null);
                setMenuPosition(null);
            }
        }

        if (menuId !== null) {
            document.addEventListener(
                "mousedown",
                handlePointerDown
            );
        }

        return () => {
            document.removeEventListener(
                "mousedown",
                handlePointerDown
            );
        };
    }, [menuId]);

    /*
     * Close menu with Escape.
     */
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setMenuId(null);
                setMenuPosition(null);
            }
        }

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, []);

    /*
     * Keep dropdown correctly positioned while scrolling/resizing.
     */
    useEffect(() => {
        if (menuId === null) return;

        function handleViewportChange() {
            const button = document.querySelector(
                `[data-menu-button="${menuId}"]`
            ) as HTMLElement | null;

            if (!button) return;

            const rect = button.getBoundingClientRect();

            const menuWidth = 224;
            const menuHeight = 100;
            const spacing = 8;

            let top = rect.bottom + spacing;

            /*
             * If there isn't enough room below the button,
             * show the dropdown above it.
             */
            if (
                top + menuHeight >
                window.innerHeight - 12
            ) {
                top = rect.top - menuHeight - spacing;
            }

            /*
             * Keep dropdown inside viewport horizontally.
             */
            let right =
                window.innerWidth - rect.right;

            if (right < 12) {
                right = 12;
            }

            if (
                window.innerWidth -
                right -
                menuWidth <
                12
            ) {
                right =
                    window.innerWidth -
                    menuWidth -
                    12;
            }

            setMenuPosition({
                top,
                right,
            });
        }

        handleViewportChange();

        window.addEventListener(
            "resize",
            handleViewportChange
        );

        window.addEventListener(
            "scroll",
            handleViewportChange,
            true
        );

        return () => {
            window.removeEventListener(
                "resize",
                handleViewportChange
            );

            window.removeEventListener(
                "scroll",
                handleViewportChange,
                true
            );
        };
    }, [menuId]);

    function toggleMenu(
        event: React.MouseEvent<HTMLButtonElement>,
        id: string
    ) {
        event.stopPropagation();

        /*
         * Close if clicking the same button again.
         */
        if (menuId === id) {
            setMenuId(null);
            setMenuPosition(null);
            return;
        }

        const rect =
            event.currentTarget.getBoundingClientRect();

        const menuWidth = 224;
        const menuHeight = 100;
        const spacing = 8;

        let top = rect.bottom + spacing;

        /*
         * Open upward when near the bottom.
         */
        if (
            top + menuHeight >
            window.innerHeight - 12
        ) {
            top = rect.top - menuHeight - spacing;
        }

        /*
         * Calculate right-side position.
         */
        let right =
            window.innerWidth - rect.right;

        /*
         * Prevent clipping on the right.
         */
        if (right < 12) {
            right = 12;
        }

        /*
         * Prevent clipping on the left.
         */
        if (
            window.innerWidth -
            right -
            menuWidth <
            12
        ) {
            right =
                window.innerWidth -
                menuWidth -
                12;
        }

        setMenuPosition({
            top,
            right,
        });

        setMenuId(id);
    }

    async function restoreFile(item: UserFile) {
        setMenuId(null);
        setMenuPosition(null);

        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        isDeleted: false,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to restore file."
                );
            }

            setAllFiles((current) =>
                current.filter(
                    (file) => file.id !== item.id
                )
            );

            showToast(
                "File restored successfully.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to restore file.",
                "error"
            );
        }
    }

    async function permanentlyDeleteFile(
        item: UserFile
    ) {
        setMenuId(null);
        setMenuPosition(null);

        try {
            const response = await fetch(
                `/api/files/${item.id}?permanent=true`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const data = await response.json();

                throw new Error(
                    data.error || "Unable to delete file."
                );
            }

            setAllFiles((current) =>
                current.filter(
                    (file) => file.id !== item.id
                )
            );

            showToast(
                "File permanently deleted.",
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
        const result = allFiles.filter((file) => {
            const matchesSearch = file.name
                .toLowerCase()
                .includes(search.toLowerCase());

            const isInTrash = file.isDeleted;

            return matchesSearch && isInTrash;
        });

        return [...result].sort((a, b) => {
            if (sort === "name") {
                return a.name.localeCompare(b.name);
            }

            if (sort === "size") {
                return (
                    Number(b.size) -
                    Number(a.size)
                );
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
    }, [allFiles, search, sort]);

    const selectedFile =
        menuId !== null
            ? visibleFiles.find(
                (file) => file.id === menuId
            ) ?? null
            : null;

    return (
        <main className="h-full overflow-hidden bg-[#f5f7fb] text-slate-900">
            {/* Toast */}
            {toast && (
                <div className="fixed right-5 top-5 z-[100] w-[calc(100%-40px)] max-w-sm">
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

                        <p className="flex-1 text-sm font-medium">
                            {toast.text}
                        </p>

                        <button
                            onClick={() => setToast(null)}
                            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Page */}
            <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
                <section className="mt-8">
                    {/* Header */}
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                        <div>
                            <p className="text-sm font-medium text-[#1e3a5f]">
                                Workspace
                            </p>

                            <h2 className="mt-1 text-2xl font-bold tracking-tight">
                                Trash
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {visibleFiles.length} deleted{" "}
                                {visibleFiles.length === 1
                                    ? "file"
                                    : "files"}
                            </p>
                        </div>

                        {/* Search + Sort */}
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative">
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
                                    placeholder="Search trash..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10 sm:w-56"
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
                                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
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
                                            className="px-5 py-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />

                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />

                                                    <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    ) : visibleFiles.length === 0 ? (
                        /* Empty */
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <svg
                                    width="25"
                                    height="25"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M10 17l5-5-5-5M4 7h14" />
                                </svg>
                            </div>

                            <h3 className="mt-5 font-semibold text-slate-800">
                                Trash is empty
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                Deleted files will appear here.
                            </p>
                        </div>
                    ) : (
                        /* Files */
                        <div className="relative mt-5 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {/* Table header */}
                            <div className="hidden border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid md:grid-cols-[minmax(0,1fr)_120px_130px_50px] md:gap-4">
                                <span>File</span>
                                <span>Access</span>
                                <span>Modified</span>
                                <span />
                            </div>

                            <div className="divide-y divide-slate-100">
                                {visibleFiles.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group relative px-5 py-4 transition hover:bg-slate-50/70"
                                    >
                                        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_120px_130px_50px] md:items-center md:gap-4">
                                            {/* File */}
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4f8] text-[10px] font-bold text-[#1e3a5f] ring-1 ring-[#d5e0eb]">
                                                    {getFileIcon(
                                                        item.mimeType
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-800">
                                                        {item.name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {formatSize(
                                                            item.size
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Access */}
                                            <div>
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

                                            {/* Modified */}
                                            <p className="text-xs text-slate-500">
                                                {formatDate(
                                                    item.createdAt
                                                )}
                                            </p>

                                            {/* Menu button */}
                                            <div className="flex justify-start md:justify-end">
                                                <button
                                                    type="button"
                                                    data-menu-button={
                                                        item.id
                                                    }
                                                    onClick={(event) =>
                                                        toggleMenu(
                                                            event,
                                                            item.id
                                                        )
                                                    }
                                                    aria-label={`Actions for ${item.name}`}
                                                    aria-expanded={
                                                        menuId === item.id
                                                    }
                                                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${menuId === item.id
                                                            ? "bg-slate-100 text-slate-700"
                                                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                        }`}
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
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <footer className="py-10 text-center text-xs text-slate-400">
                    Cloudy · Store. Share. Secure.
                </footer>
            </div>

            {/* =====================================================
          FIXED DROPDOWN
          =====================================================

          IMPORTANT:
          This is OUTSIDE the card.

          Therefore:
          - card overflow cannot clip it
          - one-row cards cannot hide it
          - last-row dropdown can open upward
          - z-index works correctly
      */}
            {selectedFile &&
                menuId !== null &&
                menuPosition && (
                    <div
                        ref={menuRef}
                        className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] ring-1 ring-black/5"
                        style={{
                            top: menuPosition.top,
                            right: menuPosition.right,
                        }}
                    >
                        <div className="px-3 pb-2 pt-2">
                            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                File actions
                            </p>

                            <p className="mt-1 truncate text-xs font-medium text-slate-600">
                                {selectedFile.name}
                            </p>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Restore */}
                        <button
                            type="button"
                            onClick={() =>
                                restoreFile(selectedFile)
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                <svg
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                                    <path d="M3 4v5h5" />
                                </svg>
                            </span>

                            <span>
                                <span className="block">
                                    Restore file
                                </span>

                                <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                    Move back to My Files
                                </span>
                            </span>
                        </button>

                        {/* Permanently delete */}
                        <button
                            type="button"
                            onClick={() =>
                                permanentlyDeleteFile(
                                    selectedFile
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                                <svg
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M4 7h16" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M6 7l1 13h10l1-13" />
                                    <path d="M9 7V4h6v3" />
                                </svg>
                            </span>

                            <span>
                                <span className="block">
                                    Delete permanently
                                </span>

                                <span className="mt-0.5 block text-[11px] font-normal text-red-400">
                                    Cannot be undone
                                </span>
                            </span>
                        </button>
                    </div>
                )}
        </main>
    );
}
