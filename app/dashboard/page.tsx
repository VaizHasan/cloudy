"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    Folder as FolderIcon,
    Plus,
    Upload,
    MoreVertical,
    Star,
    Eye,
    EyeOff,
    Link as LinkIcon,
    Pencil,
    Trash2,
    X,
    FileText,
} from "lucide-react";

type UserFile = {
    id: string;
    name: string;
    size: string;
    mimeType: string;
    isPublic: boolean;
    isFavorite: boolean;
    createdAt: string;
    folderId?: string | null;
};

type Folder = {
    id: string;
    name: string;
    createdAt: string;
};

type UploadItem = {
    id: string;
    file: File;
    progress: number;
    status:
    | "queued"
    | "uploading"
    | "completed"
    | "error"
    | "cancelled";
    error?: string;
    folderId?: string | null;
};

type User = {
    username: string;
    email: string;
};

const MAX_FILE_SIZE = 1024 * 1024 * 1024;

const FOLDER_COLORS = [
    "from-blue-500 to-indigo-600",
    "from-violet-500 to-purple-600",
    "from-pink-500 to-rose-600",
    "from-red-500 to-orange-600",
    "from-orange-500 to-amber-600",
    "from-yellow-500 to-orange-500",
    "from-emerald-500 to-green-600",
    "from-cyan-500 to-teal-600",
];

function getFolderColor(folderId: string): string {
    if (!folderId) return FOLDER_COLORS[0];

    const first = folderId.charCodeAt(0) || 0;
    const last =
        folderId.charCodeAt(folderId.length - 1) || 0;

    return FOLDER_COLORS[
        (first + last) % FOLDER_COLORS.length
    ];
}

function formatSize(bytes: string | number) {
    const size = Number(bytes);

    if (!Number.isFinite(size)) return "0 B";

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(2)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }

    return `${(
        size /
        (1024 * 1024 * 1024)
    ).toFixed(2)} GB`;
}

function formatDate(date: string) {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "Unknown date";
    }

    return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getFileIcon(mimeType: string) {
    const type = mimeType.toLowerCase();

    if (type.includes("pdf")) return "PDF";
    if (type.includes("image")) return "IMG";
    if (type.includes("video")) return "VID";
    if (type.includes("audio")) return "AUD";
    if (type.includes("text")) return "TXT";

    if (
        type.includes("word") ||
        type.includes("document") ||
        type.includes("msword")
    ) {
        return "DOC";
    }

    if (
        type.includes("sheet") ||
        type.includes("excel") ||
        type.includes("spreadsheet")
    ) {
        return "XLS";
    }

    return "FILE";
}

