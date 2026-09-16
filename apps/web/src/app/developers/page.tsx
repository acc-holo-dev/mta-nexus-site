import { authService } from "../../lib/services/auth-service";
import Link from "next/link";
import { Code2, Award, ShieldCheck, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const allUsers = await authService.listUsers();
  const developers = allUsers.filter((u) => u.role === "developer" || u.role === "admin");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-base pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <Code2 className="w-7 h-7 text-purple-500" />
          <span>MTA Developer & Studio Network</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Connect with veteran MTA:SA scripters, 3D modelers, UI designers, and systems architects.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {developers.map((dev) => (
          <Link
            key={dev.id}
            href={`/developers/${dev.username}`}
            className="group flex flex-col p-6 rounded-xl border border-base bg-surface hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700">
                <img
                  src={dev.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${dev.username}`}
                  alt={dev.displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                    {dev.displayName}
                  </h3>
                  {dev.isVerified && (
                    <span title="Verified Developer">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">@{dev.username}</div>
              </div>
            </div>

            <p className="text-xs text-neutral-400 line-clamp-2 mb-4 flex-1">
              {dev.bio || "MTA Community contributor and resource author."}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-base text-xs">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Seller
              </span>
              <span className="text-purple-400 font-semibold group-hover:underline">
                View Portfolio в†’
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
