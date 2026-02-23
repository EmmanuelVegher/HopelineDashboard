"use client";

import { useAdminData } from "@/contexts/AdminDataProvider";
import TrainingCenter from "@/components/training/training-center";

export default function SupportAgentTrainingPage() {
    const { adminProfile } = useAdminData();

    return (
        <TrainingCenter
            canManage={false}
            userProfile={adminProfile}
        />
    );
}
