
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  useSidebar,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Car,
  LayoutDashboard,
  Users,
  Building,
  UserCog,
  LogOut,
  PhoneOutgoing,
  UserCheck,
  Truck,
  MessageSquare,
  BookOpen
} from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AdminDataProvider, useAdminData } from "@/contexts/AdminDataProvider";
import { EmergencySignalModal } from "@/components/situation-room/emergency-signal-modal";
import { UserManagementProvider } from "@/components/user-management-provider";
import { NavLink } from "@/components/nav-link";
import { useLoading } from "@/contexts/LoadingProvider";
import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { LoadingSpinner } from "@/components/loading-spinner";
import { User } from "lucide-react";

const getNavLinks = (t: any) => [
  { to: "/admin", label: t("admin.sidebar.dashboard"), icon: LayoutDashboard },
  { to: "/admin/profile", label: t("admin.sidebar.profile"), icon: UserCheck },
  { to: "/admin/track-drivers", label: t("admin.sidebar.fleetDrivers"), icon: Car },
  { to: "/admin/vehicle-management", label: t("admin.sidebar.fleetVehicles"), icon: Truck },
  { to: "/admin/displaced-persons", label: t("admin.sidebar.beneficiaries"), icon: Users },
  { to: "/admin/track-shelter", label: t("admin.sidebar.shelters"), icon: Building },
  { to: "/admin/user-management", label: t("admin.sidebar.userManagement"), icon: UserCog },
  { to: "/admin/contact-management", label: t("admin.sidebar.contactDirectory"), icon: PhoneOutgoing },
  { to: "/admin/chats", label: t("admin.sidebar.chats"), icon: MessageSquare },
  { to: "/admin/training", label: t("admin.sidebar.training"), icon: BookOpen },
];

function AdminSidebar({ adminProfile }: { adminProfile?: { firstName: string; lastName: string; image?: string } | null }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { setIsLoading } = useLoading();

  const navLinks = useMemo(() => getNavLinks(t), [t]);

  // Auto-close mobile sidebar when navigating to a new page
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);


  const handleLogout = () => {
    setIsLoading(true);
    navigate('/login');
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <img src="/shelter_logo.png" alt="Caritas Nigeria Logo" width={40} height={40} />
          {state === 'expanded' && <h1 className="text-xl font-bold">{t("admin.sidebar.tacticalCommandCenter")}</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <SidebarMenuItem key={label}>
                <NavLink to={to}>
                  <SidebarMenuButton isActive={isActive} tooltip={label}>
                    <Icon />
                    {label}
                  </SidebarMenuButton>
                </NavLink>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarContent className="p-2 mt-auto" >
        {/* Admin Profile Section */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-gray-200">
              {adminProfile?.image ? (
                <img
                  src={adminProfile.image}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User className="w-8 h-8" />
                </div>
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">
              {adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}`.trim() || 'Admin User' : 'Loading...'}
            </p>
          </div>
        </div>
        {state === 'expanded' && (
          <div className="text-center px-2 py-4 space-y-4">
            <p className="text-xs text-sidebar-foreground/70">{t("admin.sidebar.supportedBy")}</p>
            <div className="flex justify-center items-center gap-4">
              <img src="/caritas-logo.png" alt="Caritas Nigeria Logo" width={100} height={40} />
              <img src="/citi-logo.png" alt="CITI Foundation Logo" width={100} height={40} className="mx-auto" />
            </div>
          </div>
        )}
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip={t("admin.sidebar.logout")}>
              <LogOut />
              {t("admin.sidebar.logout")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
function AdminModalWrapper() {
  const { activeAlerts, clearAlert } = useAdminData();
  const activeAlert = activeAlerts && activeAlerts.length > 0 ? activeAlerts[0] : null;

  return (
    <EmergencySignalModal
      alert={activeAlert}
      onClose={() => activeAlert && clearAlert(activeAlert.id)}
    />
  );
}


export default function AdminLayout() {
  const { t } = useTranslation();
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminProfile, setAdminProfile] = useState<{ firstName: string; lastName: string; image?: string; role: string; state?: string } | null>(null);

  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Admin layout: Auth state changed, user:", user ? user.uid : null);
      if (!user) {
        console.log("Admin layout: No user authenticated, redirecting to login");
        // Not authenticated, redirect to login
        navigate('/login');
        setAuthLoading(false);
        return;
      }

      try {
        // Get user document
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role?.toLowerCase();
          console.log("Admin layout: User role from Firestore:", role);

          if (role === 'admin' || role === 'super-admin' || role === 'super admin' || role === 'superadmin') {
            console.log("Admin layout: User authorized as", role);
            // Authorized admin
            setIsAuthorized(true);
          } else {
            console.log("Admin layout: User not admin, redirecting to dashboard");
            // Authenticated but not admin, redirect to dashboard
            navigate('/dashboard');
          }
        } else {
          console.log("Admin layout: No user document found, redirecting to dashboard");
          // No user document, treat as regular user
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        // On error, redirect to login
        navigate('/login');
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch admin profile data for sidebar
  useEffect(() => {
    const fetchAdminProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        console.log('Admin layout: No authenticated user for profile fetch');
        return;
      }

      console.log('Admin layout: Fetching profile for user:', user.uid);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Admin layout: Profile data received:', {
            firstName: userData.firstName,
            lastName: userData.lastName,
            image: userData.image,
            profileImage: userData.profileImage
          });

          const profileData = {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            image: userData.image || userData.profileImage || '',
            role: userData.role || 'Admin',
            state: userData.state || ''
          };

          console.log('Admin layout: Setting adminProfile:', profileData);
          setAdminProfile(profileData);
        } else {
          console.log('Admin layout: No user document found for profile');
        }
      } catch (error) {
        console.error('Admin layout: Error fetching profile:', error);
      }
    };

    if (isAuthorized) {
      fetchAdminProfile();
    }
  }, [isAuthorized]);

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Only render if authorized
  if (!isAuthorized) {
    return null; // This shouldn't be reached due to redirects, but safety check
  }

  return (
    <UserManagementProvider>
      <AdminDataProvider profile={adminProfile}>
        <SidebarProvider>
          <AdminSidebar adminProfile={adminProfile} />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="flex items-center gap-2">
                <img src="/shelter_logo.png" alt="Hopeline Admin Logo" width={32} height={32} />
                <h1 className="text-lg font-semibold">{t("admin.sidebar.dashboard")}</h1>
              </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6 bg-gray-50/50 dark:bg-gray-900/50 min-h-screen">
              <Outlet />
            </main>
          </SidebarInset>
          <AdminModalWrapper />
        </SidebarProvider>
      </AdminDataProvider>
    </UserManagementProvider>
  );
}
