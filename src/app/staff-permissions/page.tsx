import { StaffPermissionsScreen } from "@/features/staff-page-access/StaffPermissionsScreen";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

export default async function StaffPermissionsPage() {
  await requireApprenticeWorkspaceAccess("/staff-permissions");
  return <StaffPermissionsScreen />;
}
