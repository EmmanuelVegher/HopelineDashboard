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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  User,
  Settings,
  History,
  Car,
  LogOut,
  MessageSquare,
  GraduationCap
} from "lucide-react";
import { useLocation, useNavigate, Outlet, Link } from "react-router-dom";
import { useLoading } from '@/contexts/LoadingProvider';
import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { SosAlert } from '@/ai/schemas/sos';

const driverRoles = ['driver', 'pilot', 'responder', 'rider', 'Driver', 'Pilot', 'Responder', 'Rider'];

const getNavLinks = (t: any) => [
  { to: "/driver/map", label: t("driver.sidebar.tasks"), key: "tasks", icon: Car },
  { to: "/driver/chats", label: t("driver.sidebar.chats"), key: "chats", icon: MessageSquare },
  { to: "/driver/profile", label: t("driver.sidebar.profile"), key: "profile", icon: User },
  { to: "/driver/settings", label: t("driver.sidebar.settings"), key: "settings", icon: Settings },
  { to: "/driver/history", label: t("driver.sidebar.history"), key: "history", icon: History },
  { to: "/driver/training", label: t("driver.sidebar.training"), key: "training", icon: GraduationCap },
];

function DriverSidebar({ activeAlertsCount = 0, driverProfile }: { activeAlertsCount?: number; driverProfile?: { firstName: string; lastName: string; image?: string } | null }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { setIsLoading } = useLoading();
  const { toast } = useToast();

  const navLinks = useMemo(() => getNavLinks(t), [t]);

  // Auto-close mobile sidebar when navigating to a new page
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  console.log("DriverSidebar: Current location pathname:", location.pathname);

  const handleLogout = async () => {
    console.log("DriverSidebar: Logout clicked");
    try {
      setIsLoading(true);
      await signOut(auth);
      navigate('/login');
      toast({
        title: t("driver.sidebar.loggedOut"),
        description: t("driver.sidebar.loggedOutDesc"),
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <img src="/shelter_logo.png" alt="Hopeline Logo" width={40} height={40} />
          {state === 'expanded' && <h1 className="text-xl font-bold">{t("driver.sidebar.panel")}</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navLinks.map(({ to, label, key, icon: Icon }) => {
            const isActive = location.pathname === to;
            console.log(`DriverSidebar: Checking ${label} - path: ${to}, current: ${location.pathname}, isActive: ${isActive}`);
            return (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton isActive={isActive} tooltip={label} asChild>
                  <Link to={to} className="flex items-center gap-2">
                    <Icon />
                    <span>{label}</span>
                    {key === 'tasks' && activeAlertsCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                        {activeAlertsCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarContent className="p-2 mt-auto">
        {/* Driver Profile Section */}
        {driverProfile && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-gray-200">
                {driverProfile.image ? (
                  <img
                    src={driverProfile.image}
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
                {driverProfile.firstName} {driverProfile.lastName}
              </p>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip={t("driver.sidebar.logout")}>
              <LogOut />
              {t("driver.sidebar.logout")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

interface MapTask extends SosAlert {
  assignedAt: Date;
}

export default function DriverLayout() {
  const { t } = useTranslation();
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MapTask[]>([]);
  const [driverProfile, setDriverProfile] = useState<{ firstName: string; lastName: string; image?: string } | null>(null);

  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Driver layout: Auth state changed, user:", user ? user.uid : null);
      if (!user) {
        console.log("Driver layout: No user authenticated, redirecting to login");
        navigate('/login');
        setAuthLoading(false);
        return;
      }

      setUserId(user.uid);

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("Driver layout: User role from Firestore:", userData.role);
          console.log("Driver layout: Available driver roles:", driverRoles);
          if (driverRoles.includes(userData.role)) {
            console.log("Driver layout: User authorized as driver role");
            setIsAuthorized(true);
          } else {
            console.log("Driver layout: User not authorized for driver roles, redirecting to dashboard");
            console.log("Driver layout: User role was:", userData.role);
            navigate('/dashboard');
          }
        } else {
          console.log("Driver layout: No user document found, redirecting to dashboard");
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        navigate('/login');
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch tasks for notification count
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'sosAlerts'),
      where('assignedTeam.driverId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mapTasks: MapTask[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SosAlert;
        mapTasks.push({
          ...data,
          id: doc.id,
          assignedAt: data.timestamp?.toDate() || new Date(),
        });
      });
      setTasks(mapTasks);
    });

    return () => unsubscribe();
  }, [userId]);

  // Fetch driver profile data for sidebar
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setDriverProfile({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          image: userData.image || userData.profileImage || '',
        });
      }
    });

    return () => unsubscribe();
  }, [userId]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const activeAlertsCount = tasks.filter(t => t.status === 'Active' || t.status === 'Responding').length;

  return (
    <SidebarProvider>
      <DriverSidebar activeAlertsCount={activeAlertsCount} driverProfile={driverProfile} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <img src="/shelter_logo.png" alt="Driver Panel Logo" width={32} height={32} />
            <h1 className="text-lg font-semibold">{t("driver.sidebar.panel")}</h1>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6 bg-gray-50/50 dark:bg-gray-900/50 min-h-screen">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}