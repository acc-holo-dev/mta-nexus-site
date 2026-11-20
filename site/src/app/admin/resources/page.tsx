import {
  StaffResourcesScreen,
  staffResourcesMetadata,
} from "../../../features/resources/staff-resources-server";

export const dynamic = "force-dynamic";

export const generateMetadata = staffResourcesMetadata;

export default async function Page(props: {
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
    query?: string | string[];
  }>;
}) {
  return StaffResourcesScreen(props);
}
