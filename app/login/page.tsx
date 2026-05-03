import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-12 text-[#1e2528]">
      <section className="w-full max-w-sm rounded-lg border border-[#d8d0c2] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.08em] text-[#5d6f73]">
            PDF Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
