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
  Home,
  Building,
  AlertTriangle,
  MessageSquare,
  Navigation,
  Sun,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { NavLink } from "@/components/nav-link";
import { useLoading } from "@/contexts/LoadingProvider";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { LoadingSpinner } from "@/components/loading-spinner";
import { TranslationProvider, useTranslation } from "@/contexts/TranslationContext";

function DashboardContent({ userProfile }: { userProfile?: {firstName: string; lastName: string; image?: string} | null }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { setIsLoading } = useLoading();

  const navLinks = [
    { to: "/dashboard", label: t('navigation.dashboard'), icon: Home },
    { to: "/dashboard/find-shelter", label: t('navigation.findShelter'), icon: Building },
    { to: "/dashboard/sos", label: t('navigation.sos'), icon: AlertTriangle },
    { to: "/dashboard/assistance", label: t('navigation.assistance'), icon: MessageSquare },
    { to: "/dashboard/navigate", label: t('navigation.navigate'), icon: Navigation },
    { to: "/dashboard/weather", label: t('navigation.weather'), icon: Sun },
    { to: "/dashboard/profile", label: t('navigation.profile'), icon: User },
    { to: "/dashboard/settings", label: t('navigation.settings'), icon: Settings },
  ];

  const handleLogout = () => {
    setIsLoading(true);
    navigate('/login');
  }

  // Auto-close mobile sidebar when navigating to a new page
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <img src="/hopeline_red.png" alt="HopeLine Logo" width={40} height={40} />
            {state === 'expanded' && <h1 className="text-xl font-bold">HopeLine</h1>}
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
         {/* User Profile Section */}
         <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
           <div className="text-center">
             <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
               {userProfile?.image ? (
                 <img
                   src={userProfile.image}
                   alt="Profile"
                   className="w-full h-full object-cover"
                   onError={(e) => {
                     console.log('Profile image failed to load:', userProfile.image);
                     // Hide the broken image and show fallback
                     e.currentTarget.style.display = 'none';
                     e.currentTarget.nextElementSibling?.classList.remove('hidden');
                   }}
                   onLoad={() => {
                     console.log('Profile image loaded successfully:', userProfile.image);
                   }}
                 />
               ) : null}
               <div className={`w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 ${userProfile?.image ? 'hidden' : ''}`}>
                 <User className="w-8 h-8" />
               </div>
             </div>
             <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
               {userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'User' : 'Loading...'}
             </p>
           </div>
         </div>
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
                 <SidebarMenuButton onClick={handleLogout} tooltip={t('common.logout')}>
                    <LogOut />
                    {t('common.logout')}
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}


export default function DashboardLayout() {
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userProfile, setUserProfile] = useState<{firstName: string; lastName: string; image?: string} | null>(null);

  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  // Redirect direct routes to dashboard nested routes
  useEffect(() => {
    const location = window.location.pathname;
    const directRoutes = ['/find-shelter', '/sos', '/assistance', '/navigate', '/weather', '/profile', '/settings'];

    if (directRoutes.includes(location)) {
      const dashboardRoute = `/dashboard${location}`;
      console.log(`Dashboard layout: Redirecting ${location} to ${dashboardRoute}`);
      navigate(dashboardRoute, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Dashboard layout: Auth state changed, user:", user ? user.uid : null);
      if (!user) {
        console.log("Dashboard layout: No user authenticated, redirecting to login");
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
          console.log("Dashboard layout: User role from Firestore:", userData.role);
          // Allow access for users with role "user" or no specific role (regular users)
          if (userData.role === 'user' || userData.role === undefined || userData.role === null) {
            console.log("Dashboard layout: User authorized as regular user");
            setIsAuthorized(true);
          } else if (userData.role === 'Admin') {
            console.log("Dashboard layout: User is admin, redirecting to admin");
            // Admin user, redirect to admin panel
            navigate('/admin');
          } else if (userData.role === 'support agent') {
            console.log("Dashboard layout: User is support agent, redirecting to support agent dashboard");
            // Support agent, redirect to support agent dashboard
            navigate('/support-agent');
          } else {
            console.log("Dashboard layout: User has unrecognized role, allowing access as regular user");
            // Unknown role, allow access as regular user
            setIsAuthorized(true);
          }
        } else {
          console.log("Dashboard layout: No user document found, allowing access as regular user");
          // No user document, allow access as regular user
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        // On error, allow access as regular user
        setIsAuthorized(true);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch user profile data for sidebar
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        console.log('Dashboard layout: No authenticated user for profile fetch');
        return;
      }

      console.log('Dashboard layout: Fetching profile for user:', user.uid);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Dashboard layout: Profile data received:', {
            firstName: userData.firstName,
            lastName: userData.lastName,
            image: userData.image,
            profileImage: userData.profileImage,
            hasImage: !!userData.image,
            imageLength: userData.image?.length || 0
          });

          const profileData = {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            image: userData.image || userData.profileImage || '',
          };

          console.log('Dashboard layout: Setting userProfile:', profileData);
          setUserProfile(profileData);
        } else {
          console.log('Dashboard layout: No user document found for profile');
        }
      } catch (error) {
        console.error('Dashboard layout: Error fetching profile:', error);
      }
    };

    if (isAuthorized) {
      fetchUserProfile();
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
    <TranslationProvider>
      <SidebarProvider>
          <DashboardContent userProfile={userProfile} />
          <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                  <SidebarTrigger className="-ml-1" />
                  <div className="flex items-center gap-2">
                      <img src="/hopeline_red.png" alt="HopeLine Logo" width={32} height={32} />
                      <h1 className="text-lg font-semibold">HopeLine Dashboard</h1>
                  </div>
              </header>
              <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6 bg-gray-50/50 dark:bg-gray-900/50 min-h-screen">
                  <Outlet />
              </main>
          </SidebarInset>
      </SidebarProvider>
    </TranslationProvider>
  );
}
