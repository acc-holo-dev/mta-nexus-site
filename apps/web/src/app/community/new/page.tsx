import Link from "next/link";
import { cookies } from "next/headers";
import { authService } from "../../../lib/services/auth-service";
import { CommunityTopicForm } from "../../../components/community-topic-form";

export const dynamic = "force-dynamic";

export default async function NewCommunityTopicPage() {
  const cookieStore = await cookies();
  const user = await authService.getSession(cookieStore.get("nexus_session")?.value);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-black text-white">Start a community topic</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Ask a clear question or share something useful with MTA players and creators.
        </p>
      </div>
      {user ? (
        <CommunityTopicForm />
      ) : (
        <div className="nexus-panel space-y-4 p-6">
          <p className="text-sm text-neutral-300">
            Sign in to publish a question or discussion. Community topics are open to read without an account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/login?next=%2Fcommunity%2Fnew" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
              Sign in
            </Link>
            <Link href="/auth/register?next=%2Fcommunity%2Fnew" className="rounded-lg border border-base px-4 py-2 text-sm font-semibold text-primary hover:bg-hover">
              Create account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
