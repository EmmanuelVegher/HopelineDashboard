"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, UserCog, Phone, Users, UserCheck, ShieldCheck, Heart, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { cn } from "@/lib/utils";
import { UserRoleDistributionChart, RegistrationTrendChart, UserStatusAnalytics } from "./analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Edit, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AdminUser } from "@/lib/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ShieldAlert, MapPin, UserX, CheckCircle2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { NIGERIA_STATES } from "@/lib/nigeria-geography";
import { useTranslation } from "react-i18next";

type UserActionsProps = {
  userId: string;
  currentRole: string;
  currentState: string;
  currentStatus: string;
  onUpdate: () => void;
};

const UserActionsMenu = ({ userId, currentRole, currentState, currentStatus, onUpdate }: UserActionsProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleUpdate = async (field: string, value: string) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { [field]: value });
      toast({ title: t("admin.userManagement.toasts.success") || "Success", description: t("admin.userManagement.toasts.updated") || "User updated successfully." });
      onUpdate();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: t("admin.userManagement.toasts.error") || "Error", description: t("admin.userManagement.toasts.updateFailed") || "Failed to update user.", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">{t("admin.userManagement.actions.openMenu") || "Open menu"}</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("admin.userManagement.actions.label") || "Actions"}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Modify Permissions */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ShieldAlert className="mr-2 h-4 w-4" />
            <span>{t("admin.userManagement.actions.modifyPermissions") || "Modify Permissions"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleUpdate('role', 'displaced_person')}>
                {currentRole === 'displaced_person' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                Beneficiary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('role', 'user')}>
                {currentRole === 'user' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                User (Standard)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('role', 'driver')}>
                {currentRole === 'driver' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                Driver
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('role', 'support agent')}>
                {currentRole === 'support agent' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                Support Agent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('role', 'Admin')}>
                {currentRole === 'Admin' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('role', 'super-admin')}>
                {currentRole === 'super-admin' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                Super Admin
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Transfer Regions */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MapPin className="mr-2 h-4 w-4" />
            <span>{t("admin.userManagement.actions.transferRegion") || "Transfer Region"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto">
              <DropdownMenuItem onClick={() => handleUpdate('state', '')}>
                {!currentState && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                No State (Unassigned)
              </DropdownMenuItem>
              {NIGERIA_STATES.map((state) => (
                <DropdownMenuItem key={state} onClick={() => handleUpdate('state', state)}>
                  {currentState === state && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                  {state}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Suspend Account */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-red-600 hover:text-red-700">
            <UserX className="mr-2 h-4 w-4" />
            <span>{t("admin.userManagement.actions.suspendAccount") || "Suspend Account"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleUpdate('accountStatus', 'active')}>
                {currentStatus === 'active' && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                Activate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('accountStatus', 'suspended')} className="text-orange-600">
                {currentStatus === 'suspended' && <CheckCircle2 className="mr-2 h-4 w-4" />}
                Suspend
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdate('accountStatus', 'terminated')} className="text-red-600">
                {currentStatus === 'terminated' && <CheckCircle2 className="mr-2 h-4 w-4" />}
                Terminate
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

      </DropdownMenuContent>
    </DropdownMenu>
  );
};


function EditUserDialog({ user, isOpen, onClose, onSave }: { user: AdminUser | null, isOpen: boolean, onClose: () => void, onSave: () => void }) {
  const [firstName, setFirstName] = React.useState(user?.firstName || '');
  const [lastName, setLastName] = React.useState(user?.lastName || '');
  const [mobile, setMobile] = React.useState(user?.mobile || '');
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  React.useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setMobile(user.mobile || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        firstName,
        lastName,
        mobile
      });
      toast({ title: t("admin.userManagement.toasts.success") || "Success", description: t("admin.userManagement.toasts.profileUpdated") || "User profile updated." });
      onSave();
      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: t("admin.userManagement.toasts.error") || "Error", description: t("admin.userManagement.toasts.profileUpdateFailed") || "Failed to update profile.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("admin.userManagement.editDialog.title") || "Edit User Profile"}</DialogTitle>
          <DialogDescription>
            {t("admin.userManagement.editDialog.description") || "Make changes to the user's profile information here. Click save when you're done."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right"> {t("admin.userManagement.editDialog.firstName") || "First Name"} </Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right"> {t("admin.userManagement.editDialog.lastName") || "Last Name"} </Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right"> {t("admin.userManagement.editDialog.email") || "Email"} </Label>
              <Input id="email" value={user?.email || ''} disabled className="col-span-3 bg-muted" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mobile" className="text-right"> {t("admin.userManagement.editDialog.phone") || "Phone"} </Label>
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("admin.userManagement.editDialog.cancel") || "Cancel"}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.userManagement.editDialog.save") || "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UserManagementPage() {
  const { users, persons, drivers, loading, permissionError, fetchData } = useAdminData();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const u = users || [];
    const p = persons || [];
    const d = drivers || [];

    return {
      totalUsers: u.length,
      superAdmins: u.filter(user => user.role?.toLowerCase() === 'super-admin' || user.role?.toLowerCase() === 'super admin').length,
      admins: u.filter(user => user.role?.toLowerCase() === 'admin').length,
      supportAgents: u.filter(user => user.role?.toLowerCase() === 'support agent').length,
      regularUsers: u.filter(user => user.role?.toLowerCase() === 'user').length,
      displacedRole: u.filter(user => user.role?.toLowerCase() === 'displaced_person').length,
      displacedCollection: p.length,
      drivers: d.length
    }
  }, [users, persons, drivers]);

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
      profileCompleted: 100,
      state: ''
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
      profileCompleted: 85,
      state: ''
    }
  ];

  // Use dummy data if users is empty/undefined and not loading
  const displayUsers = (!loading && (!users || users.length === 0)) ? dummyUsers : (users || []);

  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return displayUsers;

    const lowerQuery = searchQuery.toLowerCase();
    return displayUsers.filter(user =>
      (user.firstName + " " + user.lastName).toLowerCase().includes(lowerQuery) ||
      user.email?.toLowerCase().includes(lowerQuery) ||
      user.mobile?.toString().includes(lowerQuery) ||
      user.role?.toLowerCase().includes(lowerQuery)
    );
  }, [displayUsers, searchQuery]);

  // Pagination logic
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

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
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("admin.userManagement.stats.totalUsers") || "Total Users"}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-red-700">{t("admin.userManagement.stats.superAdmins") || "Super Admins"}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{loading ? <Skeleton className="h-8 w-12" /> : stats.superAdmins}</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-blue-700">{t("admin.userManagement.stats.admins") || "Admins"}</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{loading ? <Skeleton className="h-8 w-12" /> : stats.admins}</div>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-indigo-700">{t("admin.userManagement.stats.agents") || "Agents"}</CardTitle>
            <UserCog className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-800">{loading ? <Skeleton className="h-8 w-12" /> : stats.supportAgents}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-green-700">{t("admin.userManagement.stats.beneficiaries") || "Beneficiaries"}</CardTitle>
            <Heart className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{loading ? <Skeleton className="h-8 w-12" /> : stats.displacedCollection}</div>
            <p className="text-[10px] text-green-600 mt-1">{stats.displacedRole} with accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700">{t("admin.userManagement.stats.regularUsers") || "Regular Users"}</CardTitle>
            <UserCheck className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-800">{loading ? <Skeleton className="h-8 w-12" /> : stats.regularUsers}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UserRoleDistributionChart users={users || []} drivers={drivers || []} />
        <RegistrationTrendChart users={users || []} />
        <UserStatusAnalytics users={users || []} />
      </div>

      <Card className="max-w-full overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {t("admin.userManagement.title") || "User Management"}
            </CardTitle>
            <CardDescription>
              {t("admin.userManagement.subtitle") || "View and manage all registered users in the system."}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("admin.userManagement.searchPlaceholder") || "Search by name, email, or phone..."}
              className="pl-9 w-full"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          {permissionError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("admin.userManagement.permissionError.title") || "Permission Denied"}</AlertTitle>
              <AlertDescription>
                {t("admin.userManagement.permissionError.description") || "You do not have permission to view users. Please check your Firestore security rules to allow read access to the 'users' collection for administrators."}
              </AlertDescription>
            </Alert>
          )}

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-8 w-24" />
                  </Card>
                ))
              ) : paginatedUsers && paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <Card key={user.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-base">{user.firstName} {user.lastName}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1.5">
                            {getRoleIcon(user.role)}
                            {user.role === 'displaced_person' ? (t("admin.userManagement.stats.beneficiaries") || 'Beneficiary') : user.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">{t("admin.userManagement.table.heads.status") || "Status"}</p>
                          <Badge variant={getStatusBadgeVariant(user.accountStatus)} className="mt-1">
                            {user.accountStatus}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("admin.userManagement.table.heads.phone") || "Phone"}</p>
                          <p className="font-medium flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {user.mobile}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{t("admin.userManagement.table.heads.profileCompletion") || "Profile Completion"}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={cn(
                                "h-2 rounded-full",
                                user.profileCompleted >= 80 ? "bg-green-500" :
                                  user.profileCompleted >= 50 ? "bg-yellow-500" : "bg-red-500"
                              )}
                              style={{ width: `${user.profileCompleted}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{user.profileCompleted}%</span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t mt-2 gap-2">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingUser(user)}>
                          <Edit className="mr-2 h-3 w-3" /> {t("admin.userManagement.buttons.edit") || "Edit"}
                        </Button>
                        <UserActionsMenu
                          userId={user.id}
                          currentRole={user.role || 'user'}
                          currentState={user.state || ''}
                          currentStatus={user.accountStatus || 'active'}
                          onUpdate={() => fetchData()}
                        />
                      </div>
                    </div>
                  </Card>
                ))
              ) : !permissionError ? (
                <p className="text-center text-muted-foreground py-8">No users found.</p>
              ) : null}
            </div>
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">{t("admin.userManagement.table.heads.name") || "Name"}</TableHead>
                    <TableHead className="min-w-[150px]">{t("admin.userManagement.table.heads.email") || "Email"}</TableHead>
                    <TableHead className="min-w-[100px]">{t("admin.userManagement.table.heads.role") || "Role"}</TableHead>
                    <TableHead className="min-w-[80px]">{t("admin.userManagement.table.heads.status") || "Status"}</TableHead>
                    <TableHead className="min-w-[120px]">{t("admin.userManagement.table.heads.phone") || "Phone"}</TableHead>
                    <TableHead className="min-w-[150px]">{t("admin.userManagement.table.heads.profileCompletion") || "Profile Completion"}</TableHead>
                    <TableHead className="min-w-[50px]">{t("admin.userManagement.table.heads.actions") || "Actions"}</TableHead>
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
                  ) : paginatedUsers && paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1.5">
                            {getRoleIcon(user.role)}
                            {user.role === 'displaced_person' ? (t("admin.userManagement.stats.beneficiaries") || 'Beneficiary') : user.role}
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
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingUser(user)}>
                              <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <UserActionsMenu
                              userId={user.id}
                              currentRole={user.role || 'user'}
                              currentState={user.state || ''}
                              currentStatus={user.accountStatus || 'active'}
                              onUpdate={() => fetchData()}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !permissionError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        {t("admin.userManagement.table.noUsers") || "No users found."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing <span className="font-medium text-foreground">{startIndex + 1}</span> to{" "}
                <span className="font-medium text-foreground">
                  {Math.min(startIndex + itemsPerPage, totalItems)}
                </span>{" "}
                of <span className="font-medium text-foreground">{totalItems}</span> users
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hidden sm:flex"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center px-2 min-w-[3rem] justify-center text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hidden sm:flex"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSave={fetchData}
      />
    </div>
  );
}