export default function DashboardPage() {
    const [files, setFiles] = useState<UserFile[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);

    const [storage, setStorage] = useState({
        usedBytes: 0,
        totalBytes: 10 * 1024 * 1024 * 1024,
    });

    const [user, setUser] =
        useState<User | null>(null);

    const [loading, setLoading] = useState(true);

    const [uploads, setUploads] =
        useState<UploadItem[]>([]);

    const [draggingUpload, setDraggingUpload] =
        useState(false);

    const [dragOverFolderId, setDragOverFolderId] =
        useState<string | null>(null);

    const [toast, setToast] = useState<{
        type: "success" | "error" | "info";
        text: string;
    } | null>(null);

    const [search, setSearch] = useState("");

    const [filter, setFilter] = useState<
        "all" | "public" | "private"
    >("all");

    const [sort, setSort] = useState<
        "newest" | "oldest" | "name" | "size"
    >("newest");

    const [selectedFolderId, setSelectedFolderId] =
        useState<string | null>(null);

    const [menuId, setMenuId] =
        useState<string | null>(null);

    const [menuPlacement, setMenuPlacement] =
        useState<"top" | "bottom">("bottom");

    const [renameId, setRenameId] =
        useState<string | null>(null);

    const [renameName, setRenameName] =
        useState("");

    const [newFolderName, setNewFolderName] =
        useState("");

    const [creatingFolder, setCreatingFolder] =
        useState(false);

    const [deleteFolderTarget, setDeleteFolderTarget] =
        useState<Folder | null>(null);

    const [deletingFolderId, setDeletingFolderId] =
        useState<string | null>(null);

    const [movingFileId, setMovingFileId] =
        useState<string | null>(null);

    const fileInputRef =
        useRef<HTMLInputElement>(null);

    const menuRef =
        useRef<HTMLDivElement>(null);

    /*
     * Keep an XMLHttpRequest reference for every
     * active upload so individual uploads can be
     * cancelled.
     */
    const uploadRequestsRef =
        useRef<Record<string, XMLHttpRequest>>({});

    /*
     * Track uploads that were intentionally cancelled.
     *
     * This prevents the XHR abort from being treated
     * as a normal upload error.
     */
    const cancelledUploadsRef =
        useRef<Set<string>>(new Set());

    function showToast(
        text: string,
        type: "success" | "error" | "info" = "success"
    ) {
        setToast({ text, type });

        window.setTimeout(() => {
            setToast(null);
        }, 3500);
    }

    /*
     * Load storage information from the backend.
     */
    async function loadStorage() {
        try {
            const response = await fetch(
                "/api/storage",
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load storage"
                );
            }

            const data = await response.json();

            setStorage({
                usedBytes:
                    Number(data.usedBytes) || 0,

                totalBytes:
                    Number(data.totalBytes) ||
                    10 * 1024 * 1024 * 1024,
            });
        } catch (error) {
            console.error(
                "Failed to load storage:",
                error
            );
        }
    }

    useEffect(() => {
        void loadStorage();
    }, []);

    async function loadFiles() {
        try {
            const response = await fetch(
                "/api/files",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to load files."
                );
            }

            setFiles(data.files ?? []);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to load your files.",
                "error"
            );
        }
    }

    async function loadFolders() {
        try {
            const response = await fetch(
                "/api/folders",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to load folders."
                );
            }

            setFolders(data.folders ?? []);
        } catch (error) {
            console.error(
                "Failed to load folders:",
                error
            );
        }
    }

    async function loadUser() {
        try {
            const response = await fetch(
                "/api/auth/me",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to load account information."
                );
            }

            setUser({
                username: data.user.username,
                email: data.user.email,
            });
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to load account information.",
                "error"
            );
        }
    }

    useEffect(() => {
        async function initializePage() {
            setLoading(true);

            try {
                await Promise.all([
                    loadUser(),
                    loadFiles(),
                    loadFolders(),
                    loadStorage(),
                ]);
            } finally {
                setLoading(false);
            }
        }

        void initializePage();
    }, []);

    useEffect(() => {
        function handleClickOutside(
            event: MouseEvent
        ) {
            if (
                menuRef.current &&
                !menuRef.current.contains(
                    event.target as Node
                )
            ) {
                setMenuId(null);
            }
        }

        if (menuId) {
            document.addEventListener(
                "mousedown",
                handleClickOutside
            );
        }

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, [menuId]);

    useEffect(() => {
        function handleEscape(
            event: KeyboardEvent
        ) {
            if (event.key === "Escape") {
                setMenuId(null);
            }
        }

        document.addEventListener(
            "keydown",
            handleEscape
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, []);

    function calculateMenuPlacement(
        event: React.MouseEvent<HTMLButtonElement>
    ) {
        const rect =
            event.currentTarget.getBoundingClientRect();

        const estimatedMenuHeight = 430;

        const spaceBelow =
            window.innerHeight - rect.bottom;

        const spaceAbove = rect.top;

        if (
            spaceBelow < estimatedMenuHeight &&
            spaceAbove > spaceBelow
        ) {
            setMenuPlacement("top");
        } else {
            setMenuPlacement("bottom");
        }
    }

    async function createFolder() {
        const name = newFolderName.trim();

        if (!name) {
            showToast(
                "Folder name cannot be empty.",
                "error"
            );

            return;
        }

        try {
            setCreatingFolder(true);

            const response = await fetch(
                "/api/folders",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        name,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to create folder."
                );
            }

            setFolders((current) => [
                ...current,
                data.folder,
            ]);

            setNewFolderName("");

            showToast(
                "Folder created successfully.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to create folder.",
                "error"
            );
        } finally {
            setCreatingFolder(false);
        }
    }

    function chooseFiles(
        filesToAdd: File[],
        folderId: string | null = null
    ) {
        const validFiles = filesToAdd.filter(
            (file) => {
                if (file.size === 0) {
                    showToast(
                        `"${file.name}" is empty and cannot be uploaded.`,
                        "error"
                    );

                    return false;
                }

                if (file.size > MAX_FILE_SIZE) {
                    showToast(
                        `"${file.name}" is larger than 1 GB.`,
                        "error"
                    );

                    return false;
                }

                return true;
            }
        );

        if (validFiles.length === 0) {
            return;
        }

        const newUploads: UploadItem[] =
            validFiles.map((file) => ({
                id: crypto.randomUUID(),
                file,
                progress: 0,
                status: "queued",
                folderId,
            }));

        setUploads((current) => [
            ...current,
            ...newUploads,
        ]);

        void Promise.all(
            newUploads.map(
                ({ id, file }) =>
                    uploadSingleFile(
                        file,
                        id,
                        folderId
                    )
            )
        );
    }

    async function deleteFolder(
        folder: Folder
    ) {
        try {
            setDeletingFolderId(folder.id);

            const response = await fetch(
                `/api/folders/${folder.id}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to delete folder."
                );
            }

            setFolders((current) =>
                current.filter(
                    (item) =>
                        item.id !== folder.id
                )
            );

            if (
                selectedFolderId ===
                folder.id
            ) {
                setSelectedFolderId(null);
            }

            await loadFiles();

            setDeleteFolderTarget(null);

            showToast(
                `"${folder.name}" moved to trash.`,
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to delete folder.",
                "error"
            );
        } finally {
            setDeletingFolderId(null);
        }
    }

    /*
     * Upload the actual file using XMLHttpRequest.
     *
     * This is the important part that gives us:
     *
     * xhr.upload.onprogress
     *
     * so large files can show real upload progress.
     */
    async function uploadSingleFile(
        file: File,
        uploadId: string,
        folderId: string | null = null
    ) {
        try {
            cancelledUploadsRef.current.delete(
                uploadId
            );

            setUploads((current) =>
                current.map((item) =>
                    item.id === uploadId
                        ? {
                            ...item,
                            progress: 5,
                            status: "uploading",
                        }
                        : item
                )
            );

            /*
             * STEP 1:
             * Ask backend for an upload URL.
             */
            const initiateResponse =
                await fetch(
                    "/api/upload/initiate",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            name: file.name,
                            size: file.size,
                            mimeType:
                                file.type ||
                                "application/octet-stream",
                            folderId,
                        }),
                    }
                );

            const initiateData =
                await initiateResponse.json();

            if (!initiateResponse.ok) {
                throw new Error(
                    initiateData.error ||
                    "Unable to initiate upload."
                );
            }

            const {
                uploadUrl,
                storageKey,
            } = initiateData;

            if (!uploadUrl || !storageKey) {
                throw new Error(
                    "Upload service returned an invalid response."
                );
            }

            /*
             * STEP 2:
             * Real file upload.
             *
             * 5% -> 90% represents the actual
             * file transfer.
             */
            await new Promise<void>(
                (resolve, reject) => {
                    const xhr =
                        new XMLHttpRequest();

                    uploadRequestsRef.current[
                        uploadId
                    ] = xhr;

                    xhr.open(
                        "PUT",
                        uploadUrl
                    );

                    xhr.setRequestHeader(
                        "Content-Type",
                        file.type ||
                        "application/octet-stream"
                    );

                    xhr.upload.onprogress = (
                        event
                    ) => {
                        if (
                            !event.lengthComputable
                        ) {
                            return;
                        }

                        const ratio =
                            event.loaded /
                            event.total;

                        /*
                         * Actual upload occupies
                         * 5% through 90%.
                         */
                        const progress =
                            5 +
                            Math.round(
                                ratio * 85
                            );

                        setUploads((current) =>
                            current.map(
                                (item) =>
                                    item.id ===
                                        uploadId
                                        ? {
                                            ...item,
                                            progress,
                                            status:
                                                "uploading",
                                        }
                                        : item
                            )
                        );
                    };

                    xhr.onload = () => {
                        delete uploadRequestsRef
                            .current[uploadId];

                        if (
                            xhr.status >= 200 &&
                            xhr.status < 300
                        ) {
                            setUploads(
                                (current) =>
                                    current.map(
                                        (item) =>
                                            item.id ===
                                                uploadId
                                                ? {
                                                    ...item,
                                                    progress: 90,
                                                    status:
                                                        "uploading",
                                                }
                                                : item
                                    )
                            );

                            resolve();
                        } else {
                            reject(
                                new Error(
                                    `Upload failed for "${file.name}".`
                                )
                            );
                        }
                    };

                    xhr.onerror = () => {
                        delete uploadRequestsRef
                            .current[uploadId];

                        reject(
                            new Error(
                                `Upload failed for "${file.name}".`
                            )
                        );
                    };

                    xhr.onabort = () => {
                        delete uploadRequestsRef
                            .current[uploadId];

                        if (
                            cancelledUploadsRef.current.has(
                                uploadId
                            )
                        ) {
                            reject(
                                new Error(
                                    "__UPLOAD_CANCELLED__"
                                )
                            );
                        } else {
                            reject(
                                new Error(
                                    `Upload was aborted for "${file.name}".`
                                )
                            );
                        }
                    };

                    xhr.send(file);
                }
            );

            /*
             * STEP 3:
             * Tell backend the upload has completed.
             */
            const completeResponse =
                await fetch(
                    "/api/upload/complete",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            name: file.name,
                            size: file.size,
                            mimeType:
                                file.type ||
                                "application/octet-stream",
                            storageKey,
                            folderId,
                        }),
                    }
                );

            const completeData =
                await completeResponse.json();

            if (!completeResponse.ok) {
                throw new Error(
                    completeData.error ||
                    "Unable to complete upload."
                );
            }

            /*
             * Upload fully completed.
             */
            setUploads((current) =>
                current.map((item) =>
                    item.id === uploadId
                        ? {
                            ...item,
                            progress: 100,
                            status: "completed",
                        }
                        : item
                )
            );

            /*
             * Remove completed upload from
             * the queue shortly after completion.
             */
            window.setTimeout(() => {
                setUploads((current) =>
                    current.filter(
                        (item) =>
                            item.id !==
                            uploadId
                    )
                );
            }, 1000);

            showToast(
                folderId
                    ? `"${file.name}" uploaded to folder.`
                    : `"${file.name}" uploaded successfully.`,
                "success"
            );

            /*
             * Refresh both file list AND storage.
             */
            await Promise.all([
                loadFiles(),
                loadStorage(),
            ]);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to upload file.";

            /*
             * Intentionally cancelled upload.
             */
            if (
                message ===
                "__UPLOAD_CANCELLED__"
            ) {
                return;
            }

            /*
             * If the upload was cancelled while
             * another async step was running,
             * don't display an error.
             */
            if (
                cancelledUploadsRef.current.has(
                    uploadId
                )
            ) {
                return;
            }

            setUploads((current) =>
                current.map((item) =>
                    item.id === uploadId
                        ? {
                            ...item,
                            progress: Math.min(
                                item.progress,
                                100
                            ),
                            status: "error",
                            error: message,
                        }
                        : item
                )
            );

            showToast(message, "error");
        } finally {
            delete uploadRequestsRef.current[
                uploadId
            ];

            cancelledUploadsRef.current.delete(
                uploadId
            );
        }
    }

    /*
     * Cancel one active upload.
     */
    function cancelUpload(
        uploadId: string
    ) {
        const request =
            uploadRequestsRef.current[
            uploadId
            ];

        cancelledUploadsRef.current.add(
            uploadId
        );

        if (request) {
            request.abort();
        }

        setUploads((current) =>
            current.map((item) =>
                item.id === uploadId
                    ? {
                        ...item,
                        status: "cancelled",
                        error: undefined,
                    }
                    : item
            )
        );

        /*
         * Remove cancelled upload from
         * the visible queue shortly after.
         */
        window.setTimeout(() => {
            setUploads((current) =>
                current.filter(
                    (item) =>
                        item.id !== uploadId
                )
            );
        }, 250);
    }

    async function moveFileToFolder(
        item: UserFile,
        folderId: string | null
    ) {
        if (movingFileId === item.id) {
            return;
        }

        if (
            (item.folderId ?? null) ===
            folderId
        ) {
            showToast(
                folderId
                    ? "File is already in this folder."
                    : "File is already in My Files.",
                "info"
            );

            return;
        }

        try {
            setMovingFileId(item.id);

            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        folderId,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to move file."
                );
            }

            setFiles((current) =>
                current.map((file) =>
                    file.id === item.id
                        ? {
                            ...file,
                            folderId:
                                data.file
                                    ?.folderId ??
                                folderId,
                        }
                        : file
                )
            );

            setMenuId(null);

            const folderName = folderId
                ? folders.find(
                    (folder) =>
                        folder.id ===
                        folderId
                )?.name
                : null;

            showToast(
                folderName
                    ? `"${item.name}" moved to ${folderName}.`
                    : `"${item.name}" moved to My Files.`,
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to move file.",
                "error"
            );
        } finally {
            setMovingFileId(null);
        }
    }

    async function openFile(
        item: UserFile
    ) {
        try {
            const response = await fetch(
                `/api/files/${item.id}/download`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Unable to open file."
                );
            }

            const data =
                await response.json();

            if (!data.url) {
                throw new Error(
                    "File URL was not returned."
                );
            }

            window.open(
                data.url,
                "_blank",
                "noopener,noreferrer"
            );

            setMenuId(null);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to open file.",
                "error"
            );
        }
    }

    async function toggleFavorite(
        item: UserFile
    ) {
        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        isFavorite:
                            !item.isFavorite,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to update file."
                );
            }

            setFiles((current) =>
                current.map((file) =>
                    file.id === item.id
                        ? {
                            ...file,
                            isFavorite:
                                data.file
                                    .isFavorite,
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

    async function toggleVisibility(
        item: UserFile
    ) {
        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        isPublic:
                            !item.isPublic,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to update file."
                );
            }

            setFiles((current) =>
                current.map((file) =>
                    file.id === item.id
                        ? {
                            ...file,
                            isPublic:
                                data.file
                                    .isPublic,
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

    async function renameFile(
        item: UserFile
    ) {
        const name = renameName.trim();

        if (!name) {
            showToast(
                "File name cannot be empty.",
                "error"
            );

            return;
        }

        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        name,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to rename file."
                );
            }

            setFiles((current) =>
                current.map((file) =>
                    file.id === item.id
                        ? {
                            ...file,
                            name:
                                data.file.name,
                        }
                        : file
                )
            );

            setRenameId(null);
            setRenameName("");
            setMenuId(null);

            showToast(
                "File renamed successfully.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to rename file.",
                "error"
            );
        }
    }

    async function deleteFile(
        item: UserFile
    ) {
        try {
            const response = await fetch(
                `/api/files/${item.id}`,
                {
                    method: "DELETE",
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to delete file."
                );
            }

            setFiles((current) =>
                current.filter(
                    (file) =>
                        file.id !== item.id
                )
            );

            setMenuId(null);

            showToast(
                "File moved to trash.",
                "success"
            );

            /*
             * Refresh storage in case your
             * backend immediately removes storage
             * usage for deleted files.
             */
            await loadStorage();
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to delete file.",
                "error"
            );
        }
    }

    async function createShareLink(
        item: UserFile
    ) {
        try {
            const response = await fetch(
                `/api/files/${item.id}/share`,
                {
                    method: "POST",
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to create share link."
                );
            }

            if (!data.url) {
                throw new Error(
                    "Share link was not returned."
                );
            }

            const shareLink =
                `${window.location.origin}${data.url}`;

            await navigator.clipboard.writeText(
                shareLink
            );

            setMenuId(null);

            showToast(
                "Share link copied to clipboard.",
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to create share link.",
                "error"
            );
        }
    }

    function handleFileDragStart(
        event: React.DragEvent,
        item: UserFile
    ) {
        event.dataTransfer.effectAllowed =
            "move";

        event.dataTransfer.setData(
            "application/x-cloudy-file-id",
            item.id
        );

        event.dataTransfer.setData(
            "text/plain",
            item.id
        );
    }

    function handleFolderDragOver(
        event: React.DragEvent,
        folderId: string
    ) {
        event.preventDefault();

        event.dataTransfer.dropEffect =
            "move";

        setDragOverFolderId(folderId);
    }

    function handleFolderDrop(
        event: React.DragEvent,
        folderId: string
    ) {
        event.preventDefault();
        event.stopPropagation();

        setDragOverFolderId(null);

        const fileId =
            event.dataTransfer.getData(
                "application/x-cloudy-file-id"
            );

        if (fileId) {
            const existingFile =
                files.find(
                    (file) =>
                        file.id === fileId
                );

            if (existingFile) {
                void moveFileToFolder(
                    existingFile,
                    folderId
                );
            }

            return;
        }

        if (
            event.dataTransfer.files &&
            event.dataTransfer.files.length > 0
        ) {
            chooseFiles(
                Array.from(
                    event.dataTransfer.files
                ),
                folderId
            );
        }
    }

    function handleFolderDragLeave(
        event: React.DragEvent
    ) {
        const currentTarget =
            event.currentTarget as HTMLElement;

        const relatedTarget =
            event.relatedTarget as
            | Node
            | null;

        if (
            relatedTarget &&
            currentTarget.contains(
                relatedTarget
            )
        ) {
            return;
        }

        setDragOverFolderId(null);
    }

    const filteredAndSortedFiles =
        useMemo(() => {
            let filtered = [...files];

            if (selectedFolderId) {
                filtered =
                    filtered.filter(
                        (file) =>
                            file.folderId ===
                            selectedFolderId
                    );
            } else {
                filtered =
                    filtered.filter(
                        (file) =>
                            !file.folderId
                    );
            }

            if (search.trim()) {
                const query =
                    search
                        .toLowerCase()
                        .trim();

                filtered =
                    filtered.filter(
                        (file) =>
                            file.name
                                .toLowerCase()
                                .includes(query)
                    );
            }

            if (filter === "public") {
                filtered =
                    filtered.filter(
                        (file) =>
                            file.isPublic
                    );
            }

            if (filter === "private") {
                filtered =
                    filtered.filter(
                        (file) =>
                            !file.isPublic
                    );
            }

            filtered.sort((a, b) => {
                if (sort === "newest") {
                    return (
                        new Date(
                            b.createdAt
                        ).getTime() -
                        new Date(
                            a.createdAt
                        ).getTime()
                    );
                }

                if (sort === "oldest") {
                    return (
                        new Date(
                            a.createdAt
                        ).getTime() -
                        new Date(
                            b.createdAt
                        ).getTime()
                    );
                }

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

                return 0;
            });

            return filtered;
        }, [
            files,
            selectedFolderId,
            search,
            filter,
            sort,
        ]);

    const visibleStorage =
        storage.usedBytes;

    const selectedFolder =
        folders.find(
            (folder) =>
                folder.id ===
                selectedFolderId
        );

    return (
        <main className="min-h-screen w-full bg-[#f5f7fb] text-slate-900">
            {/* Delete Folder Confirmation */}
            {deleteFolderTarget && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/20 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                            <Trash2 size={20} />
                        </div>

                        <h3 className="mt-4 text-base font-bold text-slate-900">
                            Delete folder?
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Are you sure you want
                            to delete{" "}
                            <span className="font-semibold text-slate-700">
                                "{deleteFolderTarget.name}"
                            </span>
                            ?
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-400">
                            Files inside this
                            folder will be moved
                            back to My Files.
                            Your files will not be
                            deleted.
                        </p>

                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                disabled={
                                    deletingFolderId !==
                                    null
                                }
                                onClick={() =>
                                    setDeleteFolderTarget(
                                        null
                                    )
                                }
                                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={
                                    deletingFolderId !==
                                    null
                                }
                                onClick={() =>
                                    void deleteFolder(
                                        deleteFolderTarget
                                    )
                                }
                                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {deletingFolderId ===
                                    deleteFolderTarget.id
                                    ? "Deleting..."
                                    : "Delete folder"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-32px)] max-w-md sm:right-6 sm:top-6 sm:w-full">
                    <div
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${toast.type ===
                                "success"
                                ? "border-emerald-200 bg-white text-emerald-700"
                                : toast.type ===
                                    "error"
                                    ? "border-red-200 bg-white text-red-700"
                                    : "border-slate-200 bg-white text-slate-700"
                            }`}
                    >
                        <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toast.type ===
                                    "success"
                                    ? "bg-emerald-100"
                                    : toast.type ===
                                        "error"
                                        ? "bg-red-100"
                                        : "bg-slate-100"
                                }`}
                        >
                            {toast.type ===
                                "success"
                                ? "✓"
                                : toast.type ===
                                    "error"
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
                            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {/* Header */}
                <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1e3a5f]">
                            Dashboard
                        </p>

                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            My Files
                        </h1>

                        <p className="mt-1 max-w-xl text-sm text-slate-500">
                            Welcome back,{" "}
                            <span className="font-medium text-slate-700">
                                {user?.username ||
                                    "User"}
                            </span>
                            . Store, organize
                            and securely share
                            your files.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4f8] text-[#1e3a5f]">
                            <Upload size={19} />
                        </div>

                        <div>
                            <p className="text-xs font-medium text-slate-400">
                                Storage used
                            </p>

                            <p className="text-sm font-semibold text-slate-800">
                                {formatSize(
                                    visibleStorage
                                )}{" "}
                                <span className="font-normal text-slate-400">
                                    /{" "}
                                    {formatSize(
                                        storage.totalBytes
                                    )}
                                </span>
                            </p>
                        </div>
                    </div>
                </header>

                {/* Upload */}
                <section className="mt-8">
                    <div
                        onClick={() =>
                            fileInputRef.current?.click()
                        }
                        onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            setDraggingUpload(
                                true
                            );
                        }}
                        onDragLeave={(event) => {
                            const current =
                                event.currentTarget;

                            const related =
                                event.relatedTarget as
                                | Node
                                | null;

                            if (
                                related &&
                                current.contains(
                                    related
                                )
                            ) {
                                return;
                            }

                            setDraggingUpload(
                                false
                            );
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            setDraggingUpload(
                                false
                            );

                            if (
                                event.dataTransfer
                                    .files
                                    ?.length
                            ) {
                                chooseFiles(
                                    Array.from(
                                        event
                                            .dataTransfer
                                            .files
                                    ),
                                    selectedFolderId
                                );
                            }
                        }}
                        className={`group relative cursor-pointer overflow-hidden rounded-[24px] border border-dashed p-7 text-center transition-all duration-200 sm:p-9 ${draggingUpload
                                ? "border-[#1e3a5f] bg-[#f4f7fa] shadow-md shadow-slate-200"
                                : "border-slate-300 bg-white hover:border-[#1e3a5f] hover:bg-slate-50"
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            hidden
                            onChange={(event) => {
                                if (
                                    event
                                        .currentTarget
                                        .files
                                        ?.length
                                ) {
                                    chooseFiles(
                                        Array.from(
                                            event
                                                .currentTarget
                                                .files
                                        ),
                                        selectedFolderId
                                    );
                                }
                            }}
                        />

                        <div
                            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200 ${draggingUpload
                                    ? "bg-[#1e3a5f] text-white shadow-md shadow-slate-300"
                                    : "bg-[#eef4f8] text-[#1e3a5f] group-hover:bg-[#e2ebf2]"
                                }`}
                        >
                            <Upload
                                size={28}
                                strokeWidth={1.8}
                            />
                        </div>

                        <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-800">
                            {selectedFolder
                                ? `Upload to ${selectedFolder.name}`
                                : "Upload your files"}
                        </h2>

                        <p className="mt-1.5 text-sm text-slate-500">
                            Drag & drop files here
                            or click to browse
                        </p>

                        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17304f]">
                            <Upload size={15} />
                            Choose files
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-400">
                            <span>
                                Max 1 GB per file
                            </span>

                            <span className="h-1 w-1 rounded-full bg-slate-300" />

                            <span>
                                Multiple files
                                supported
                            </span>

                            <span className="h-1 w-1 rounded-full bg-slate-300" />

                            <span>
                                Secure upload
                            </span>
                        </div>
                    </div>

                    {/* Upload Queue */}
                    {uploads.length > 0 && (
                        <div className="mt-4 space-y-3">
                            {uploads.map(
                                (item) => (
                                    <div
                                        key={
                                            item.id
                                        }
                                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4f8] text-[10px] font-bold text-[#1e3a5f]">
                                                {getFileIcon(
                                                    item
                                                        .file
                                                        .type ||
                                                    "application/octet-stream"
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-800">
                                                            {
                                                                item
                                                                    .file
                                                                    .name
                                                            }
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {formatSize(
                                                                item
                                                                    .file
                                                                    .size
                                                            )}

                                                            {item.folderId && (
                                                                <>
                                                                    {" "}
                                                                    •{" "}
                                                                    {
                                                                        folders.find(
                                                                            (
                                                                                folder
                                                                            ) =>
                                                                                folder.id ===
                                                                                item.folderId
                                                                        )
                                                                            ?.name
                                                                    }
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>

                                                    {item.status ===
                                                        "completed" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setUploads(
                                                                    (
                                                                        current
                                                                    ) =>
                                                                        current.filter(
                                                                            (
                                                                                upload
                                                                            ) =>
                                                                                upload.id !==
                                                                                item.id
                                                                        )
                                                                )
                                                            }
                                                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                        >
                                                            Clear
                                                        </button>
                                                    ) : item.status ===
                                                        "error" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setUploads(
                                                                    (
                                                                        current
                                                                    ) =>
                                                                        current.filter(
                                                                            (
                                                                                upload
                                                                            ) =>
                                                                                upload.id !==
                                                                                item.id
                                                                        )
                                                                )
                                                            }
                                                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                        >
                                                            Clear
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                cancelUpload(
                                                                    item.id
                                                                )
                                                            }
                                                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                                        >
                                                            {item.status ===
                                                                "cancelled"
                                                                ? "Cancelling..."
                                                                : "Cancel"}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className={`h-full rounded-full transition-[width] duration-200 ${item.status ===
                                                                "error"
                                                                ? "bg-red-500"
                                                                : item.status ===
                                                                    "cancelled"
                                                                    ? "bg-slate-400"
                                                                    : "bg-[#1e3a5f]"
                                                            }`}
                                                        style={{
                                                            width: `${item.progress}%`,
                                                        }}
                                                    />
                                                </div>

                                                <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
                                                    <span>
                                                        {item.status ===
                                                            "completed"
                                                            ? "Completed"
                                                            : item.status ===
                                                                "error"
                                                                ? "Failed"
                                                                : item.status ===
                                                                    "cancelled"
                                                                    ? "Cancelled"
                                                                    : item.status ===
                                                                        "uploading"
                                                                        ? "Uploading..."
                                                                        : "Queued"}
                                                    </span>

                                                    <span>
                                                        {
                                                            item.progress
                                                        }
                                                        %
                                                    </span>
                                                </div>

                                                {item.error && (
                                                    <p className="mt-2 text-xs font-medium text-red-600">
                                                        {
                                                            item.error
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </section>

                {/* Create Folder */}
                <section className="mt-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative min-w-0 flex-1">
                                <FolderIcon
                                    size={17}
                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                />

                                <input
                                    type="text"
                                    value={
                                        newFolderName
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setNewFolderName(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    onKeyDown={(
                                        event
                                    ) => {
                                        if (
                                            event.key ===
                                            "Enter"
                                        ) {
                                            void createFolder();
                                        }
                                    }}
                                    placeholder="Create a new folder..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    void createFolder()
                                }
                                disabled={
                                    creatingFolder ||
                                    !newFolderName.trim()
                                }
                                className="flex items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162d4a] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus size={17} />

                                {creatingFolder
                                    ? "Creating..."
                                    : "Create folder"}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Folders */}
                <section className="mt-8">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">
                                Folders
                            </h2>

                            <p className="mt-1 text-xs text-slate-400">
                                Drag files onto a
                                folder to move
                                them.
                            </p>
                        </div>

                        {selectedFolderId && (
                            <button
                                type="button"
                                onClick={() =>
                                    setSelectedFolderId(
                                        null
                                    )
                                }
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                                Back to My Files
                            </button>
                        )}
                    </div>

                    {folders.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                            <FolderIcon
                                size={28}
                                className="mx-auto text-slate-300"
                            />

                            <p className="mt-3 text-sm font-semibold text-slate-700">
                                No folders yet
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                                Create your first
                                folder above.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {folders.map(
                                (folder) => {
                                    const isActive =
                                        selectedFolderId ===
                                        folder.id;

                                    const isDropTarget =
                                        dragOverFolderId ===
                                        folder.id;

                                    return (
                                        <div
                                            key={
                                                folder.id
                                            }
                                            onClick={() =>
                                                setSelectedFolderId(
                                                    folder.id
                                                )
                                            }
                                            onDragOver={(
                                                event
                                            ) =>
                                                handleFolderDragOver(
                                                    event,
                                                    folder.id
                                                )
                                            }
                                            onDragLeave={
                                                handleFolderDragLeave
                                            }
                                            onDrop={(
                                                event
                                            ) =>
                                                handleFolderDrop(
                                                    event,
                                                    folder.id
                                                )
                                            }
                                            className={`relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${getFolderColor(
                                                folder.id
                                            )} p-4 text-white shadow-md transition-all duration-200 ${isDropTarget
                                                    ? "scale-[1.03] shadow-2xl ring-4 ring-blue-300/60"
                                                    : "hover:-translate-y-0.5 hover:shadow-xl"
                                                } ${isActive
                                                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#f5f7fb]"
                                                    : ""
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                                                    <FolderIcon
                                                        size={
                                                            22
                                                        }
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isDropTarget && (
                                                        <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold backdrop-blur-sm">
                                                            Drop
                                                            here
                                                        </span>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={(
                                                            event
                                                        ) => {
                                                            event.stopPropagation();

                                                            setDeleteFolderTarget(
                                                                folder
                                                            );
                                                        }}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/10 text-white/80 backdrop-blur-sm transition hover:bg-red-500 hover:text-white"
                                                        aria-label={`Delete ${folder.name}`}
                                                    >
                                                        <Trash2
                                                            size={
                                                                15
                                                            }
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            <p className="mt-4 truncate text-sm font-bold">
                                                {
                                                    folder.name
                                                }
                                            </p>

                                            <p className="mt-1 text-[11px] text-white/70">
                                                {formatDate(
                                                    folder.createdAt
                                                )}
                                            </p>

                                            {isDropTarget && (
                                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <div className="rounded-xl bg-white/20 px-3 py-2 text-xs font-bold backdrop-blur-md">
                                                        Release
                                                        to
                                                        move
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </section>

                {/* Files */}
                <section className="mt-9">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Location
                                </p>

                                <span className="text-slate-300">
                                    /
                                </span>

                                <p className="text-xs font-bold text-slate-700">
                                    {selectedFolder
                                        ? selectedFolder.name
                                        : "My Files"}
                                </p>
                            </div>

                            <p className="mt-2 text-sm font-medium text-slate-500">
                                {
                                    filteredAndSortedFiles.length
                                }{" "}
                                file
                                {filteredAndSortedFiles.length ===
                                    1
                                    ? ""
                                    : "s"}
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={search}
                                onChange={(
                                    event
                                ) =>
                                    setSearch(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-4 focus:ring-[#1e3a5f]/10 sm:w-56"
                            />

                            <select
                                value={filter}
                                onChange={(
                                    event
                                ) =>
                                    setFilter(
                                        event
                                            .target
                                            .value as
                                        | "all"
                                        | "public"
                                        | "private"
                                    )
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-500/10"
                            >
                                <option value="all">
                                    All files
                                </option>

                                <option value="public">
                                    Public
                                </option>

                                <option value="private">
                                    Private
                                </option>
                            </select>

                            <select
                                value={sort}
                                onChange={(
                                    event
                                ) =>
                                    setSort(
                                        event
                                            .target
                                            .value as
                                        | "newest"
                                        | "oldest"
                                        | "name"
                                        | "size"
                                    )
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            >
                                <option value="newest">
                                    Newest first
                                </option>

                                <option value="oldest">
                                    Oldest first
                                </option>

                                <option value="name">
                                    Name (A-Z)
                                </option>

                                <option value="size">
                                    Size (Largest)
                                </option>
                            </select>
                        </div>
                    </div>

                    {/* File list */}
                    {loading ? (
                        <div className="mt-6 space-y-3">
                            {[1, 2, 3, 4].map(
                                (item) => (
                                    <div
                                        key={
                                            item
                                        }
                                        className="h-20 animate-pulse rounded-2xl bg-slate-200"
                                    />
                                )
                            )}
                        </div>
                    ) : filteredAndSortedFiles.length ===
                        0 ? (
                        <div className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <FileText
                                    size={28}
                                />
                            </div>

                            <p className="mt-4 text-sm font-bold text-slate-700">
                                {selectedFolder
                                    ? "This folder is empty"
                                    : "No files found"}
                            </p>

                            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                                {search
                                    ? "Try adjusting your search."
                                    : selectedFolder
                                        ? "Drop files onto this folder or upload files here."
                                        : "Upload a file to get started."}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <div className="divide-y divide-slate-100">
                                {filteredAndSortedFiles.map(
                                    (item) => (
                                        <div
                                            key={
                                                item.id
                                            }
                                            draggable
                                            onDragStart={(
                                                event
                                            ) =>
                                                handleFileDragStart(
                                                    event,
                                                    item
                                                )
                                            }
                                            className="group relative overflow-visible px-4 py-4 transition hover:bg-slate-50 sm:px-5"
                                        >
                                            <div className="flex items-center gap-3 sm:gap-4">
                                                <div className="hidden cursor-grab select-none text-slate-300 group-hover:text-slate-400 sm:block">
                                                    <svg
                                                        width="14"
                                                        height="18"
                                                        viewBox="0 0 14 18"
                                                        fill="currentColor"
                                                    >
                                                        <circle
                                                            cx="3"
                                                            cy="3"
                                                            r="1.5"
                                                        />
                                                        <circle
                                                            cx="11"
                                                            cy="3"
                                                            r="1.5"
                                                        />
                                                        <circle
                                                            cx="3"
                                                            cy="9"
                                                            r="1.5"
                                                        />
                                                        <circle
                                                            cx="11"
                                                            cy="9"
                                                            r="1.5"
                                                        />
                                                        <circle
                                                            cx="3"
                                                            cy="15"
                                                            r="1.5"
                                                        />
                                                        <circle
                                                            cx="11"
                                                            cy="15"
                                                            r="1.5"
                                                        />
                                                    </svg>
                                                </div>

                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4f8] text-[10px] font-bold text-[#1e3a5f] ring-1 ring-[#d5e0eb]">
                                                    {getFileIcon(
                                                        item.mimeType
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    {renameId ===
                                                        item.id ? (
                                                        <input
                                                            type="text"
                                                            value={
                                                                renameName
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                setRenameName(
                                                                    event
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                event
                                                            ) => {
                                                                if (
                                                                    event.key ===
                                                                    "Enter"
                                                                ) {
                                                                    void renameFile(
                                                                        item
                                                                    );
                                                                }

                                                                if (
                                                                    event.key ===
                                                                    "Escape"
                                                                ) {
                                                                    setRenameId(
                                                                        null
                                                                    );

                                                                    setRenameName(
                                                                        ""
                                                                    );
                                                                }
                                                            }}
                                                            autoFocus
                                                            className="w-full rounded-lg border border-blue-500 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f]/10"
                                                        />
                                                    ) : (
                                                        <>
                                                            <p className="truncate text-sm font-semibold text-slate-800">
                                                                {
                                                                    item.name
                                                                }
                                                            </p>

                                                            <p className="mt-1 truncate text-xs text-slate-400">
                                                                {formatSize(
                                                                    item.size
                                                                )}{" "}
                                                                •{" "}
                                                                {formatDate(
                                                                    item.createdAt
                                                                )}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>

                                                <span
                                                    className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${item.isPublic
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

                                                <div
                                                    className="relative shrink-0"
                                                    ref={
                                                        menuId ===
                                                            item.id
                                                            ? menuRef
                                                            : null
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        draggable={
                                                            false
                                                        }
                                                        onClick={(
                                                            event
                                                        ) => {
                                                            if (
                                                                menuId ===
                                                                item.id
                                                            ) {
                                                                setMenuId(
                                                                    null
                                                                );

                                                                return;
                                                            }

                                                            calculateMenuPlacement(
                                                                event
                                                            );

                                                            setMenuId(
                                                                item.id
                                                            );
                                                        }}
                                                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                                        aria-label="File options"
                                                        aria-expanded={
                                                            menuId ===
                                                            item.id
                                                        }
                                                    >
                                                        <MoreVertical
                                                            size={
                                                                18
                                                            }
                                                        />
                                                    </button>

                                                    {menuId ===
                                                        item.id && (
                                                            <div
                                                                className={`absolute right-0 z-[200] w-60 overflow-visible rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl ${menuPlacement ===
                                                                        "top"
                                                                        ? "bottom-11"
                                                                        : "top-11"
                                                                    }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void openFile(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                >
                                                                    <Eye
                                                                        size={
                                                                            16
                                                                        }
                                                                    />
                                                                    Open
                                                                    file
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void toggleFavorite(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                >
                                                                    <Star
                                                                        size={
                                                                            16
                                                                        }
                                                                        fill={
                                                                            item.isFavorite
                                                                                ? "currentColor"
                                                                                : "none"
                                                                        }
                                                                    />

                                                                    {item.isFavorite
                                                                        ? "Remove from favorites"
                                                                        : "Add to favorites"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void toggleVisibility(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                >
                                                                    {item.isPublic ? (
                                                                        <EyeOff
                                                                            size={
                                                                                16
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <Eye
                                                                            size={
                                                                                16
                                                                            }
                                                                        />
                                                                    )}

                                                                    {item.isPublic
                                                                        ? "Make private"
                                                                        : "Make public"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void createShareLink(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                >
                                                                    <LinkIcon
                                                                        size={
                                                                            16
                                                                        }
                                                                    />

                                                                    Copy
                                                                    share
                                                                    link
                                                                </button>

                                                                <div className="my-1 h-px bg-slate-100" />

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setRenameId(
                                                                            item.id
                                                                        );

                                                                        setRenameName(
                                                                            item.name
                                                                        );

                                                                        setMenuId(
                                                                            null
                                                                        );
                                                                    }}
                                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                >
                                                                    <Pencil
                                                                        size={
                                                                            16
                                                                        }
                                                                    />

                                                                    Rename
                                                                </button>

                                                                {folders.length >
                                                                    0 && (
                                                                        <div className="group/move relative">
                                                                            <button
                                                                                type="button"
                                                                                disabled={
                                                                                    movingFileId ===
                                                                                    item.id
                                                                                }
                                                                                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                                            >
                                                                                <span className="flex items-center gap-3">
                                                                                    <FolderIcon
                                                                                        size={
                                                                                            16
                                                                                        }
                                                                                    />

                                                                                    Move
                                                                                    to
                                                                                    folder
                                                                                </span>

                                                                                <span className="text-slate-400">
                                                                                    ›
                                                                                </span>
                                                                            </button>

                                                                            <div className="invisible absolute right-full top-0 z-[220] mr-1 w-52 translate-x-1 rounded-2xl border border-slate-200 bg-white p-1.5 opacity-0 shadow-2xl transition-all duration-150 group-hover/move:visible group-hover/move:translate-x-0 group-hover/move:opacity-100">
                                                                                <div className="px-3 py-2">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                                                        Select
                                                                                        folder
                                                                                    </p>
                                                                                </div>

                                                                                <div className="max-h-52 overflow-y-auto">
                                                                                    {folders.map(
                                                                                        (
                                                                                            folder
                                                                                        ) => (
                                                                                            <button
                                                                                                key={
                                                                                                    folder.id
                                                                                                }
                                                                                                type="button"
                                                                                                disabled={
                                                                                                    movingFileId ===
                                                                                                    item.id ||
                                                                                                    item.folderId ===
                                                                                                    folder.id
                                                                                                }
                                                                                                onClick={() =>
                                                                                                    void moveFileToFolder(
                                                                                                        item,
                                                                                                        folder.id
                                                                                                    )
                                                                                                }
                                                                                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                                                                            >
                                                                                                <span
                                                                                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getFolderColor(
                                                                                                        folder.id
                                                                                                    )} text-white`}
                                                                                                >
                                                                                                    <FolderIcon
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </span>

                                                                                                <span className="truncate">
                                                                                                    {
                                                                                                        folder.name
                                                                                                    }
                                                                                                </span>

                                                                                                {item.folderId ===
                                                                                                    folder.id && (
                                                                                                        <span className="ml-auto text-[10px] font-bold text-blue-500">
                                                                                                            ✓
                                                                                                        </span>
                                                                                                    )}
                                                                                            </button>
                                                                                        )
                                                                                    )}
                                                                                </div>

                                                                                {item.folderId && (
                                                                                    <>
                                                                                        <div className="my-1 h-px bg-slate-100" />

                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={
                                                                                                movingFileId ===
                                                                                                item.id
                                                                                            }
                                                                                            onClick={() =>
                                                                                                void moveFileToFolder(
                                                                                                    item,
                                                                                                    null
                                                                                                )
                                                                                            }
                                                                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                                                                        >
                                                                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef4f8] text-[#1e3a5f]">
                                                                                                <FolderIcon
                                                                                                    size={
                                                                                                        14
                                                                                                    }
                                                                                                />
                                                                                            </span>

                                                                                            <span className="truncate">
                                                                                                Move
                                                                                                to
                                                                                                My
                                                                                                Files
                                                                                            </span>

                                                                                            <span className="ml-auto text-[10px] text-slate-400">
                                                                                                ✓
                                                                                            </span>
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                <div className="my-1 h-px bg-slate-100" />

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void deleteFile(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                                                                >
                                                                    <Trash2
                                                                        size={
                                                                            16
                                                                        }
                                                                    />

                                                                    Move
                                                                    to
                                                                    trash
                                                                </button>
                                                            </div>
                                                        )}
                                                </div>
                                            </div>

                                            {renameId ===
                                                item.id && (
                                                    <div className="mt-3 flex gap-2 pl-0 sm:pl-[86px]">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void renameFile(
                                                                    item
                                                                )
                                                            }
                                                            className="rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162d4a]"
                                                        >
                                                            Save
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRenameId(
                                                                    null
                                                                );

                                                                setRenameName(
                                                                    ""
                                                                );
                                                            }}
                                                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}

                                            <div className="mt-3 sm:hidden">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.isPublic
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
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Footer */}
                <footer className="pb-10 pt-16 text-center text-xs text-slate-400">
                    Cloudy · Store. Share. Secure.
                </footer>
            </div>
        </main>
    );
}