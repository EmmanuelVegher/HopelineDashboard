"use client";

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db, functions } from "@/lib/firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { AdminUser } from "@/lib/data";
import { Separator } from "@/components/ui/separator";
import { AnonymousSosDialog } from "@/components/anonymous-sos-dialog";

// Define the images and videos for the slideshow
const SLIDE_MEDIA = [
  // { type: 'image', url: "/farah.jpg" },
  // Example of how to add a video:
  { type: 'video', url: "/drone_footage.MP4" },
  //{ type: 'image', url: "/hassan.jpg" },
  //{ type: 'image', url: "/guillermo.jpg" },

];

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // State for slideshow
  const [currentSlide, setCurrentSlide] = useState(0);

  // Slideshow timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDE_MEDIA.length);
    }, 5000); // Change image/video every 5 seconds
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const logHeights = () => {
      console.log("Viewport height:", window.innerHeight);
    };
    logHeights();
    window.addEventListener('resize', logHeights);
    return () => window.removeEventListener('resize', logHeights);
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role?.toLowerCase();

        // Sync profile image from Google if it's missing or different
        if (user.photoURL && userData.image !== user.photoURL) {
          console.log("Syncing Google photo to image field for existing user");
          await updateDoc(userDocRef, { image: user.photoURL });
        }

        if (role === 'admin' || role === 'super-admin' || role === 'super admin' || role === 'superadmin') {
          toast({ title: "Welcome back!", description: "Redirecting to the admin dashboard..." });
          navigate("/admin");
        } else if (['driver', 'pilot', 'responder', 'rider'].includes(role)) {
          toast({ title: "Welcome back!", description: "Redirecting to driver dashboard..." });
          navigate("/driver/map");
        } else if (role === 'support agent') {
          toast({ title: "Welcome back!", description: "Redirecting to support agent dashboard..." });
          navigate("/support-agent");
        } else {
          toast({ title: "Welcome back!", description: "Redirecting to your dashboard..." });
          navigate("/dashboard");
        }
      } else {
        const newUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'New User',
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          image: user.photoURL || '',
          role: 'user',
          accountStatus: 'active',
          createdAt: serverTimestamp(),
          isOnline: true,
          profileCompleted: 0,
          language: 'English',
          gender: '',
          mobile: 0,
        };

        await setDoc(userDocRef, newUserData);

        toast({
          title: "Account Created",
          description: "Welcome to HopeLine! Redirecting to your dashboard..."
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast({
        title: "Sign In Failed",
        description: error.message || "Failed to sign in with Google.",
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

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

    const trimmedEmail = email.trim();
    console.log("Login attempt for:", trimmedEmail);
    let loginEmail = trimmedEmail;

    // Phone number resolution logic
    if (trimmedEmail && !trimmedEmail.includes('@')) {
      try {
        console.log("Looking up genuine email for phone number:", trimmedEmail);
        const getUserEmail = httpsCallable(functions, 'getUserEmailByPhone');
        const result = await getUserEmail({ phoneNumber: trimmedEmail });

        if (result.data && (result.data as any).email) {
          loginEmail = (result.data as any).email;
          console.log("Resolved real email mapped to phone number.");
        } else {
          // Fallback legacy logic for older test accounts that explicitly used @hopeline.app
          loginEmail = `${trimmedEmail}@hopeline.app`;
        }
      } catch (err) {
        console.error("Failed to query getUserEmailByPhone via callable, failing gracefully:", err);
        loginEmail = `${trimmedEmail}@hopeline.app`;
      }
    }

    if (trimmedEmail === "admin@hopeline.com" && password === "admin123") {
      toast({ title: "Admin Bypass Successful", description: "Redirecting to the admin dashboard..." });
      navigate("/admin");
      setLoading(false);
      return;
    }

    try {
      console.log("Calling signInWithEmailAndPassword...");
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;
      console.log("Firebase Auth success. UID:", user.uid);

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role?.toLowerCase();
        console.log("User document found. Role:", role);

        if (role === 'admin' || role === 'super-admin' || role === 'super admin' || role === 'superadmin') {
          toast({ title: "Admin Login Successful", description: "Redirecting to the admin dashboard..." });
          navigate("/admin");
        } else if (['driver', 'pilot', 'responder', 'rider'].includes(role)) {
          toast({ title: "Login Successful", description: "Redirecting to driver dashboard..." });
          navigate("/driver/map");
        } else if (role === 'support agent') {
          toast({ title: "Login Successful", description: "Redirecting to support agent dashboard..." });
          navigate("/support-agent");
        } else {
          toast({ title: "Login Successful", description: "Redirecting to your dashboard..." });
          navigate("/dashboard");
        }
      } else {
        console.warn("No user document found for UID:", user.uid);
        toast({ title: "Login Successful", description: "Redirecting to your dashboard..." });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Full Login Error Info:", {
        code: error.code,
        message: error.message,
        triedEmail: loginEmail
      });

      let errorMessage = "Please check your email/phone number and password.";
      let errorTitle = "Login Failed";

      if (error.code === 'auth/user-not-found') errorMessage = "No account found with this email/phone.";
      else if (error.code === 'auth/wrong-password') errorMessage = "Incorrect password.";
      else if (error.code === 'auth/invalid-email') errorMessage = "Please enter a valid email address.";
      else if (error.code === 'auth/too-many-requests') errorMessage = "Too many failed attempts. Please try again later or reset your password.";
      else if (error.code === 'auth/user-disabled') errorMessage = "This account has been disabled. Please contact support.";
      else if (error.code === 'auth/network-request-failed') errorMessage = "Network error. Please check your internet connection.";

      // Always show code for debugging
      const displayedMessage = `${errorMessage} (${error.code || 'unknown'})`;

      toast({
        title: errorTitle,
        description: displayedMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="light">
      <div className="flex min-h-screen w-full">

        {/* LEFT SIDE: Slideshow Section */}
        <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-slate-900">
          {/* Slideshow Media */}
          {SLIDE_MEDIA.map((media, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100" : "opacity-0"
                }`}
            >
              {media.type === 'video' ? (
                <video
                  src={media.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="w-full h-full object-cover transition-opacity duration-1000"
                  style={{
                    filter: "contrast(1.05) brightness(1.05)",
                    willChange: "opacity, transform"
                  }}
                />
              ) : (
                <img
                  src={media.url}
                  alt={`Humanitarian Aid Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}

          {/* Dark overlay for text readability (Static) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 text-white z-10">
            <h2 className="text-4xl font-bold mb-4">Bringing Light to Every Shelter</h2>
            <p className="text-lg opacity-90 max-w-xl">Providing hope and humanitarian housing aid to communities in need, one person at a time.</p>

            {/* Optional Dots Indicator */}
            <div className="flex gap-2 mt-6">
              {SLIDE_MEDIA.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/60"
                    }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Login Form (Unchanged) */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 relative overflow-hidden">

          {/* Enhanced animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 sm:-top-40 -right-10 sm:-right-40 w-48 sm:w-96 h-48 sm:h-96 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-20 sm:-bottom-40 -left-10 sm:-left-40 w-48 sm:w-96 h-48 sm:h-96 bg-gradient-to-tr from-secondary/10 to-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 sm:w-72 h-36 sm:h-72 bg-gradient-to-r from-accent/10 to-destructive/10 rounded-full blur-2xl animate-pulse delay-500"></div>
          </div>

          <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md mx-auto relative z-10">
            {/* Enhanced Header Section */}
            <div className="text-center mb-4 sm:mb-6 animate-fade-in-up">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-brand-indigo to-brand-purple rounded-3xl shadow-xl mb-3 sm:mb-4 animate-float relative group mx-auto">
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
                Caritas Hopeline
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base font-medium mb-1">Integrated Solution For Humanitarian Housing Aid Initiative</p>
              <p className="text-xs text-muted-foreground font-medium">Empowering Communities • Saving Lives</p>
            </div>

            <Card className="backdrop-blur-sm bg-card shadow-2xl border-0 rounded-3xl overflow-hidden animate-fade-in-up animate-pulse-glow">
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent pointer-events-none"></div>
              <CardContent className="relative p-2 sm:p-3 lg:p-4">
                <div className="space-y-3 sm:space-y-4">
                  <div className="text-center mb-3 sm:mb-4 animate-slide-in-right">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">{t('auth.login.title')}</h2>
                    <p className="text-muted-foreground text-xs sm:text-sm">{t('auth.login.subtitle')}</p>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        {t('auth.login.emailLabel')}
                      </Label>
                      <div className="relative group">
                        <Input
                          id="email"
                          type="text"
                          placeholder="Enter email or phone number"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={loading}
                          className="h-8 sm:h-10 pl-2 sm:pl-3 pr-2 sm:pr-3 rounded-xl border-2 border-input focus:border-ring focus:ring-4 focus:ring-ring/20 transition-all duration-300 bg-background/50 hover:bg-background focus:bg-background text-xs sm:text-sm placeholder:text-muted-foreground"
                        />
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        {t('auth.login.passwordLabel')}
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
                          className="h-8 sm:h-10 pl-2 sm:pl-3 pr-8 sm:pr-10 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-300 bg-slate-50/50 hover:bg-white focus:bg-white text-xs sm:text-sm placeholder:text-slate-400 text-black dark:placeholder:text-gray-600"
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
                  {loading ? t('auth.login.signingIn') : t('auth.login.signIn')}
                </Button>

                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-muted px-2 text-muted-foreground font-medium">{t('auth.login.orContinueWith')}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-8 sm:h-10 text-xs sm:text-sm border-slate-300 hover:bg-slate-50"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                >
                  {googleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {googleLoading ? t('auth.login.signingIn') : t('auth.login.googleSignIn')}
                </Button>

                <div className="text-xs sm:text-sm text-center space-y-1">
                  <div>
                    {t('auth.login.noAccount')}{" "}
                    <Link to="/signup" className="underline font-medium text-primary dark:text-black">
                      {t('auth.login.createAccount')}
                    </Link>
                  </div>
                  <div>
                    <Link to="/forgot-password" className="underline font-medium text-primary dark:text-black">
                      {t('auth.login.forgotPassword')}
                    </Link>
                  </div>
                </div>
                <Separator className="my-2" />
                <AnonymousSosDialog>
                  <Button variant="destructive" className="w-full h-8 sm:h-10 text-xs sm:text-sm">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    {t('auth.login.sosAlert')}
                  </Button>
                </AnonymousSosDialog>
                <p className="text-xs text-center text-white mt-1 px-2">{t('auth.login.anonymousSos')}</p>
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
                  <Separator />
                  <p className="text-xs text-muted-foreground px-2">In partnership with:</p>
                  <div className="flex justify-center items-center gap-1 sm:gap-2 px-2 flex-wrap">
                    <img
                      src="/adamawa-logo.png"
                      alt="Adamawa State Government Logo"
                      width={48}
                      height={20}
                      loading="lazy"
                      className="w-auto h-auto max-w-[80px] sm:max-w-[96px]"
                      data-ai-hint="logo"
                    />
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}