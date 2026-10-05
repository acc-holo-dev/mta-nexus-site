import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { NewResourceForm } from "../../../../components/new-resource-form";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Submit resource | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function NewResourcePage() {
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor) {
    const dictionary = getDictionary(await getRequestLocale());
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  }
  return <NewResourceForm key={actor.id} actorId={actor.id} />;
}
