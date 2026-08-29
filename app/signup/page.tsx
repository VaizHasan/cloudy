"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername) {
      setError("Please enter your username.");
      return;
    }

    if (cleanUsername.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    if (cleanUsername.length > 50) {
      setError("Username must be 50 characters or less.");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
      setError(
        "Username can only contain letters, numbers, dots, underscores, and hyphens."
      );
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your email.");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Unable to create your account.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Signup request error:", error);
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#334e68] text-white shadow-lg shadow-[#1e3a5f]/20">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7.5 18.5h9a4.5 4.5 0 0 0 .7-8.94A6 6 0 0 0 5.7 11.2 3.75 3.75 0 0 0 7.5 18.5Z" />
                <path d="M12 14.5V9.5" />
                <path d="m9.8 11.7 2.2-2.2 2.2 2.2" />
              </svg>
            </div>

            <h1 className="mt-5 text-2xl font-bold tracking-tight">
              Create your Cloudy account
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Create a secure workspace for your files.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Username
                </label>

                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Your username"
                  maxLength={50}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 12 characters"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Re-enter your password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6f8da8] focus:ring-4 focus:ring-[#1e3a5f]/10"
                  disabled={loading}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-lg shadow-[#1e3a5f]/20 transition hover:bg-[#16324f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-semibold text-[#1e3a5f] hover:text-[#16324f]"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Cloudy | Store. Share. Secure.
          </p>
        </div>
      </div>
    </main>
  );
}
