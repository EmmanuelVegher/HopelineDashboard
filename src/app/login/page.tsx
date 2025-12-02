"use client";

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import type { AdminUser } from "@/lib/data";
import { Separator } from "@/components/ui/separator";
import { AnonymousSosDialog } from "@/components/anonymous-sos-dialog";

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const logHeights = () => {
      console.log("Viewport height:", window.innerHeight);
      console.log("Document scroll height:", document.documentElement.scrollHeight);
      console.log("Body scroll height:", document.body.scrollHeight);
    };
    logHeights();
    window.addEventListener('resize', logHeights);
    return () => window.removeEventListener('resize', logHeights);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
        toast({
            title: "Missing fields",
            description: "Please enter both email and password.",
            variant: "destructive"
        })
        return;
    }
    setLoading(true);

    // Dummy admin login for testing
    if (email === "admin@hopeline.com" && password === "admin123") {
        console.log("Dummy admin login successful");
        toast({ title: "Admin Login Successful", description: "Redirecting to the admin dashboard..." });
        navigate("/admin");
        setLoading(false);
        return;
    }

    try {
      console.log("Attempting to sign in with:", email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Firebase Auth successful for user:", user.uid);

      // Get user document using Firebase Auth UID as document ID
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("User document found:", userData);

        // Role-based routing with case-insensitive matching
        const role = userData.role?.toLowerCase();
        console.log("User role from Firestore:", userData.role);
        if (role === 'admin') {
          console.log("Redirecting to /admin for admin user");
          toast({ title: "Admin Login Successful", description: "Redirecting to the admin dashboard..." });
          navigate("/admin");
        } else if (['driver', 'pilot', 'responder', 'rider'].includes(role)) {
          console.log("Redirecting to /driver for role:", userData.role);
          toast({ title: "Login Successful", description: "Redirecting to driver management page..." });
          navigate("/driver");
        } else {
          console.log("Redirecting to /dashboard for role:", userData.role);
          toast({ title: "Login Successful", description: "Redirecting to your dashboard..." });
          navigate("/dashboard");
        }
      } else {
        console.log("No user document found in users collection");
        // Create a basic user profile if it doesn't exist
        const basicProfile: Partial<AdminUser> = {
          displayName: user.displayName || email.split('@')[0],
          email: user.email || email,
          role: 'User',
          profileCompleted: 0,
        };

        // For now, just redirect to dashboard since we can't write without proper permissions
        toast({ title: "Login Successful", description: "Redirecting to your dashboard..." });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Login error:", error);

      let errorMessage = "Please check your email and password.";
      let errorTitle = "Login Failed";

      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address. Please sign up first.";
        errorTitle = "Account Not Found";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Please try again.";
        errorTitle = "Wrong Password";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
        errorTitle = "Invalid Email";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
        errorTitle = "Too Many Attempts";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your connection and try again.";
        errorTitle = "Network Error";
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = "This account has been disabled. Please contact support.";
        errorTitle = "Account Disabled";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/password authentication is not enabled. Please check Firebase configuration.";
        errorTitle = "Authentication Not Enabled";
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col sm:flex-row items-center justify-center p-1 sm:p-2 lg:p-3 bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 relative overflow-hidden">
      {/* Enhanced animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 sm:-top-40 -right-10 sm:-right-40 w-48 sm:w-96 h-48 sm:h-96 bg-gradient-to-br from-blue-200/40 to-emerald-200/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-20 sm:-bottom-40 -left-10 sm:-left-40 w-48 sm:w-96 h-48 sm:h-96 bg-gradient-to-tr from-emerald-200/40 to-blue-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 sm:w-72 h-36 sm:h-72 bg-gradient-to-r from-amber-200/30 to-orange-200/30 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md mx-auto relative z-10">
        {/* Enhanced Header Section */}
        <div className="text-center mb-4 sm:mb-6 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-white via-white to-white rounded-3xl shadow-xl mb-3 sm:mb-4 animate-float relative group mx-auto">
            <img
              src="/shelter_logo.png"
              alt="Shelter Logo"
              width={64}
              height={64}
              className="w-full h-full rounded-3xl"
              data-ai-hint="logo"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-emerald-700 bg-clip-text text-transparent mb-1 tracking-tight">
            HopeLine
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-medium mb-1">Shelter Management System</p>
          <p className="text-xs text-slate-500 font-medium">Empowering Communities • Saving Lives</p>
        </div>

        <Card className="backdrop-blur-sm bg-white/95 shadow-2xl border-0 rounded-3xl overflow-hidden animate-fade-in-up animate-pulse-glow">
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent pointer-events-none"></div>
          <CardContent className="relative p-2 sm:p-3 lg:p-4">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-center mb-3 sm:mb-4 animate-slide-in-right">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-1">Welcome Back</h2>
                <p className="text-slate-600 text-xs sm:text-sm">Sign in to access your dashboard</p>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    Email Address
                  </Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="h-8 sm:h-10 pl-2 sm:pl-3 pr-2 sm:pr-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 bg-slate-50/50 hover:bg-white focus:bg-white text-xs sm:text-sm placeholder:text-slate-400"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Password
                  </Label>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={loading}
                      className="h-8 sm:h-10 pl-2 sm:pl-3 pr-8 sm:pr-10 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-300 bg-slate-50/50 hover:bg-white focus:bg-white text-xs sm:text-sm placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-200 hover:scale-110 p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </button>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-600/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-1 sm:gap-2 p-2 sm:p-3 lg:p-4 bg-slate-50/50">
            <Button className="w-full h-8 sm:h-10 text-xs sm:text-sm" onClick={handleLogin} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing In..." : "Sign In"}
            </Button>
            <div className="text-xs sm:text-sm text-center">
              Don't have an account?{" "}
              <Link to="/signup" className="underline font-medium text-primary">
                Sign up
              </Link>
            </div>
            <Separator className="my-2" />
            <AnonymousSosDialog>
              <Button variant="destructive" className="w-full h-8 sm:h-10 text-xs sm:text-sm">
                <AlertTriangle className="mr-2 h-4 w-4"/>
                Emergency SOS
              </Button>
            </AnonymousSosDialog>
            <p className="text-xs text-center text-muted-foreground mt-1 px-2">Use the SOS button for emergencies without logging in.</p>
            <div className="w-full text-center space-y-2 sm:space-y-3 pt-1">
              <Separator />
              <p className="text-xs text-muted-foreground px-2">Supported By</p>
              <div className="flex justify-center items-center gap-1 sm:gap-2 px-2 flex-wrap">
                <img
                  src="/caritas-logo.png"
                  alt="Caritas Nigeria Logo"
                  width={80}
                  height={32}
                  loading="lazy"
                  className="w-auto h-auto max-w-[140px] sm:max-w-[160px]"
                  data-ai-hint="logo"
                />
                <img
                  src="/citi-logo.png"
                  alt="CITI Foundation Logo"
                  width={80}
                  height={32}
                  loading="lazy"
                  className="w-auto h-auto max-w-[140px] sm:max-w-[160px]"
                  data-ai-hint="logo"
                />
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
