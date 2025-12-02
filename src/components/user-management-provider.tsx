
"use client";

import { createContext, useContext, useState, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserManagementContextType {
  approveUser: (requestId: string, email: string, role: string) => Promise<boolean>;
  denyUser: (requestId: string, email: string) => Promise<boolean>;
  actionLoading: boolean;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);

export function UserManagementProvider({ children }: { children: ReactNode }) {
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const approveUser = async (requestId: string, email: string, role: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve user.');
      }

      toast({
        title: "User Approved",
        description: `${email} is queued for account creation. This may take a minute.`,
      });
      return true;
    } catch (error: any) {
      console.error("Error approving user:", error);
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive"
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const denyUser = async (requestId: string, email: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "pendingUsers", requestId));
      toast({
        title: "Request Denied",
        description: `The request for ${email} has been successfully denied and removed.`,
      });
       return true;
    } catch (error) {
        console.error("Error denying request: ", error);
        toast({
            title: "Error",
            description: "Could not deny the request. Check Firestore permissions and rules.",
            variant: "destructive"
        });
        return false;
    } finally {
        setActionLoading(false);
    }
  };

  return (
    <UserManagementContext.Provider value={{ approveUser, denyUser, actionLoading }}>
      {children}
    </UserManagementContext.Provider>
  );
}

export function useUserManagement() {
  const context = useContext(UserManagementContext);
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  return context;
}
