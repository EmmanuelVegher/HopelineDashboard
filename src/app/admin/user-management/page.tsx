"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, UserCog, Phone } from "lucide-react";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { cn } from "@/lib/utils";

export default function UserManagementPage() {
  const { users, loading, permissionError } = useAdminData();

  // Debug logging
  console.log('UserManagementPage - users:', users);
  console.log('UserManagementPage - loading:', loading);
  console.log('UserManagementPage - permissionError:', permissionError);

  // Fallback dummy data for testing when Firestore is offline
  const dummyUsers = [
    {
      id: '1',
      email: 'admin@hopeline.com',
      role: 'admin',
      accountStatus: 'active',
      displayName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      image: '',
      gender: 'Male',
      mobile: '08100000000',
      profileCompleted: 100
    },
    {
      id: '2',
      email: 'agent@hopeline.com',
      role: 'support agent',
      accountStatus: 'active',
      displayName: 'Support Agent',
      firstName: 'Support',
      lastName: 'Agent',
      image: '',
      gender: 'Female',
      mobile: '08100000001',
      profileCompleted: 85
    }
  ];

  // Use dummy data if users is empty/undefined and not loading
  const displayUsers = (!loading && (!users || users.length === 0)) ? dummyUsers : (users || []);

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Shield className="h-4 w-4 text-red-600" />;
      case 'support agent':
        return <UserCog className="h-4 w-4 text-blue-600" />;
      default:
        return <UserCog className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'destructive';
      case 'support agent':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string | undefined) => {
    if (!status) return 'outline';
    switch (status.toLowerCase()) {
      case 'active':
        return 'secondary';
      case 'inactive':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>
          View and manage all registered users in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {permissionError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Permission Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to view users. Please check your Firestore security rules to allow read access to the 'users' collection for administrators.
            </AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Profile Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : displayUsers && displayUsers.length > 0 ? (
              displayUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1.5">
                      {getRoleIcon(user.role)}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(user.accountStatus)}>
                      {user.accountStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {user.mobile}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full",
                            user.profileCompleted >= 80 ? "bg-green-500" :
                            user.profileCompleted >= 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${user.profileCompleted}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{user.profileCompleted}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : !permissionError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
