"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@mta-nexus.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/workspace");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-xl mx-auto shadow-lg shadow-blue-500/20">
          NX
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Sign in to MTA Nexus</h1>
        <p className="text-xs text-neutral-400">
          Access your resources, licenses, servers, and developer profile
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Quick Demo Credentials Switcher */}
      <div className="p-4 rounded-xl border border-base bg-surface space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
          <UserCheck className="w-4 h-4 text-blue-400" />
          <span>Quick Demo Logins</span>
        </div>
        <p className="text-[11px] text-neutral-400">
          Click any persona below to auto-fill credentials:
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setDemoAccount("admin@mta-nexus.com")}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-base text-left text-neutral-200"
          >
            <div className="font-bold text-red-400">Master Admin</div>
            <div className="text-[10px] text-neutral-500 truncate">admin@mta-nexus.com</div>
          </button>
          <button
            type="button"
            onClick={() => setDemoAccount("horizon@mta-nexus.com")}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-base text-left text-neutral-200"
          >
            <div className="font-bold text-purple-400">Developer</div>
            <div className="text-[10px] text-neutral-500 truncate">horizon@mta-nexus.com</div>
          </button>
          <button
            type="button"
            onClick={() => setDemoAccount("owner@sadrift.com")}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-base text-left text-neutral-200"
          >
            <div className="font-bold text-emerald-400">Server Owner</div>
            <div className="text-[10px] text-neutral-500 truncate">owner@sadrift.com</div>
          </button>
          <button
            type="button"
            onClick={() => setDemoAccount("player@example.com")}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-base text-left text-neutral-200"
          >
            <div className="font-bold text-blue-400">Player</div>
            <div className="text-[10px] text-neutral-500 truncate">player@example.com</div>
          </button>
        </div>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-base bg-surface space-y-4 shadow-xl">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-neutral-900 border border-base text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-neutral-900 border border-base text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              placeholder="вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-neutral-400">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="text-blue-400 hover:underline font-semibold">
          Create an account
        </Link>
      </div>
    </div>
  );
}
