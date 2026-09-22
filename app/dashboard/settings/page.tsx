"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Check,
    Eye,
    EyeOff,
    Lock,
    LogOut,
    User,
} from "lucide-react";

type UserAccount = {
    id: string;
    username: string;
    email: string;
};

type Toast = {
    type: "success" | "error" | "info";
    text: string;
};

export default function SettingsPage() {
    const router = useRouter();

    const [user, setUser] = useState<UserAccount | null>(null);
    const [loading, setLoading] = useState(true);

    const [username, setUsername] = useState("");
    const [savingUsername, setSavingUsername] = useState(false);

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const [deletingFiles, setDeletingFiles] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
    const [showDeleteAccountPassword, setShowDeleteAccountPassword] =
        useState(false);
    const [confirmDeleteFiles, setConfirmDeleteFiles] = useState(false);
    const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

    const [loggingOut, setLoggingOut] = useState(false);

    const [toast, setToast] = useState<Toast | null>(null);

    useEffect(() => {
        loadUser();
    }, []);

    useEffect(() => {
        if (!toast) return;

        const timer = setTimeout(() => {
            setToast(null);
        }, 3000);

        return () => clearTimeout(timer);
    }, [toast]);

    async function loadUser() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "include",
            });

            if (response.status === 401) {
                router.push("/login");
                return;
            }

            if (!response.ok) {
                throw new Error("Failed to load account");
            }

            const data = await response.json();
            const account = data.user ?? data;

            setUser(account);
            setUsername(account.username || "");
        } catch {
            setToast({
                type: "error",
                text: "Unable to load account",
            });
        } finally {
            setLoading(false);
        }
    }

    async function updateUsername() {
        if (!user || !username.trim()) return;

        if (username.trim() === user.username) {
            setToast({
                type: "info",
                text: "No changes to save",
            });
            return;
        }

        setSavingUsername(true);

        try {
            const response = await fetch("/api/auth/me", {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to update username");
            }

            const updatedUser = data.user ?? data;

            setUser((prev) =>
                prev
                    ? {
                        ...prev,
                        username: updatedUser.username ?? username.trim(),
                    }
                    : prev
            );

            setUsername(updatedUser.username ?? username.trim());

            setToast({
                type: "success",
                text: "Username updated",
            });
        } catch (error) {
            setToast({
                type: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to update username",
            });
        } finally {
            setSavingUsername(false);
        }
    }

    async function changePassword() {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setToast({
                type: "error",
                text: "Please fill in all password fields",
            });
            return;
        }

        if (newPassword.length < 12) {
            setToast({
                type: "error",
                text: "New password must be at least 12 characters",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setToast({
                type: "error",
                text: "Passwords do not match",
            });
            return;
        }

        if (newPassword === currentPassword) {
            setToast({
                type: "error",
                text: "New password must be different",
            });
            return;
        }

        setChangingPassword(true);

        try {
            const response = await fetch("/api/auth/me", {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to change password");
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowPasswordForm(false);

            setToast({
                type: "success",
                text: "Password changed successfully",
            });
        } catch (error) {
            setToast({
                type: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to change password",
            });
        } finally {
            setChangingPassword(false);
        }
    }

    async function deleteAllFiles() {
        setDeletingFiles(true);

        try {
            const response = await fetch("/api/files/delete-all", {
                method: "DELETE",
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to delete files");
            }

            setConfirmDeleteFiles(false);

            setToast({
                type: "success",
                text: "All files and folders deleted",
            });
        } catch (error) {
            setToast({
                type: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete files",
            });
        } finally {
            setDeletingFiles(false);
        }
    }

    async function deleteAccount() {
        if (!deleteAccountPassword) {
            setToast({
                type: "error",
                text: "Enter your password to continue",
            });
            return;
        }

        setDeletingAccount(true);

        try {
            const response = await fetch("/api/auth/me", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    password: deleteAccountPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to delete account");
            }

            router.push("/login");
        } catch (error) {
            setToast({
                type: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete account",
            });
        } finally {
            setDeletingAccount(false);
        }
    }

    async function logout() {
        setLoggingOut(true);

        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });
        } finally {
            router.push("/login");
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f7fb]">
                <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-8 space-y-2">
                        <div className="h-8 w-32 animate-pulse rounded-md bg-slate-200" />
                        <div className="h-4 w-64 animate-pulse rounded-md bg-slate-200" />
                    </div>

                    <div className="space-y-5">
                        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white" />
                        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
                        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f7fb]">
            {toast && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm">
                    <div
                        className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ${toast.type === "success"
                            ? "border-emerald-200"
                            : toast.type === "error"
                                ? "border-red-200"
                                : "border-slate-200"
                            }`}
                    >
                        <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toast.type === "success"
                                ? "bg-emerald-50 text-emerald-600"
                                : toast.type === "error"
                                    ? "bg-red-50 text-red-600"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                        >
                            {toast.type === "success" ? (
                                <Check size={15} />
                            ) : (
                                <span className="text-xs font-semibold">!</span>
                            )}
                        </div>

                        <span className="min-w-0 flex-1 text-slate-700">
                            {toast.text}
                        </span>
                    </div>
                </div>
            )}

            <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Settings
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage your account and security.
                    </p>
                </div>

                <div className="space-y-5">
                    {/* Profile */}
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f]">
                                    <User size={18} />
                                </div>

                                <div>
                                    <h2 className="text-sm font-semibold text-slate-900">
                                        Profile
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Your account information
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                        Username
                                    </label>

                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                        Email
                                    </label>

                                    <input
                                        type="email"
                                        value={user?.email || ""}
                                        disabled
                                        className="h-10 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-5 flex justify-end">
                                <button
                                    type="button"
                                    onClick={updateUsername}
                                    disabled={
                                        savingUsername ||
                                        !username.trim() ||
                                        username.trim() === user?.username
                                    }
                                    className="inline-flex h-9 items-center justify-center rounded-md bg-[#1e3a5f] px-4 text-sm font-medium text-white transition hover:bg-[#16324f] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {savingUsername ? "Saving..." : "Save changes"}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Password */}
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f]">
                                    <Lock size={18} />
                                </div>

                                <div>
                                    <h2 className="text-sm font-semibold text-slate-900">
                                        Password
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Keep your account secure
                                    </p>
                                </div>
                            </div>

                            {!showPasswordForm && (
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordForm(true)}
                                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                    Change password
                                </button>
                            )}
                        </div>

                        {showPasswordForm && (
                            <div className="border-t border-slate-200 p-5">
                                <div className="max-w-xl space-y-4">
                                    <PasswordField
                                        label="Current password"
                                        value={currentPassword}
                                        onChange={setCurrentPassword}
                                        visible={showCurrentPassword}
                                        onToggle={() =>
                                            setShowCurrentPassword((value) => !value)
                                        }
                                    />

                                    <div>
                                        <PasswordField
                                            label="New password"
                                            value={newPassword}
                                            onChange={setNewPassword}
                                            visible={showNewPassword}
                                            onToggle={() => setShowNewPassword((value) => !value)}
                                        />

                                        <p className="mt-1.5 text-xs text-slate-500">
                                            Minimum 12 characters.
                                        </p>
                                    </div>

                                    <PasswordField
                                        label="Confirm new password"
                                        value={confirmPassword}
                                        onChange={setConfirmPassword}
                                        visible={showConfirmPassword}
                                        onToggle={() =>
                                            setShowConfirmPassword((value) => !value)
                                        }
                                    />

                                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowPasswordForm(false);
                                                setCurrentPassword("");
                                                setNewPassword("");
                                                setConfirmPassword("");
                                            }}
                                            className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={changePassword}
                                            disabled={changingPassword}
                                            className="h-9 rounded-md bg-[#1e3a5f] px-4 text-sm font-medium text-white transition hover:bg-[#16324f] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {changingPassword ? "Changing..." : "Update password"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Danger Zone */}
                    <section className="overflow-hidden rounded-xl border border-red-200 bg-white">
                        <div className="border-b border-red-100 px-5 py-4">
                            <h2 className="text-sm font-semibold text-red-600">
                                Danger zone
                            </h2>
                        </div>

                        <div className="divide-y divide-slate-100">
                            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-slate-900">
                                        Delete all files and folders
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Permanently remove all stored files and folders.
                                    </p>
                                </div>

                                {!confirmDeleteFiles ? (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteFiles(true)}
                                        className="h-9 shrink-0 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                    >
                                        Delete all
                                    </button>
                                ) : (
                                    <div className="flex shrink-0 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteFiles(false)}
                                            className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={deleteAllFiles}
                                            disabled={deletingFiles}
                                            className="h-9 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                        >
                                            {deletingFiles ? "Deleting..." : "Confirm"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-5">
                                {!confirmDeleteAccount ? (
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-slate-900">
                                                Delete account
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Permanently delete your account and all associated
                                                data.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteAccount(true)}
                                            className="h-9 shrink-0 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                        >
                                            Delete account
                                        </button>
                                    </div>
                                ) : (
                                    <div className="max-w-xl">
                                        <div className="mb-4">
                                            <h3 className="text-sm font-medium text-red-600">
                                                Confirm account deletion
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Enter your password to permanently delete your account.
                                            </p>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type={showDeleteAccountPassword ? "text" : "password"}
                                                value={deleteAccountPassword}
                                                onChange={(e) =>
                                                    setDeleteAccountPassword(e.target.value)
                                                }
                                                placeholder="Your password"
                                                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowDeleteAccountPassword(
                                                        (value) => !value
                                                    )
                                                }
                                                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                                            >
                                                {showDeleteAccountPassword ? (
                                                    <EyeOff size={16} />
                                                ) : (
                                                    <Eye size={16} />
                                                )}
                                            </button>
                                        </div>

                                        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setConfirmDeleteAccount(false);
                                                    setDeleteAccountPassword("");
                                                }}
                                                className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                type="button"
                                                onClick={deleteAccount}
                                                disabled={deletingAccount}
                                                className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {deletingAccount ? "Deleting..." : "Delete account"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Sign Out */}
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                    <LogOut size={18} />
                                </div>

                                <div>
                                    <h2 className="text-sm font-semibold text-slate-900">
                                        Sign out
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Sign out of this account on this device.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={logout}
                                disabled={loggingOut}
                                className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loggingOut ? "Signing out..." : "Sign out"}
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

function PasswordField({
    label,
    value,
    onChange,
    visible,
    onToggle,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onToggle: () => void;
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
                {label}
            </label>

            <div className="relative">
                <input
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10"
                />

                <button
                    type="button"
                    onClick={onToggle}
                    tabIndex={-1}
                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                >
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}