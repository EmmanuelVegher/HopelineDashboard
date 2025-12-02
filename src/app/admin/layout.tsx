
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
} from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AdminHeader } from "@/components/admin-header";
import { AdminDataProvider } from "@/contexts/AdminDataProvider";
import { UserManagementProvider } from "@/components/user-management-provider";
import { NavLink } from "@/components/nav-link";
import { useLoading } from "@/contexts/LoadingProvider";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { LoadingSpinner } from "@/components/loading-spinner";

const navLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/profile", label: "Profile", icon: UserCheck },
  { to: "/admin/track-drivers", label: "Drivers", icon: Car },
  { to: "/admin/vehicle-management", label: "Vehicles", icon: Truck },
  { to: "/admin/displaced-persons", label: "Displaced Persons", icon: Users },
  { to: "/admin/track-shelter", label: "Shelters", icon: Building },
  { to: "/admin/user-management", label: "Users", icon: UserCog },
  { to: "/admin/contact-management", label: "Contact Numbers", icon: PhoneOutgoing },
];

function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { setIsLoading } = useLoading();


  const handleLogout = () => {
    setIsLoading(true);
    navigate('/login');
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <img src="/caritas-logo.png" alt="Caritas Nigeria Logo" width={40} height={40} />
            {state === 'expanded' && <h1 className="text-xl font-bold">Hopeline Admin</h1>}
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
         {state === 'expanded' && (
            <div className="text-center px-2 py-4 space-y-4">
                <p className="text-xs text-sidebar-foreground/70">Supported By</p>
                <div className="flex justify-center items-center gap-4">
                    <img src="/caritas-logo.png" alt="Caritas Nigeria Logo" width={100} height={40} />
                    <img src="/citi-logo.png" alt="CITI Foundation Logo" width={100} height={40} className="mx-auto" />
                </div>
            </div>
         )}
         <SidebarSeparator />
         <SidebarMenu>
            <SidebarMenuItem>
                 <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                    <LogOut />
                    Logout
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}


export default function AdminLayout() {
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

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
          console.log("Admin layout: User role from Firestore:", userData.role);
          if (userData.role === 'Admin') {
            console.log("Admin layout: User authorized as admin");
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
      <AdminDataProvider>
          <SidebarProvider>
              <AdminSidebar />
              <SidebarInset>
                  <AdminHeader />
                  <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6">
                      <Outlet />
                  </main>
              </SidebarInset>
          </SidebarProvider>
      </AdminDataProvider>
    </UserManagementProvider>
  );
}
