"use client";

import { useAdminData } from "@/contexts/AdminDataProvider";
import TrainingCenter from "@/components/training/training-center";

export default function TrainingCenterPage() {
    const { adminProfile } = useAdminData();

    // Normalize role checked to include both Admin and super-admin
    const userRole = adminProfile?.role?.toLowerCase() || '';
    const isSuperAdmin = userRole === 'super-admin' || userRole === 'super admin';
    const isAdminUser = isSuperAdmin || userRole === 'admin';

    return (
        <TrainingCenter
            canManage={isAdminUser}
            userProfile={adminProfile}
        />
    );
}
