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

type SortOption = "newest" | "oldest" | "name" | "size";

type Toast = {
    type: "success" | "error" | "info";
    text: string;
};

type MenuPosition = {
    top: number;
    right: number;
};

const MENU_WIDTH = 224;
const GAP = 8;
const VIEWPORT_PADDING = 12;
const INITIAL_MENU_HEIGHT = 170;

function formatSize(bytes: string | number) {
    const size = Number(bytes);

    if (!Number.isFinite(size)) return "0 B";
    if (size < 1024) return `${size} B`;

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

function FileIcon({ mimeType }: { mimeType: string }) {
    return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4f8] text-[10px] font-bold text-[#1e3a5f] ring-1 ring-[#d5e0eb]">
            {getFileIcon(mimeType)}
        </div>
    );
}

function AccessBadge({ isPublic }: { isPublic: boolean }) {
    return (
        <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isPublic
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
                }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${isPublic
                    ? "bg-emerald-500"
                    : "bg-slate-400"
                    }`}
            />
            {isPublic ? "Public" : "Private"}
        </span>
    );
}

function MoreIcon() {
    return (
        <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
        </svg>
    );
}

function RestoreIcon() {
    return (
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
    );
}

function DeleteIcon() {
    return (
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
    );
}

function FileActionsMenu({
    file,
    position,
    menuRef,
    onRestore,
    onDelete,
    mobile,
}: {
    file: UserFile;
    position: MenuPosition;
    menuRef: React.RefObject<HTMLDivElement | null>;
    onRestore: (file: UserFile) => void;
    onDelete: (file: UserFile) => void;
    mobile?: boolean;
}) {
    return (
        <div
            ref={menuRef}
            className={`fixed z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-black/5 ${mobile
                ? "w-[calc(100vw-24px)] max-w-56 md:hidden"
                : "w-56"
                }`}
            style={position}
        >
            <button
                type="button"
                onClick={() => onRestore(file)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <RestoreIcon />
                </span>

                <span>Restore file</span>
            </button>

            <button
                type="button"
                onClick={() => onDelete(file)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <DeleteIcon />
                </span>

                <span>Delete permanently</span>
            </button>
        </div>
    );
}

export default function TrashPage() {
    const [allFiles, setAllFiles] = useState<UserFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sort, setSort] =
        useState<SortOption>("newest");

    const [toast, setToast] =
        useState<Toast | null>(null);

    const [desktopMenuId, setDesktopMenuId] =
        useState<string | null>(null);

    const [desktopMenuPosition, setDesktopMenuPosition] =
        useState<MenuPosition | null>(null);

    const [mobileMenuId, setMobileMenuId] =
        useState<string | null>(null);

    const [mobileMenuPosition, setMobileMenuPosition] =
        useState<MenuPosition | null>(null);

    const desktopMenuRef =
        useRef<HTMLDivElement | null>(null);

    const mobileMenuRef =
        useRef<HTMLDivElement | null>(null);

    function showToast(
        text: string,
        type: Toast["type"] = "success"
    ) {
        setToast({ text, type });

        window.setTimeout(() => {
            setToast(null);
        }, 3000);
    }

    function closeDesktopMenu() {
        setDesktopMenuId(null);
        setDesktopMenuPosition(null);
    }

    function closeMobileMenu() {
        setMobileMenuId(null);
        setMobileMenuPosition(null);
    }

    function closeMenus() {
        closeDesktopMenu();
        closeMobileMenu();
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
        async function initialize() {
            setLoading(true);

            try {
                await loadFiles();
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, []);

    /* Desktop outside click */
    useEffect(() => {
        if (desktopMenuId === null) return;

        function handleClick(event: MouseEvent) {
            const target = event.target as Node;

            const menuButton = (
                target as HTMLElement
            )?.closest?.(
                `[data-desktop-menu-button="${desktopMenuId}"]`
            );

            if (menuButton) return;

            if (
                desktopMenuRef.current &&
                !desktopMenuRef.current.contains(target)
            ) {
                closeDesktopMenu();
            }
        }

        document.addEventListener(
            "mousedown",
            handleClick
        );

        return () =>
            document.removeEventListener(
                "mousedown",
                handleClick
            );
    }, [desktopMenuId]);

    /* Mobile outside click */
    useEffect(() => {
        if (mobileMenuId === null) return;

        function handleClick(event: MouseEvent) {
            const target = event.target as Node;

            const menuButton = (
                target as HTMLElement
            )?.closest?.(
                `[data-mobile-menu-button="${mobileMenuId}"]`
            );

            if (menuButton) return;

            if (
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(target)
            ) {
                closeMobileMenu();
            }
        }

        document.addEventListener(
            "mousedown",
            handleClick
        );

        return () =>
            document.removeEventListener(
                "mousedown",
                handleClick
            );
    }, [mobileMenuId]);

    /* Escape */
    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeMenus();
            }
        }

        document.addEventListener(
            "keydown",
            handleEscape
        );

        return () =>
            document.removeEventListener(
                "keydown",
                handleEscape
            );
    }, []);

    /*
     * Desktop positioning
     * Measures the actual rendered popup height so
     * bottom rows can safely open upward.
     */
    useEffect(() => {
        if (desktopMenuId === null) return;

        function updatePosition() {
            const button = document.querySelector(
                `[data-desktop-menu-button="${desktopMenuId}"]`
            ) as HTMLElement | null;

            if (!button) return;

            const rect =
                button.getBoundingClientRect();

            const menuHeight =
                desktopMenuRef.current?.getBoundingClientRect()
                    .height ?? INITIAL_MENU_HEIGHT;

            const menuWidth =
                desktopMenuRef.current?.getBoundingClientRect()
                    .width ?? MENU_WIDTH;

            let top = rect.bottom + GAP;

            if (
                top + menuHeight >
                window.innerHeight - VIEWPORT_PADDING
            ) {
                top =
                    rect.top -
                    menuHeight -
                    GAP;
            }

            if (top < VIEWPORT_PADDING) {
                top = VIEWPORT_PADDING;
            }

            let right =
                window.innerWidth - rect.right;

            if (right < VIEWPORT_PADDING) {
                right = VIEWPORT_PADDING;
            }

            if (
                window.innerWidth -
                right -
                menuWidth <
                VIEWPORT_PADDING
            ) {
                right =
                    window.innerWidth -
                    menuWidth -
                    VIEWPORT_PADDING;
            }

            setDesktopMenuPosition({
                top,
                right,
            });
        }

        updatePosition();

        const frame = window.requestAnimationFrame(
            updatePosition
        );

        window.addEventListener(
            "resize",
            updatePosition
        );

        window.addEventListener(
            "scroll",
            updatePosition,
            true
        );

        return () => {
            window.cancelAnimationFrame(frame);

            window.removeEventListener(
                "resize",
                updatePosition
            );

            window.removeEventListener(
                "scroll",
                updatePosition,
                true
            );
        };
    }, [desktopMenuId]);

    /*
     * Mobile positioning
     * Measures the actual popup height after render.
     */
    useEffect(() => {
        if (mobileMenuId === null) return;

        function updatePosition() {
            const button = document.querySelector(
                `[data-mobile-menu-button="${mobileMenuId}"]`
            ) as HTMLElement | null;

            if (!button) return;

            const rect =
                button.getBoundingClientRect();

            const menuElement =
                mobileMenuRef.current;

            const menuWidth =
                menuElement?.getBoundingClientRect()
                    .width ??
                Math.min(
                    MENU_WIDTH,
                    window.innerWidth - 24
                );

            const menuHeight =
                menuElement?.getBoundingClientRect()
                    .height ??
                INITIAL_MENU_HEIGHT;

            let top = rect.bottom + GAP;

            /*
             * If the popup would go below the viewport,
             * place it above the 3-dots button.
             */
            if (
                top + menuHeight >
                window.innerHeight - VIEWPORT_PADDING
            ) {
                top =
                    rect.top -
                    menuHeight -
                    GAP;
            }

            /*
             * Never allow the popup to go above the
             * visible viewport.
             */
            if (top < VIEWPORT_PADDING) {
                top = VIEWPORT_PADDING;
            }

            let right =
                window.innerWidth - rect.right;

            if (right < VIEWPORT_PADDING) {
                right = VIEWPORT_PADDING;
            }

            if (
                window.innerWidth -
                right -
                menuWidth <
                VIEWPORT_PADDING
            ) {
                right =
                    window.innerWidth -
                    menuWidth -
                    VIEWPORT_PADDING;
            }

            setMobileMenuPosition({
                top,
                right,
            });
        }

        updatePosition();

        /*
         * Run again after the popup has actually rendered
         * so its real height is available.
         */
        const frame = window.requestAnimationFrame(
            updatePosition
        );

        window.addEventListener(
            "resize",
            updatePosition
        );

        window.addEventListener(
            "scroll",
            updatePosition,
            true
        );

        return () => {
            window.cancelAnimationFrame(frame);

            window.removeEventListener(
                "resize",
                updatePosition
            );

            window.removeEventListener(
                "scroll",
                updatePosition,
                true
            );
        };
    }, [mobileMenuId]);

    function toggleDesktopMenu(
        event: React.MouseEvent<HTMLButtonElement>,
        id: string
    ) {
        event.stopPropagation();

        /*
         * Clicking the same 3-dots button again closes it.
         */
        if (desktopMenuId === id) {
            closeDesktopMenu();
            return;
        }

        const rect =
            event.currentTarget.getBoundingClientRect();

        let top =
            rect.bottom +
            GAP;

        if (
            top + INITIAL_MENU_HEIGHT >
            window.innerHeight - VIEWPORT_PADDING
        ) {
            top =
                rect.top -
                INITIAL_MENU_HEIGHT -
                GAP;
        }

        if (top < VIEWPORT_PADDING) {
            top = VIEWPORT_PADDING;
        }

        let right =
            window.innerWidth - rect.right;

        if (right < VIEWPORT_PADDING) {
            right = VIEWPORT_PADDING;
        }

        if (
            window.innerWidth -
            right -
            MENU_WIDTH <
            VIEWPORT_PADDING
        ) {
            right =
                window.innerWidth -
                MENU_WIDTH -
                VIEWPORT_PADDING;
        }

        setDesktopMenuPosition({
            top,
            right,
        });

        setDesktopMenuId(id);
    }

    function toggleMobileMenu(
        event: React.MouseEvent<HTMLButtonElement>,
        id: string
    ) {
        event.stopPropagation();

        /*
         * Clicking the same 3-dots button again closes it.
         */
        if (mobileMenuId === id) {
            closeMobileMenu();
            return;
        }

        const rect =
            event.currentTarget.getBoundingClientRect();

        const menuWidth = Math.min(
            MENU_WIDTH,
            window.innerWidth - 24
        );

        let top =
            rect.bottom +
            GAP;

        /*
         * Initial position before the popup is rendered.
         * The positioning effect below then measures
         * the real popup height and corrects it.
         */
        if (
            top + INITIAL_MENU_HEIGHT >
            window.innerHeight - VIEWPORT_PADDING
        ) {
            top =
                rect.top -
                INITIAL_MENU_HEIGHT -
                GAP;
        }

        if (top < VIEWPORT_PADDING) {
            top = VIEWPORT_PADDING;
        }

        let right =
            window.innerWidth - rect.right;

        if (right < VIEWPORT_PADDING) {
            right = VIEWPORT_PADDING;
        }

        if (
            window.innerWidth -
            right -
            menuWidth <
            VIEWPORT_PADDING
        ) {
            right =
                window.innerWidth -
                menuWidth -
                VIEWPORT_PADDING;
        }

        setMobileMenuPosition({
            top,
            right,
        });

        setMobileMenuId(id);
    }

    async function restoreFile(item: UserFile) {
        closeMenus();

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
                    data.error ||
                    "Unable to restore file."
                );
            }

            setAllFiles((current) =>
                current.filter(
                    (file) => file.id !== item.id
                )
            );

            showToast(
                "File restored successfully."
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
        closeMenus();

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
                    data.error ||
                    "Unable to delete file."
                );
            }

            setAllFiles((current) =>
                current.filter(
                    (file) => file.id !== item.id
                )
            );

            window.dispatchEvent(new Event("storage-updated"));

            showToast(
                "File permanently deleted."
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
        const query =
            search.trim().toLowerCase();

        return allFiles
            .filter(
                (file) =>
                    file.isDeleted &&
                    file.name
                        .toLowerCase()
                        .includes(query)
            )
            .sort((a, b) => {
                if (sort === "name") {
                    return a.name.localeCompare(
                        b.name
                    );
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

    const desktopSelectedFile =
        desktopMenuId
            ? visibleFiles.find(
                (file) =>
                    file.id === desktopMenuId
            ) ?? null
            : null;

    const mobileSelectedFile =
        mobileMenuId
            ? visibleFiles.find(
                (file) =>
                    file.id === mobileMenuId
            ) ?? null
            : null;

    return (
        <main className="min-h-full bg-[#f5f7fb] text-slate-900">
            {toast && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-32px)] max-w-sm sm:right-5 sm:top-5">
                    <div
                        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-xl ${toast.type === "success"
                            ? "border-emerald-200 text-emerald-700"
                            : toast.type === "error"
                                ? "border-red-200 text-red-700"
                                : "border-slate-200 text-slate-700"
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
                            className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <section className="mt-4 sm:mt-8">
                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm font-medium text-[#1e3a5f]">
                                Workspace
                            </p>

                            <h1 className="mt-1 text-2xl font-bold tracking-tight">
                                Trash
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                {visibleFiles.length}{" "}
                                deleted{" "}
                                {visibleFiles.length ===
                                    1
                                    ? "file"
                                    : "files"}
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                            <div className="relative flex-1 sm:flex-none">
                                <svg
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    width="16"
                                    height="16"
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
                                            .value as SortOption
                                    )
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10 sm:w-auto"
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

                                                <div className="flex-1 space-y-2">
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
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm">
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

                            <h2 className="mt-5 font-semibold text-slate-800">
                                Trash is empty
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Deleted files will appear
                                here.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="mt-5 hidden overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                                <div className="grid grid-cols-[minmax(0,1fr)_120px_130px_50px] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    <span>File</span>
                                    <span>Access</span>
                                    <span>Modified</span>
                                    <span />
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {visibleFiles.map(
                                        (item) => (
                                            <div
                                                key={item.id}
                                                className="grid grid-cols-[minmax(0,1fr)_120px_130px_50px] items-center gap-4 px-5 py-4 transition hover:bg-slate-50/70"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <FileIcon
                                                        mimeType={
                                                            item.mimeType
                                                        }
                                                    />

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
                                                    </div>
                                                </div>

                                                <AccessBadge
                                                    isPublic={
                                                        item.isPublic
                                                    }
                                                />

                                                <p className="text-xs text-slate-500">
                                                    {formatDate(
                                                        item.createdAt
                                                    )}
                                                </p>

                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        data-desktop-menu-button={
                                                            item.id
                                                        }
                                                        onClick={(
                                                            event
                                                        ) =>
                                                            toggleDesktopMenu(
                                                                event,
                                                                item.id
                                                            )
                                                        }
                                                        aria-label={`Actions for ${item.name}`}
                                                        aria-expanded={
                                                            desktopMenuId ===
                                                            item.id
                                                        }
                                                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${desktopMenuId ===
                                                            item.id
                                                            ? "bg-slate-100 text-slate-700"
                                                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                            }`}
                                                    >
                                                        <MoreIcon />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Mobile */}
                            <div className="mt-5 space-y-3 md:hidden">
                                {visibleFiles.map(
                                    (item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex items-start gap-3">
                                                <FileIcon
                                                    mimeType={
                                                        item.mimeType
                                                    }
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <p className="break-all text-sm font-semibold leading-5 text-slate-800">
                                                        {
                                                            item.name
                                                        }
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {formatSize(
                                                            item.size
                                                        )}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    data-mobile-menu-button={
                                                        item.id
                                                    }
                                                    onClick={(
                                                        event
                                                    ) =>
                                                        toggleMobileMenu(
                                                            event,
                                                            item.id
                                                        )
                                                    }
                                                    aria-label={`Actions for ${item.name}`}
                                                    aria-expanded={
                                                        mobileMenuId ===
                                                        item.id
                                                    }
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${mobileMenuId ===
                                                        item.id
                                                        ? "bg-slate-100 text-slate-700"
                                                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                        }`}
                                                >
                                                    <MoreIcon />
                                                </button>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                                <AccessBadge
                                                    isPublic={
                                                        item.isPublic
                                                    }
                                                />

                                                <span className="text-xs text-slate-400">
                                                    {formatDate(
                                                        item.createdAt
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    )}
                </section>

                <footer className="py-8 text-center text-xs text-slate-400 sm:py-10">
                    Cloudy · Store. Share. Secure.
                </footer>
            </div>

            {desktopSelectedFile &&
                desktopMenuPosition && (
                    <FileActionsMenu
                        file={desktopSelectedFile}
                        position={
                            desktopMenuPosition
                        }
                        menuRef={desktopMenuRef}
                        onRestore={restoreFile}
                        onDelete={
                            permanentlyDeleteFile
                        }
                    />
                )}

            {mobileSelectedFile &&
                mobileMenuPosition && (
                    <FileActionsMenu
                        file={mobileSelectedFile}
                        position={
                            mobileMenuPosition
                        }
                        menuRef={mobileMenuRef}
                        onRestore={restoreFile}
                        onDelete={
                            permanentlyDeleteFile
                        }
                        mobile
                    />
                )}
        </main>
    );
}