import {
  StaffStorageScreen,
  staffStorageMetadata,
} from "../../../features/moderation/staff-storage-server";

export const dynamic = "force-dynamic";

export const generateMetadata = staffStorageMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return StaffStorageScreen(props);
}
