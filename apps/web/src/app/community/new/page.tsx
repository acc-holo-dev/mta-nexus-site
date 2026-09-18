import { CommunityTopicForm } from "../../../components/community-topic-form";

export default function NewCommunityTopicPage() {
  return <div className="mx-auto max-w-3xl space-y-6 py-8"><div><h1 className="text-2xl font-black text-white">Start a community topic</h1><p className="mt-1 text-sm text-neutral-400">Ask a clear question or share something useful with MTA players and creators.</p></div><CommunityTopicForm /></div>;
}
