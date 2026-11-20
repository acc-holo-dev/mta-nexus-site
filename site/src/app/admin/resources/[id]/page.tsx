import {
  StaffResourceDetailScreen,
  staffResourceDetailMetadata,
} from "../../../../features/resources/staff-resource-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = staffResourceDetailMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return StaffResourceDetailScreen(props);
}
