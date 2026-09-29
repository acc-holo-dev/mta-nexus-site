"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, ArrowRight } from "lucide-react";
import { getPostAuthDestination } from "../../../lib/auth-redirect";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, displayName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      router.push(getPostAuthDestination(window.location.search));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-xl mx-auto shadow-lg shadow-blue-500/20">
          NX
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Create your Nexus account</h1>
        <p className="text-xs text-neutral-400">
          Join thousands of MTA developers, server owners, and players
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

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
              placeholder="developer@example.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Username
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-neutral-900 border border-base text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              placeholder="mta_scripter"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-neutral-900 border border-base text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Password (min 8 chars)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-neutral-900 border border-base text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>Creating account...</span>
          ) : (
            <>
              <span>Register</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-neutral-400">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-blue-400 hover:underline font-semibold">
          Sign In
        </Link>
      </div>
    </div>
  );
}
