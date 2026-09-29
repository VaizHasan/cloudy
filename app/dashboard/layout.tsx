"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Folder,
  Star,
  Share2,
  Settings,
  Trash2,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

type DashboardLayoutProps = {
  children: ReactNode;
};

type User = {
  id: string;
  username: string;
  email: string;
};

type StorageInfo = {
  usedBytes: number;
  totalBytes: number;
};

const navigation = [
  {
    href: "/dashboard",
    label: "My Files",
    icon: Folder,
  },
  {
    href: "/dashboard/favorites",
    label: "Favorites",
    icon: Star,
  },
  {
    href: "/dashboard/shared",
    label: "Shared",
    icon: Share2,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
  {
    href: "/dashboard/trash",
    label: "Trash",
    icon: Trash2,
  },
];

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [storage, setStorage] = useState<StorageInfo>({
    usedBytes: 0,
    totalBytes: 10 * 1024 * 1024 * 1024,
  });

  const [loadingStorage, setLoadingStorage] = useState(true);

  // Mobile sidebar
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileRef = useRef<HTMLDetailsElement | null>(null);

  // ------------------------------------------------------------
  // Load current user
  // ------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        setLoadingUser(true);

        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }

          throw new Error("Failed to load user");
        }

        const data = await response.json();

        if (mounted) {
          setUser(data.user ?? null);
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      } finally {
        if (mounted) {
          setLoadingUser(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ------------------------------------------------------------
  // Load storage information
  // ------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadStorage() {
      try {
        setLoadingStorage(true);

        const response = await fetch("/api/storage", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load storage");
        }

        const data = await response.json();

        if (mounted) {
          setStorage({
            usedBytes: Number(data.usedBytes) || 0,
            totalBytes:
              Number(data.totalBytes) ||
              10 * 1024 * 1024 * 1024,
          });
        }
      } catch (error) {
        console.error("Failed to load storage:", error);
      } finally {
        if (mounted) {
          setLoadingStorage(false);
        }
      }
    }

    loadStorage();

    return () => {
      mounted = false;
    };
  }, []);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent background scrolling while mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        profileRef.current.removeAttribute("open");
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ------------------------------------------------------------
  // Page information
  // ------------------------------------------------------------

  const pageInfo = useMemo(() => {
    if (pathname === "/dashboard") {
      return {
        title: "My Files",
        subtitle: "Secure workspace",
      };
    }

    if (pathname.startsWith("/dashboard/favorites")) {
      return {
        title: "Favorites",
        subtitle: "Your favorite files",
      };
    }

    if (pathname.startsWith("/dashboard/shared")) {
      return {
        title: "Shared",
        subtitle: "Files shared with you",
      };
    }

    if (pathname.startsWith("/dashboard/settings")) {
      return {
        title: "Settings",
        subtitle: "Manage your account",
      };
    }

    if (pathname.startsWith("/dashboard/trash")) {
      return {
        title: "Trash",
        subtitle: "Recently deleted files",
      };
    }

    return {
      title: "Dashboard",
      subtitle: "Secure workspace",
    };
  }, [pathname]);

  // ------------------------------------------------------------
  // Active navigation item
  // ------------------------------------------------------------

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname.startsWith(href);
  };

  // ------------------------------------------------------------
  // User initials
  // ------------------------------------------------------------

  const initials = useMemo(() => {
    if (!user?.username) {
      return "U";
    }

    const parts = user.username
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [user]);

  // ------------------------------------------------------------
  // Storage percentage
  // ------------------------------------------------------------

  const storagePercentage = useMemo(() => {
    if (!storage.totalBytes) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        (storage.usedBytes / storage.totalBytes) * 100
      )
    );
  }, [storage]);

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">

      {/* ========================================================
          MOBILE SIDEBAR OVERLAY
          ======================================================== */}

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ========================================================
          MOBILE SIDEBAR
          ======================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-[#0f172a] text-white transition-transform duration-300 lg:hidden ${mobileMenuOpen
          ? "translate-x-0"
          : "-translate-x-full"
          }`}
      >
        {/* Logo */}

        <div className="shrink-0 px-5 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E3A5F] shadow-[0_2px_8px_rgba(30,58,95,0.18)]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                  aria-hidden="true"
                >
                  <path
                    d="M7.25 18.25H17.5C19.9853 18.25 22 16.2353 22 13.75C22 11.3839 20.1746 9.44439 17.8559 9.26176C17.0325 6.58257 14.5337 4.625 11.575 4.625C8.28294 4.625 5.57922 7.04758 5.1384 10.2222C3.32091 10.6146 2 12.2261 2 14.125C2 16.4042 3.8458 18.25 6.125 18.25"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M12 18V9.5M8.75 12.75L12 9.5L15.25 12.75"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <p className="text-base font-semibold tracking-tight text-white">
                  Cloudy
                </p>

                <p className="mt-0.5 truncate text-xs text-slate-400">
                  Secure file storage
                </p>
              </div>
            </div>

            {/* Close */}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Navigation */}

        <nav className="flex-1 overflow-y-auto px-3">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Workspace
          </p>

          {navigation.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <div key={item.href}>
                {index === 4 && (
                  <div className="my-4 border-t border-white/[0.08]" />
                )}

                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active
                    ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/[0.06]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                >
                  <Icon size={18} strokeWidth={1.8} />

                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Storage */}

        <div className="shrink-0 p-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-300">
                Storage
              </p>

              <p className="text-xs text-slate-500">
                {loadingStorage
                  ? "..."
                  : formatBytes(storage.totalBytes)}
              </p>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-slate-300 transition-all duration-500"
                style={{
                  width: `${storagePercentage}%`,
                }}
              />
            </div>

            <p className="mt-2.5 text-[11px] text-slate-500">
              {loadingStorage
                ? "Calculating storage..."
                : `${formatBytes(
                  storage.usedBytes
                )} of ${formatBytes(
                  storage.totalBytes
                )} used`}
            </p>
          </div>
        </div>
      </aside>

      {/* ========================================================
          DESKTOP SIDEBAR
          ======================================================== */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-[#0f172a] text-white lg:flex lg:flex-col">
        {/* Logo */}

        <div className="shrink-0 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E3A5F] shadow-[0_2px_8px_rgba(30,58,95,0.18)]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
                aria-hidden="true"
              >
                {/* cloud */}
                <path
                  d="M7.25 18.25H17.5C19.9853 18.25 22 16.2353 22 13.75C22 11.3839 20.1746 9.44439 17.8559 9.26176C17.0325 6.58257 14.5337 4.625 11.575 4.625C8.28294 4.625 5.57922 7.04758 5.1384 10.2222C3.32091 10.6146 2 12.2261 2 14.125C2 16.4042 3.8458 18.25 6.125 18.25"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Upload arrow */}
                <path
                  d="M12 18V9.5M8.75 12.75L12 9.5L15.25 12.75"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight text-white">
                Cloudy
              </p>

              <p className="mt-0.5 truncate text-xs text-slate-400">
                Secure file storage
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}

        <nav className="flex-1 overflow-hidden px-3">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Workspace
          </p>

          {navigation.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <div key={item.href}>
                {index === 4 && (
                  <div className="my-4 border-t border-white/[0.08]" />
                )}

                <Link
                  href={item.href}
                  className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active
                    ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/[0.06]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Storage */}

        <div className="shrink-0 p-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-300">
                Storage
              </p>

              <p className="text-xs text-slate-500">
                {loadingStorage
                  ? "..."
                  : formatBytes(storage.totalBytes)}
              </p>
            </div>

            {/* Progress */}

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-slate-300 transition-all duration-500"
                style={{
                  width: `${storagePercentage}%`,
                }}
              />
            </div>

            {/* Used / total */}

            <p className="mt-2.5 text-[11px] text-slate-500">
              {loadingStorage
                ? "Calculating storage..."
                : `${formatBytes(
                  storage.usedBytes
                )} of ${formatBytes(
                  storage.totalBytes
                )} used`}
            </p>
          </div>
        </div>
      </aside>

      {/* ========================================================
          MAIN CONTENT
          ======================================================== */}

      <div className="min-h-screen min-w-0 lg:ml-64">
        {/* Dynamic Header */}

        <header className="sticky top-0 z-30 border-b border-slate-300 bg-[#f5f7fb]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-16 min-h-16 max-w-[1500px] items-center justify-between px-4 sm:h-20 sm:px-8">
            {/* Mobile logo + hamburger */}

            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white hover:text-slate-900"
                aria-label="Open menu"
              >
                <Menu size={22} strokeWidth={1.8} />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] shadow-[0_2px_8px_rgba(30,58,95,0.18)]">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-white"
                    aria-hidden="true"
                  >
                    <path
                      d="M7.25 18.25H17.5C19.9853 18.25 22 16.2353 22 13.75C22 11.3839 20.1746 9.44439 17.8559 9.26176C17.0325 6.58257 14.5337 4.625 11.575 4.625C8.28294 4.625 5.57922 7.04758 5.1384 10.2222C3.32091 10.6146 2 12.2261 2 14.125C2 16.4042 3.8458 18.25 6.125 18.25"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M12 18V9.5M8.75 12.75L12 9.5L15.25 12.75"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <span className="font-bold">
                  Cloudy
                </span>
              </div>
            </div>

            {/* Dynamic title */}

            <div className="hidden lg:block">
              <p className="text-sm font-medium text-slate-500">
                {pageInfo.subtitle}
              </p>

              <h1 className="text-xl font-bold tracking-tight">
                {pageInfo.title}
              </h1>
            </div>

            {/* Right side */}

            <div className="ml-auto flex items-center gap-2 sm:gap-3">

              {/* User menu */}

              <details ref={profileRef} className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 transition hover:bg-white">
                  {/* Avatar */}

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#334e68] text-xs font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-sm">
                    {loadingUser ? (
                      <div className="h-full w-full animate-pulse rounded-full bg-slate-300" />
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Name */}

                  <div className="hidden text-left sm:block">
                    <p className="max-w-[150px] truncate text-sm font-semibold text-slate-700">
                      {loadingUser ? (
                        <span className="inline-block h-4 w-24 animate-pulse rounded bg-slate-200" />
                      ) : (
                        user?.username || "User"
                      )}
                    </p>

                    {!loadingUser && user?.email && (
                      <p className="mt-0.5 max-w-[170px] truncate text-[11px] text-slate-400">
                        {user.email}
                      </p>
                    )}
                  </div>

                  <ChevronDown
                    size={16}
                    strokeWidth={2}
                    className="hidden text-slate-400 sm:block"
                  />
                </summary>

                {/* Dropdown */}

                <div className="absolute right-0 top-14 z-50 w-[calc(100vw-2rem)] max-w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                  {/* Account info */}

                  <div className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#334e68] text-sm font-bold text-white">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {user?.username || "User"}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Settings */}

                  <Link
                    href="/dashboard/settings"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Settings size={18} strokeWidth={1.8} />
                    Settings
                  </Link>

                  {/* Logout */}

                  <button
                    type="button"
                    onClick={logout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={18} strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>

        {/* Current page */}

        {children}
      </div>
    </main>
  );
}