import { createRoot } from "react-dom/client";
import { StaffPermissionsScreen } from "../src/features/staff-page-access/StaffPermissionsScreen";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StaffPermissionsScreen />);
