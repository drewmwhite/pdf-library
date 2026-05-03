"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Unable to sign in");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium" htmlFor="password">
        App password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        className="h-11 w-full rounded-md border border-[#b9c3c0] px-3 text-base outline-none transition focus:border-[#275e68] focus:ring-2 focus:ring-[#c6e0dc]"
        required
      />
      {error ? <p className="text-sm font-medium text-[#a83232]">{error}</p> : null}
      <button
        className="h-11 w-full rounded-md bg-[#275e68] px-4 font-medium text-white transition hover:bg-[#1e4b52] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
