"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Eye,
    EyeOff,
    Lock,
    Trash2,
    User,
    LogOut,
    Check,
    X,
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

    // ------------------------------------------------------------
    // Account
    // ------------------------------------------------------------

    const [user, setUser] = useState<UserAccount | null>(null);
    const [loading, setLoading] = useState(true);

    // ------------------------------------------------------------
    // Toast
    // ------------------------------------------------------------

    const [toast, setToast] = useState<Toast | null>(null);

    // ------------------------------------------------------------
    // Username
    // ------------------------------------------------------------

    const [newUsername, setNewUsername] = useState("");
    const [updatingUsername, setUpdatingUsername] = useState(false);

    // ------------------------------------------------------------
    // Password
    // ------------------------------------------------------------

    const [showPasswordForm, setShowPasswordForm] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [updatingPassword, setUpdatingPassword] = useState(false);

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ------------------------------------------------------------
    // Delete all files
    // ------------------------------------------------------------

    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
    const [deletingAllFiles, setDeletingAllFiles] = useState(false);

    // ------------------------------------------------------------
    // Delete account
    // ------------------------------------------------------------

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [showDeletePassword, setShowDeletePassword] = useState(false);

    // ------------------------------------------------------------
    // Toast helper
    // ------------------------------------------------------------

    function showToast(
        text: string,
        type: "success" | "error" | "info" = "success"
    ) {
        setToast({
            text,
            type,
        });
    }

    // Automatically remove toast.
    useEffect(() => {
        if (!toast) return;

        const timer = window.setTimeout(() => {
            setToast(null);
        }, 3500);

        return () => {
            window.clearTimeout(timer);
        };
    }, [toast]);

    // ------------------------------------------------------------
    // Load user
    // ------------------------------------------------------------

    async function loadUser() {
        try {
            const response = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "include",
                cache: "no-store",
            });

            let data: any = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (!response.ok) {
                if (response.status === 401) {
                    router.replace("/login");
                    return;
                }

                throw new Error(
                    data.error || "Unable to load account information."
                );
            }

            if (!data.user) {
                throw new Error("Account information is unavailable.");
            }

            const account: UserAccount = {
                id: String(data.user.id),
                username: String(data.user.username || ""),
                email: String(data.user.email || ""),
            };

            setUser(account);
            setNewUsername(account.username);
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
        let mounted = true;

        async function initializePage() {
            try {
                setLoading(true);

                if (mounted) {
                    await loadUser();
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        initializePage();

        return () => {
            mounted = false;
        };
    }, []);

    // ------------------------------------------------------------
    // Username validation
    // ------------------------------------------------------------

    function validateUsername(username: string) {
        const value = username.trim();

        if (!value) {
            return "Username cannot be empty.";
        }

        if (value.length < 3) {
            return "Username must be at least 3 characters.";
        }

        if (value.length > 30) {
            return "Username must be 30 characters or less.";
        }

        if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
            return "Username can only contain letters, numbers, dots, underscores, and hyphens.";
        }

        return null;
    }

    // ------------------------------------------------------------
    // Update username
    // ------------------------------------------------------------

    async function updateUsername() {
        const username = newUsername.trim();

        const validationError = validateUsername(username);

        if (validationError) {
            showToast(validationError, "error");
            return;
        }

        if (username === user?.username) {
            showToast("No username changes were made.", "info");
            return;
        }

        try {
            setUpdatingUsername(true);

            const response = await fetch("/api/auth/me", {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username,
                }),
            });

            let data: any = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to update username."
                );
            }

            if (data.user) {
                setUser({
                    id: String(data.user.id),
                    username: String(data.user.username || username),
                    email: String(data.user.email || user?.email || ""),
                });

                setNewUsername(
                    String(data.user.username || username)
                );
            } else {
                setUser((previous) =>
                    previous
                        ? {
                            ...previous,
                            username,
                        }
                        : previous
                );

                setNewUsername(username);
            }

            showToast("Username updated successfully.", "success");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to update username.",
                "error"
            );

            setNewUsername(user?.username || "");
        } finally {
            setUpdatingUsername(false);
        }
    }

    // ------------------------------------------------------------
    // Password validation
    // ------------------------------------------------------------

    const passwordRequirements = {
        length: newPassword.length >= 12,
        lowercase: /[a-z]/.test(newPassword),
        uppercase: /[A-Z]/.test(newPassword),
        number: /\d/.test(newPassword),
        special: /[^A-Za-z0-9]/.test(newPassword),
    };

    const passwordRequirementCount =
        Object.values(passwordRequirements).filter(Boolean).length;

    const passwordsMatch =
        confirmPassword.length > 0 &&
        newPassword === confirmPassword;

    function validatePassword() {
        if (!currentPassword) {
            return "Enter your current password.";
        }

        if (!newPassword) {
            return "Enter your new password.";
        }

        if (!confirmPassword) {
            return "Confirm your new password.";
        }

        if (newPassword.length < 12) {
            return "New password must be at least 12 characters.";
        }

        if (newPassword === currentPassword) {
            return "New password must be different from your current password.";
        }

        if (!/[a-z]/.test(newPassword)) {
            return "New password must contain at least one lowercase letter.";
        }

        if (!/[A-Z]/.test(newPassword)) {
            return "New password must contain at least one uppercase letter.";
        }

        if (!/\d/.test(newPassword)) {
            return "New password must contain at least one number.";
        }

        if (!/[^A-Za-z0-9]/.test(newPassword)) {
            return "New password must contain at least one special character.";
        }

        if (newPassword !== confirmPassword) {
            return "New password and confirmation do not match.";
        }

        return null;
    }

    // ------------------------------------------------------------
    // Update password
    // ------------------------------------------------------------

    async function updatePassword() {
        const validationError = validatePassword();

        if (validationError) {
            showToast(validationError, "error");
            return;
        }

        try {
            setUpdatingPassword(true);

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

            let data: any = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to update password."
                );
            }

            showToast(
                "Password updated successfully.",
                "success"
            );

            // Clear password fields after successful update.
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

            setShowCurrentPassword(false);
            setShowNewPassword(false);
            setShowConfirmPassword(false);

            setShowPasswordForm(false);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to update password.",
                "error"
            );
        } finally {
            setUpdatingPassword(false);
        }
    }

    // ------------------------------------------------------------
    // Cancel password form
    // ------------------------------------------------------------

    function cancelPasswordChange() {
        setShowPasswordForm(false);

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    }

    // ------------------------------------------------------------
    // Delete all files
    // ------------------------------------------------------------

    async function deleteAllFiles() {
        try {
            setDeletingAllFiles(true);

            const response = await fetch("/api/files/delete-all", {
                method: "DELETE",
                credentials: "include",
            });

            let data: any = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to delete files."
                );
            }

            showToast(
                "All files and folders deleted successfully.",
                "success"
            );

            setShowDeleteAllConfirm(false);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to delete files.",
                "error"
            );
        } finally {
            setDeletingAllFiles(false);
        }
    }

    // ------------------------------------------------------------
    // Delete account
    // ------------------------------------------------------------

    async function deleteAccount() {
        if (!deletePassword) {
            showToast(
                "Password is required to delete your account.",
                "error"
            );
            return;
        }

        try {
            setDeletingAccount(true);

            const response = await fetch("/api/auth/me", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    password: deletePassword,
                }),
            });

            let data: any = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to delete account."
                );
            }

            setDeletePassword("");
            setShowDeleteConfirm(false);

            showToast(
                "Account deleted successfully.",
                "success"
            );

            window.setTimeout(() => {
                router.replace("/login");
                router.refresh();
            }, 800);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Unable to delete account.",
                "error"
            );
        } finally {
            setDeletingAccount(false);
        }
    }

    // ------------------------------------------------------------
    // Logout
    // ------------------------------------------------------------

    async function logout() {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });
        } catch {
            // Even if the request fails, redirect the user.
        } finally {
            router.replace("/login");
            router.refresh();
        }
    }

    // ------------------------------------------------------------
    // Password input component
    // ------------------------------------------------------------

    function PasswordInput({
        value,
        onChange,
        placeholder,
        show,
        setShow,
        autoComplete,
        disabled = false,
    }: {
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        show: boolean;
        setShow: (value: boolean) => void;
        autoComplete: string;
        disabled?: boolean;
    }) {
        return (
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-4 focus:ring-[#1e3a5f]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />

                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShow(!show)}
                    disabled={disabled}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {show ? (
                        <EyeOff size={17} />
                    ) : (
                        <Eye size={17} />
                    )}
                </button>
            </div>
        );
    }

    // ------------------------------------------------------------
    // Loading screen
    // ------------------------------------------------------------

    if (loading) {
        return (
            <main className="min-h-full bg-[#f5f7fb] text-slate-900">
                <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8 lg:pb-24">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                            <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
                            <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
                        </div>

                        <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
                        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
                        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
                    </div>
                </div>
            </main>
        );
    }

    // ------------------------------------------------------------
    // Render
    // ------------------------------------------------------------

    return (
        <main className="min-h-full bg-[#f5f7fb] text-slate-900">
            {/* ========================================================
          TOAST
          ======================================================== */}

            {toast && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm sm:right-5 sm:top-5">
                    <div
                        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-2xl shadow-slate-900/10 ${toast.type === "success"
                            ? "border-emerald-200"
                            : toast.type === "error"
                                ? "border-red-200"
                                : "border-slate-200"
                            }`}
                    >
                        <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toast.type === "success"
                                ? "bg-emerald-100 text-emerald-700"
                                : toast.type === "error"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                        >
                            {toast.type === "success" ? (
                                <Check size={17} />
                            ) : toast.type === "error" ? (
                                <X size={17} />
                            ) : (
                                "i"
                            )}
                        </div>

                        <p
                            className={`flex-1 text-sm font-medium ${toast.type === "success"
                                ? "text-emerald-700"
                                : toast.type === "error"
                                    ? "text-red-700"
                                    : "text-slate-700"
                                }`}
                        >
                            {toast.text}
                        </p>

                        <button
                            type="button"
                            onClick={() => setToast(null)}
                            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Close notification"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* ========================================================
          PAGE CONTAINER

          IMPORTANT:
          min-h-full + generous bottom padding allows the entire
          settings page to scroll without clipping.
          ======================================================== */}

            <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8 lg:pb-24">
                {/* ======================================================
            HEADER
            ====================================================== */}

                <section>
                    <p className="text-sm font-semibold text-[#1e3a5f]">
                        Account
                    </p>

                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                        Settings
                    </h1>

                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                        Manage your account, security, files, and preferences.
                    </p>
                </section>

                <div className="mt-8 space-y-6">
                    {/* ====================================================
              ACCOUNT INFORMATION
              ==================================================== */}

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                            <h2 className="font-semibold text-slate-800">
                                Account Information
                            </h2>

                            <p className="mt-1 text-xs text-slate-400">
                                Your account details.
                            </p>
                        </div>

                        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
                            <div className="min-w-0">
                                <label className="text-xs font-medium text-slate-500">
                                    Email Address
                                </label>

                                <p className="mt-1 truncate text-sm font-medium text-slate-800">
                                    {user?.email || "—"}
                                </p>
                            </div>

                            <div className="min-w-0">
                                <label className="text-xs font-medium text-slate-500">
                                    User ID
                                </label>

                                <p className="mt-1 truncate font-mono text-xs text-slate-600">
                                    {user?.id || "—"}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ====================================================
              UPDATE USERNAME
              ==================================================== */}

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                                <User
                                    size={18}
                                    className="text-slate-400"
                                />

                                Update Username
                            </h2>

                            <p className="mt-1 text-xs text-slate-400">
                                Change the name displayed on your account.
                            </p>
                        </div>

                        <div className="space-y-4 px-5 py-5 sm:px-6">
                            <div>
                                <label
                                    htmlFor="username"
                                    className="text-xs font-medium text-slate-500"
                                >
                                    Username
                                </label>

                                <input
                                    id="username"
                                    type="text"
                                    value={newUsername}
                                    onChange={(event) =>
                                        setNewUsername(event.target.value)
                                    }
                                    autoComplete="username"
                                    maxLength={30}
                                    disabled={updatingUsername}
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-4 focus:ring-[#1e3a5f]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    placeholder="Enter username"
                                />

                                <p className="mt-1.5 text-[11px] text-slate-400">
                                    3–30 characters. Letters, numbers, dots,
                                    underscores, and hyphens.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={updateUsername}
                                disabled={
                                    updatingUsername ||
                                    !newUsername.trim() ||
                                    newUsername.trim() === user?.username
                                }
                                className="w-full rounded-xl bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#16324f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            >
                                {updatingUsername
                                    ? "Updating..."
                                    : "Update Username"}
                            </button>
                        </div>
                    </section>

                    {/* ====================================================
              PASSWORD
              ==================================================== */}

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                                <Lock
                                    size={18}
                                    className="text-slate-400"
                                />

                                Change Password
                            </h2>

                            <p className="mt-1 text-xs text-slate-400">
                                Keep your account secure with a strong password.
                            </p>
                        </div>

                        <div className="px-5 py-5 sm:px-6">
                            {!showPasswordForm ? (
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            Password
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            We recommend using a unique password that
                                            you do not use elsewhere.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPasswordForm(true)
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                                    >
                                        Change Password
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {/* Current password */}

                                    <div>
                                        <label
                                            htmlFor="current-password"
                                            className="text-xs font-medium text-slate-500"
                                        >
                                            Current Password
                                        </label>

                                        <div className="mt-1.5">
                                            <PasswordInput
                                                value={currentPassword}
                                                onChange={setCurrentPassword}
                                                placeholder="Enter your current password"
                                                show={showCurrentPassword}
                                                setShow={setShowCurrentPassword}
                                                autoComplete="current-password"
                                                disabled={updatingPassword}
                                            />
                                        </div>
                                    </div>

                                    {/* New password */}

                                    <div>
                                        <label
                                            htmlFor="new-password"
                                            className="text-xs font-medium text-slate-500"
                                        >
                                            New Password
                                        </label>

                                        <div className="mt-1.5">
                                            <PasswordInput
                                                value={newPassword}
                                                onChange={setNewPassword}
                                                placeholder="Create a strong new password"
                                                show={showNewPassword}
                                                setShow={setShowNewPassword}
                                                autoComplete="new-password"
                                                disabled={updatingPassword}
                                            />
                                        </div>

                                        {/* Password requirements */}

                                        {newPassword.length > 0 && (
                                            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                                                <div className="mb-2.5 flex items-center justify-between">
                                                    <p className="text-xs font-semibold text-slate-600">
                                                        Password requirements
                                                    </p>

                                                    <span className="text-[11px] font-medium text-slate-400">
                                                        {passwordRequirementCount}/5
                                                    </span>
                                                </div>

                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <PasswordRequirement
                                                        valid={passwordRequirements.length}
                                                        text="At least 12 characters"
                                                    />

                                                    <PasswordRequirement
                                                        valid={passwordRequirements.lowercase}
                                                        text="One lowercase letter"
                                                    />

                                                    <PasswordRequirement
                                                        valid={passwordRequirements.uppercase}
                                                        text="One uppercase letter"
                                                    />

                                                    <PasswordRequirement
                                                        valid={passwordRequirements.number}
                                                        text="One number"
                                                    />

                                                    <PasswordRequirement
                                                        valid={passwordRequirements.special}
                                                        text="One special character"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm password */}

                                    <div>
                                        <label
                                            htmlFor="confirm-password"
                                            className="text-xs font-medium text-slate-500"
                                        >
                                            Confirm New Password
                                        </label>

                                        <div className="mt-1.5">
                                            <PasswordInput
                                                value={confirmPassword}
                                                onChange={setConfirmPassword}
                                                placeholder="Re-enter your new password"
                                                show={showConfirmPassword}
                                                setShow={setShowConfirmPassword}
                                                autoComplete="new-password"
                                                disabled={updatingPassword}
                                            />
                                        </div>

                                        {confirmPassword.length > 0 && (
                                            <div
                                                className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${passwordsMatch
                                                    ? "text-emerald-600"
                                                    : "text-red-600"
                                                    }`}
                                            >
                                                {passwordsMatch ? (
                                                    <>
                                                        <Check size={14} />
                                                        Passwords match
                                                    </>
                                                ) : (
                                                    <>
                                                        <X size={14} />
                                                        Passwords do not match
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Security note */}

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex gap-3">
                                            <Lock
                                                size={16}
                                                className="mt-0.5 shrink-0 text-slate-400"
                                            />

                                            <p className="text-xs leading-5 text-slate-500">
                                                Your current password is required to
                                                authorize this change. Never share your
                                                password with anyone.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Password actions */}

                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={cancelPasswordChange}
                                            disabled={updatingPassword}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={updatePassword}
                                            disabled={
                                                updatingPassword ||
                                                !currentPassword ||
                                                !newPassword ||
                                                !confirmPassword ||
                                                !passwordsMatch ||
                                                passwordRequirementCount !== 5
                                            }
                                            className="w-full rounded-xl bg-[#1e3a5f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#16324f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                            {updatingPassword
                                                ? "Updating Password..."
                                                : "Update Password"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ====================================================
              DELETE ALL FILES
              ==================================================== */}

                    <section className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 shadow-sm">
                        <div className="border-b border-orange-100 px-5 py-4 sm:px-6">
                            <h2 className="flex items-center gap-2 font-semibold text-orange-900">
                                <Trash2 size={18} />

                                Delete All Files & Folders
                            </h2>

                            <p className="mt-1 text-xs text-orange-700/70">
                                Permanently remove all files and folders.
                            </p>
                        </div>

                        <div className="px-5 py-5 sm:px-6">
                            <p className="text-sm leading-6 text-orange-800">
                                Permanently delete all your files and folders.
                                This action cannot be undone.
                            </p>

                            {!showDeleteAllConfirm ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowDeleteAllConfirm(true)
                                    }
                                    className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 sm:w-auto"
                                >
                                    Delete All Files & Folders
                                </button>
                            ) : (
                                <div className="mt-4 rounded-xl border border-orange-200 bg-white/60 p-4">
                                    <p className="text-sm font-semibold text-orange-900">
                                        Are you absolutely sure?
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-orange-800">
                                        Every file and folder in your account will
                                        be permanently removed.
                                    </p>

                                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowDeleteAllConfirm(false)
                                            }
                                            disabled={deletingAllFiles}
                                            className="w-full rounded-xl border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-800 transition hover:bg-orange-50 disabled:opacity-50 sm:w-auto"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={deleteAllFiles}
                                            disabled={deletingAllFiles}
                                            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                            {deletingAllFiles
                                                ? "Deleting Everything..."
                                                : "Yes, Delete Everything"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ====================================================
              DELETE ACCOUNT
              ==================================================== */}

                    <section className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm">
                        <div className="border-b border-red-100 px-5 py-4 sm:px-6">
                            <h2 className="flex items-center gap-2 font-semibold text-red-900">
                                <Trash2 size={18} />

                                Delete Account
                            </h2>

                            <p className="mt-1 text-xs text-red-700/70">
                                Permanently delete your account and associated
                                data.
                            </p>
                        </div>

                        <div className="px-5 py-5 sm:px-6">
                            <p className="text-sm leading-6 text-red-800">
                                Permanently delete your account and all
                                associated data. This action cannot be undone.
                            </p>

                            {!showDeleteConfirm ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowDeleteConfirm(true)
                                    }
                                    className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 sm:w-auto"
                                >
                                    Delete Account
                                </button>
                            ) : (
                                <div className="mt-4 rounded-xl border border-red-200 bg-white/60 p-4">
                                    <p className="text-sm font-semibold text-red-900">
                                        Confirm account deletion
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-red-800">
                                        Enter your password to permanently delete
                                        your account.
                                    </p>

                                    <div className="mt-4">
                                        <PasswordInput
                                            value={deletePassword}
                                            onChange={setDeletePassword}
                                            placeholder="Enter your account password"
                                            show={showDeletePassword}
                                            setShow={setShowDeletePassword}
                                            autoComplete="current-password"
                                            disabled={deletingAccount}
                                        />
                                    </div>

                                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setDeletePassword("");
                                                setShowDeletePassword(false);
                                            }}
                                            disabled={deletingAccount}
                                            className="w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={deleteAccount}
                                            disabled={
                                                deletingAccount ||
                                                !deletePassword
                                            }
                                            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                            {deletingAccount
                                                ? "Deleting Account..."
                                                : "Yes, Delete My Account"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ====================================================
              LOGOUT
              ==================================================== */}

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <button
                            type="button"
                            onClick={logout}
                            className="flex w-full items-center gap-3 px-5 py-5 text-left transition hover:bg-slate-50 sm:px-6"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                <LogOut size={17} />
                            </div>

                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700">
                                    Sign out
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                    Sign out of this account on this device.
                                </p>
                            </div>
                        </button>
                    </section>

                    {/* Extra bottom breathing room */}
                    <div className="h-8 sm:h-12" />
                </div>
            </div>
        </main>
    );
}

// ============================================================
// Password requirement
// ============================================================

function PasswordRequirement({
    valid,
    text,
}: {
    valid: boolean;
    text: string;
}) {
    return (
        <div
            className={`flex items-center gap-2 text-[11px] ${valid ? "text-emerald-600" : "text-slate-400"
                }`}
        >
            <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${valid
                    ? "bg-emerald-100"
                    : "bg-slate-200"
                    }`}
            >
                {valid ? (
                    <Check size={10} strokeWidth={2.5} />
                ) : (
                    <span className="h-1 w-1 rounded-full bg-slate-400" />
                )}
            </span>

            <span>{text}</span>
        </div>
    );
}

