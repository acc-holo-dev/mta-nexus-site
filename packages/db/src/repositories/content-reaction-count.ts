import { sql } from "drizzle-orm";
import { reactions } from "../schema";
// Legacy duplicates contribute only their latest supported reaction, not several votes.
export const currentContentReactionRow = () =>
  sql`${reactions.id} = (select r.id from ${reactions} r where r.target_type = 'content' and r.target_id = ${reactions.targetId} and r.user_id = ${reactions.userId} and r.emoji in ('👍', '❤️', '💡') order by r.created_at desc, r.id desc limit 1)`;
// Public counters derive from current rows, including after an account's cascade deletion.
// Qualify content columns: drizzle otherwise emits "id"/"author_id" which resolve to
// reactions.id inside the nested from, so the count is always zero.
export const contentHelpfulCount = () =>
  sql<number>`(select count(*) from (select distinct on (r.user_id) r.emoji from reactions r where r.target_type = 'content' and r.target_id = content.id and r.user_id <> content.author_id and r.emoji in ('👍', '❤️', '💡') order by r.user_id, r.created_at desc, r.id desc) current_reactions where current_reactions.emoji = '👍')`.mapWith(
    Number,
  );
