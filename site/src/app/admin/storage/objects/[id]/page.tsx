import {
  StaffStorageObjectScreen,
  staffStorageObjectMetadata,
} from "../../../../../features/moderation/staff-storage-object-server";

export const dynamic = "force-dynamic";

export const generateMetadata = staffStorageObjectMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return StaffStorageObjectScreen(props);
}
