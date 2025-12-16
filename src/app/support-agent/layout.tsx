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
  MessageSquare,
  Phone,
  History,
  User,
  Settings,
  Map,
  Bell,
  LogOut,
  Headphones,
} from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { NavLink } from "@/components/nav-link";
import { useLoading } from "@/contexts/LoadingProvider";
import { useTranslationContext } from "@/contexts/TranslationProvider";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useTranslation } from "react-i18next";

const navLinks = [
  { to: "/support-agent", key: "dashboard", icon: MessageSquare },
  { to: "/support-agent/chats", key: "activeChats", icon: MessageSquare },
  { to: "/support-agent/calls", key: "voiceCalls", icon: Phone },
  { to: "/support-agent/history", key: "chatHistory", icon: History },
  { to: "/support-agent/map", key: "locationAssist", icon: Map },
  { to: "/support-agent/profile", key: "profile", icon: User },
  { to: "/support-agent/settings", key: "settings", icon: Settings },
  { to: "/support-agent/notifications", key: "notifications", icon: Bell },
];

function SupportAgentSidebar({ userProfile }: { userProfile?: {firstName: string; lastName: string; image?: string; isOnline?: boolean} | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { setIsLoading } = useLoading();
  const { t } = useTranslation();

  const handleLogout = () => {
    setIsLoading(true);
    navigate('/login');
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <img src="/hopeline_red.png" alt="HopeLine Logo" width={40} height={40} />
            {state === 'expanded' && <h1 className="text-xl font-bold">{t('supportAgent.sidebar.supportAgent')}</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navLinks.map(({ to, key, icon: Icon }) => {
            const label = t(`supportAgent.sidebar.${key}`);
            const isActive = location.pathname === to;
            return (
              <SidebarMenuItem key={key}>
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
         <div className="mb-4 p-3 bg-muted/50 rounded-lg">
           <div className="text-center">
             <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-muted relative">
               {userProfile?.image ? (
                 <img
                   src={userProfile.image}
                   alt="Profile"
                   className="w-full h-full object-cover"
                   onError={(e) => {
                     console.log('Support agent profile image failed to load:', userProfile.image);
                     e.currentTarget.style.display = 'none';
                     e.currentTarget.nextElementSibling?.classList.remove('hidden');
                   }}
                   onLoad={() => {
                     console.log('Support agent profile image loaded successfully:', userProfile.image);
                   }}
                 />
               ) : null}
               <div className={`w-full h-full flex items-center justify-center text-muted-foreground ${userProfile?.image ? 'hidden' : ''}`}>
                 <Headphones className="w-8 h-8" />
               </div>
               {/* Online status indicator */}
               {userProfile?.isOnline && (
                 <div className="absolute bottom-0 right-0 w-4 h-4 bg-brand-green border-2 border-primary-foreground rounded-full"></div>
               )}
             </div>
             <p className="text-sm font-medium text-foreground">
               {userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || t('supportAgent.sidebar.supportAgent') : t('supportAgent.sidebar.loading')}
             </p>
             {userProfile?.isOnline && (
               <p className="text-xs text-brand-green-text font-medium">{t('supportAgent.sidebar.online')}</p>
             )}
           </div>
         </div>
         {state === 'expanded' && (
            <div className="text-center px-2 py-4 space-y-4">
                <p className="text-xs text-sidebar-foreground/70">{t('supportAgent.sidebar.supportedBy')}</p>
                <div className="flex justify-center items-center gap-4">
                    <img src="/caritas-logo.png" alt="Caritas Nigeria Logo" width={100} height={40} />
                    <img src="/citi-logo.png" alt="CITI Foundation Logo" width={100} height={40} className="mx-auto" />
                </div>
            </div>
         )}
         <SidebarSeparator />
         <SidebarMenu>
            <SidebarMenuItem>
                 <SidebarMenuButton onClick={handleLogout} tooltip={t('supportAgent.sidebar.logout')}>
                   <LogOut />
                   {t('supportAgent.sidebar.logout')}
                 </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
       </SidebarContent>
    </Sidebar>
  );
}


export default function SupportAgentLayout() {
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userProfile, setUserProfile] = useState<{firstName: string; lastName: string; image?: string; isOnline?: boolean} | null>(null);
  const { renderCount } = useTranslationContext();

  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Support agent layout: Auth state changed, user:", user ? user.uid : null);
      if (!user) {
        console.log("Support agent layout: No user authenticated, redirecting to login");
        navigate('/login');
        setAuthLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("Support agent layout: User role from Firestore:", userData.role);

          if (userData.role === 'support agent') {
            console.log("Support agent layout: User authorized as support agent");
            setIsAuthorized(true);
          } else {
            console.log("Support agent layout: User is not a support agent, redirecting to dashboard");
            navigate('/dashboard');
          }
        } else {
          console.log("Support agent layout: No user document found, redirecting to dashboard");
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        navigate('/dashboard');
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
        console.log('Support agent layout: No authenticated user for profile fetch');
        return;
      }

      console.log('Support agent layout: Fetching profile for user:', user.uid);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Support agent layout: Profile data received:', {
            firstName: userData.firstName,
            lastName: userData.lastName,
            image: userData.image,
            isOnline: userData.isOnline
          });

          const profileData = {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            image: userData.image || '',
            isOnline: userData.isOnline || false,
          };

          console.log('Support agent layout: Setting userProfile:', profileData);
          setUserProfile(profileData);
        } else {
          console.log('Support agent layout: No user document found for profile');
        }
      } catch (error) {
        console.error('Support agent layout: Error fetching profile:', error);
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
    return null;
  }

  return (
    <SidebarProvider key={renderCount}>
        <SupportAgentSidebar userProfile={userProfile} />
        <SidebarInset>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6 bg-background/50 min-h-screen">
                <Outlet />
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}