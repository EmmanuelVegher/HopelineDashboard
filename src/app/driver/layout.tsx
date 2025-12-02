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
} from "@/components/ui/sidebar";
import {
  CheckCircle,
  User,
  Settings,
  History,
  Map,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate, Outlet, Link } from "react-router-dom";
import { useLoading } from '@/contexts/LoadingProvider';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';

const driverRoles = ['driver', 'pilot', 'responder', 'rider', 'Driver', 'Pilot', 'Responder', 'Rider'];

const navLinks = [
  { to: "/driver/tasks", label: "Tasks", icon: CheckCircle },
  { to: "/driver/profile", label: "Profile", icon: User },
  { to: "/driver/settings", label: "Settings", icon: Settings },
  { to: "/driver/history", label: "History", icon: History },
  { to: "/driver/map", label: "Map", icon: Map },
];

function DriverSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { setIsLoading } = useLoading();
  const { toast } = useToast();

  console.log("DriverSidebar: Current location pathname:", location.pathname);

  const handleLogout = async () => {
    console.log("DriverSidebar: Logout clicked");
    try {
      setIsLoading(true);
      await signOut(auth);
      navigate('/login');
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
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
            <img src="/hopeline-logo.png" alt="Hopeline Logo" width={40} height={40} />
            {state === 'expanded' && <h1 className="text-xl font-bold">Driver Panel</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            console.log(`DriverSidebar: Checking ${label} - path: ${to}, current: ${location.pathname}, isActive: ${isActive}`);
            return (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton isActive={isActive} tooltip={label} asChild>
                  <Link to={to}>
                    <Icon />
                    {label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarContent className="p-2 mt-auto">
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

export default function DriverLayout() {
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

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

  return (
    <SidebarProvider>
      <DriverSidebar />
      <SidebarInset>
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}