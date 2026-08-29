"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid email or password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
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
              Welcome to Cloudy
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Sign in to access your secure workspace.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
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
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="font-semibold text-[#1e3a5f] transition hover:text-[#16324f]"
                >
                  Create account
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