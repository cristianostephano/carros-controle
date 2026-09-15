import { prisma } from "@/lib/prisma";
import { getAdminName } from "@/lib/adminName";
import { AdminNamePickerClient } from "./admin-name-picker-client";

export async function AdminNamePicker() {
  const [currentName, adminUsers] = await Promise.all([
    getAdminName(),
    prisma.adminUser.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <AdminNamePickerClient currentName={currentName} names={adminUsers.map((a) => a.name)} />;
}
