import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { contentService } from "../../lib/services/content-service";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const topics = await contentService.listCommunityTopics(50);
  return <div className="space-y-6"><header className="flex items-center justify-between gap-4 border-b border-base pb-5"><div><h1 className="flex items-center gap-2 text-2xl font-black text-white"><MessageSquare className="h-6 w-6 text-blue-400" />Community</h1><p className="mt-1 text-xs text-neutral-400">Questions and discussions from the MTA ecosystem.</p></div><Link href="/community/new" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" />New topic</Link></header><section className="space-y-2">{topics.map((topic) => <Link key={topic.id} href={`/articles/${topic.slug}`} className="nexus-panel block p-4 hover:border-blue-500/60"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase text-blue-400">{topic.type}</span><h2 className="mt-1 font-bold text-white">{topic.title}</h2><p className="mt-1 line-clamp-2 text-xs text-neutral-400">{topic.excerpt || topic.body}</p></div><span className="shrink-0 text-xs text-neutral-500">{topic.commentCount} replies</span></div></Link>)}{topics.length === 0 && <div className="nexus-panel p-8 text-center text-sm text-neutral-400">No topics yet. Start the first useful discussion.</div>}</section></div>;
}
