

"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Building, AlertTriangle, MessageSquare, Navigation, Sun, LogOut, Menu, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "./ui/separator";
import { useLoading } from "@/contexts/LoadingProvider";

type NavLinkItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isSOS?: boolean;
};

const navLinks: NavLinkItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/find-shelter", label: "Find Shelter", icon: Building },
  { href: "/sos", label: "SOS", icon: AlertTriangle, isSOS: true },
  { href: "/assistance", label: "Get Help", icon: MessageSquare },
  { href: "/navigate", label: "Navigate", icon: Navigation },
  { href: "/weather", label: "Weather", icon: Sun },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

const NavLinks = React.memo(() => {
  const location = useLocation();
  const pathname = location.pathname;

  const renderedLinks = useMemo(() =>
    navLinks.map(({ href, label, icon: Icon, isSOS }) => {
      const isActive = pathname === href;
      return (
        <SheetClose asChild key={label}>
          <Link to={href}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-sm sm:text-base transition-colors",
                isSOS && "text-red-600 hover:bg-red-50 hover:text-red-700",
                isActive && !isSOS
                  ? "bg-gray-100 text-primary"
                  : "text-muted-foreground",
                isActive && isSOS && "bg-red-100 text-red-600"
              )}
            >
              <Icon className={cn("mr-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0", isActive && !isSOS ? "text-primary" : "", isSOS ? "text-red-600" : "")} />
              <span className="truncate">{label}</span>
            </Button>
          </Link>
        </SheetClose>
      );
    }), [pathname]
  );

  return <>{renderedLinks}</>;
});

NavLinks.displayName = "NavLinks";

export function Navbar() {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { setIsLoading } = useLoading();
  const navigatedRef = useRef(false);

  const handleLogout = () => {
    setIsLoading(true);
    navigatedRef.current = true;
    // Use setTimeout to ensure navigation completes before resetting loading state
    setTimeout(() => {
      navigate('/login');
    }, 100);
  }

  // Reset loading state after navigation
  useEffect(() => {
    if (navigatedRef.current && pathname === '/login') {
      setIsLoading(false);
      navigatedRef.current = false;
    }
  }, [pathname, setIsLoading]);

  return (
    <header className="flex items-center justify-between mb-6 sm:mb-8 px-2 sm:px-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <img
          src="/caritas-logo.png"
          alt="Caritas Nigeria Logo"
          width={40}
          height={40}
          loading="lazy"
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10"
          data-ai-hint="logo"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold truncate">HopeLine</h1>
          <p className="text-xs text-muted-foreground truncate">by CARITAS Nigeria</p>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-1 bg-gray-100 p-1 rounded-full overflow-hidden">
        {navLinks.map(({ href, label, icon: Icon, isSOS }) => {
          const isActive = pathname === href;
          return (
            <Link to={href} key={label}>
              <Button
                variant="ghost"
                className={cn(
                  "text-sm font-semibold rounded-full px-3 sm:px-4 py-1 h-auto transition-colors whitespace-nowrap",
                  isSOS && "text-red-600 hover:bg-red-50 hover:text-red-700",
                  isActive && !isSOS
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground",
                  isActive && isSOS && "bg-red-100 text-red-600 shadow-sm"
                )}
              >
                <Icon className={cn("mr-2 h-4 w-4 flex-shrink-0", isActive && !isSOS ? "text-primary" : "", isSOS ? "text-red-600" : "")} />
                <span className="hidden xl:inline">{label}</span>
                <span className="xl:hidden">{label.slice(0, 4)}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold">Supported by</p>
          <img
            src="/citi-logo.png"
            alt="CITI Foundation Logo"
            width={80}
            height={30}
            loading="lazy"
            className="w-auto h-auto max-w-[60px] sm:max-w-[80px]"
            data-ai-hint="logo"
          />
        </div>
        <div className="hidden lg:block">
          <Button size="sm" variant="outline" onClick={handleLogout} className="whitespace-nowrap">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="flex-shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:w-80">
              <SheetHeader>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
                <div className="flex flex-col items-center gap-3 sm:gap-4 py-3 sm:py-4">
                  <img
                    src="/hopeline-logo.png"
                    alt="HopeLine Logo"
                    width={150}
                    height={75}
                    loading="lazy"
                    className="w-auto h-auto max-w-[120px] sm:max-w-[150px]"
                    data-ai-hint="logo"
                  />
                  <div className="w-full flex justify-center items-center gap-2 sm:gap-4">
                    <img
                      src="/caritas-logo.png"
                      alt="Caritas Nigeria Logo"
                      width={80}
                      height={30}
                      loading="lazy"
                      className="w-auto h-auto max-w-[60px] sm:max-w-[80px]"
                      data-ai-hint="logo"
                    />
                    <img
                      src="/citi-logo.png"
                      alt="CITI Foundation Logo"
                      width={80}
                      height={30}
                      loading="lazy"
                      className="w-auto h-auto max-w-[60px] sm:max-w-[80px]"
                      data-ai-hint="logo"
                    />
                  </div>
                </div>
              </SheetHeader>
              <Separator className="my-3 sm:my-4" />
              <nav className="flex flex-col gap-2">
                <NavLinks />
              </nav>
              <div className="absolute bottom-4 left-4 right-4">
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
