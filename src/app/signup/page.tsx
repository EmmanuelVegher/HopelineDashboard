

"use client";

import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, addDoc, getDoc } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { AnonymousSosDialog } from "@/components/anonymous-sos-dialog";

type UserRole = "user" | "admin" | "support agent";

const languages = [
    "English",
    "Hausa",
    "Igbo",
    "Yoruba",
    "Nigerian Pidgin"
];

const nigerianStates = [
    "Abuja (FCT)",
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara"
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [language, setLanguage] = useState("English");
  const [state, setState] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  
  const isPrivilegedRole = role === 'admin' || role === 'support agent';

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log("Google Auth successful for user:", user.uid);

      // Check if user document already exists
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // User already exists, redirect to appropriate dashboard
        const userData = userDoc.data();
        const role = userData.role?.toLowerCase();

        toast({
          title: "Account Already Exists",
          description: "Redirecting to your dashboard..."
        });

        if (role === 'admin') {
          navigate("/admin");
        } else if (['driver', 'pilot', 'responder', 'rider'].includes(role)) {
          navigate("/driver/map");
        } else if (role === 'support agent') {
          navigate("/support-agent");
        } else {
          navigate("/dashboard");
        }
      } else {
        // Create new user document for Google sign-up
        console.log("Creating new user document for Google sign-up");

        const newUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'New User',
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          image: user.photoURL || '',
          role: 'user', // Default role for Google sign-up users
          accountStatus: 'active',
          createdAt: serverTimestamp(),
          isOnline: true,
          profileCompleted: 0,
          language: 'English',
          gender: '',
          mobile: 0,
          state: '', // Will be filled later in profile
        };

        await setDoc(userDocRef, newUserData);

        toast({
          title: "Account Created",
          description: "Welcome to HopeLine! Redirecting to your dashboard..."
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Google sign-up error:", error);

      let errorMessage = "Failed to sign up with Google.";
      let errorTitle = "Sign Up Failed";

      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign up was cancelled.";
        errorTitle = "Cancelled";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Pop-up was blocked by your browser. Please allow pop-ups and try again.";
        errorTitle = "Pop-up Blocked";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "An account already exists with this email using a different sign-up method.";
        errorTitle = "Account Exists";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your connection and try again.";
        errorTitle = "Network Error";
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignup = async () => {
    // if (!recaptchaToken) {
    //     toast({
    //         title: "Verification Failed",
    //         description: "Please complete the reCAPTCHA challenge.",
    //         variant: "destructive",
    //     });
    //     return;
    // }

    if (!email || (!isPrivilegedRole && !password) || !role || !state) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields, including state.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    // Here you would typically send the recaptchaToken to your server
    // for verification along with the signup data.
    // For now, we'll proceed assuming client-side verification is enough for the demo.

    if (isPrivilegedRole) {
       try {
         // Create Firebase Auth account for privileged users
         const userCredential = await createUserWithEmailAndPassword(auth, email, password || 'TempPass123!'); // Use temp password for privileged users
         const user = userCredential.user;

         // Create user document in Firestore
         await setDoc(doc(db, "users", user.uid), {
           uid: user.uid,
           email: user.email,
           role: role,
           accountStatus: 'active',
           createdAt: serverTimestamp(),
           isOnline: true,
           displayName: user.email?.split('@')[0] || 'New User',
           firstName: '',
           lastName: '',
           gender: '',
           image: '',
           mobile: 0,
           profileCompleted: 0,
           language: language,
           state: state,
         });

         toast({
           title: "Account Created",
           description: `Welcome! You have been registered as a ${role}. Redirecting to your dashboard...`,
         });

         // Route based on role
         if (role === 'admin') {
           navigate("/admin");
         } else {
           navigate("/dashboard");
         }
       } catch (error: any) {
         toast({
           title: "Account Creation Failed",
           description: error.message || "Could not create your account.",
           variant: "destructive",
         });
       } finally {
         setLoading(false);
       }
       return;
     }

    // Standard user signup
    try {
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: role,
        accountStatus: 'active',
        createdAt: serverTimestamp(),
        isOnline: true,
        displayName: user.email?.split('@')[0] || 'New User',
        firstName: '',
        lastName: '',
        gender: '',
        image: '',
        mobile: 0,
        profileCompleted: 0,
        language: language,
        state: state,
      });

      toast({ title: "Account Created", description: "Redirecting to your dashboard..." });
      navigate("/dashboard");

    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Enhanced animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-200/40 to-emerald-200/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-200/40 to-blue-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-r from-amber-200/30 to-orange-200/30 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md mx-auto relative z-10">
        {/* Enhanced Header Section */}
        <div className="text-center mb-6 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 via-emerald-600 to-amber-600 rounded-2xl shadow-xl mb-4 animate-bounce relative group">
            <img
              src="/shelter_logo.png"
              alt="Shelter Logo"
              width={64}
              height={64}
              className="w-full h-full rounded-2xl object-cover"
              data-ai-hint="logo"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-emerald-400/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand-indigo-text to-brand-purple-text bg-clip-text text-transparent mb-2 tracking-tight">
            HopeLine
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base font-medium">Shelter Management System</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Join Us in Making a Difference</p>
        </div>

        <Card className="backdrop-blur-sm bg-card shadow-2xl border-0 rounded-3xl overflow-hidden animate-fade-in-up animate-pulse-glow">
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent"></div>
          <CardContent className="relative p-1 sm:p-2 px-2 sm:px-3">
            <div className="text-center mb-2 animate-slide-in-right">
              <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">Create Account</h2>
              <p className="text-muted-foreground text-xs sm:text-sm">Join our mission to help communities</p>
            </div>
          <div className="space-y-2 sm:space-y-3">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                User Type
              </Label>
              <div className="relative group">
                <Select value={role} onValueChange={(value) => setRole(value as UserRole)} disabled={loading}>
                  <SelectTrigger id="role" className="h-7 sm:h-8 px-3 py-2 rounded-lg border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-300 bg-background/50 hover:bg-background focus:bg-background text-xs">
                      <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="user">User (Seeking Assistance)</SelectItem>
                      <SelectItem value="support agent">Support Agent (Staff)</SelectItem>
                      <SelectItem value="admin">Admin (Staff)</SelectItem>
                  </SelectContent>
               </Select>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                Email Address
              </Label>
              <div className="relative group">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-7 sm:h-8 px-3 py-2 rounded-lg border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-300 bg-background/50 hover:bg-background focus:bg-background text-xs placeholder:text-muted-foreground"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Password
              </Label>
              <div className="relative group">
                <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    required={!isPrivilegedRole}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                    disabled={loading}
                    className="h-7 sm:h-8 px-3 py-2 pr-8 rounded-lg border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-300 bg-background/50 hover:bg-background focus:bg-background text-xs placeholder:text-muted-foreground"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-600/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Preferred Language
              </Label>
              <div className="relative group">
                <Select value={language} onValueChange={setLanguage} disabled={loading}>
                    <SelectTrigger id="language" className="h-7 sm:h-8 px-3 py-2 rounded-lg border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-300 bg-background/50 hover:bg-background focus:bg-background text-xs">
                        <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                        {languages.map(lang => (
                                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-600/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                State *
              </Label>
              <div className="relative group">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="h-7 sm:h-8 px-3 py-2 rounded-lg border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-300 bg-background/50 hover:bg-background focus:bg-background text-xs justify-between w-full"
                      disabled={loading}
                    >
                      {state || "Select your state..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search states..."
                        value={stateSearch}
                        onChange={(e) => setStateSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {nigerianStates
                        .filter((stateName) =>
                          stateName.toLowerCase().includes(stateSearch.toLowerCase())
                        )
                        .map((stateName) => (
                          <div
                            key={stateName}
                            className="flex items-center px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => {
                              setState(stateName);
                              setStateSearch("");
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                state === stateName ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {stateName}
                          </div>
                        ))}
                      {nigerianStates.filter((stateName) =>
                        stateName.toLowerCase().includes(stateSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No states found.
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {isPrivilegedRole && (
              <div className="text-xs text-primary bg-muted p-2 rounded-md">
                Admin and Support Agent accounts are created by an administrator. After approval, you will be able to set your password.
              </div>
            )}

            {/* <div className="flex justify-center">
                 <ReCAPTCHA
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
                    onChange={(token) => setRecaptchaToken(token)}
                />
            </div> */}
          </div>
          </CardContent>
          <CardFooter className="flex-col gap-1 p-3 sm:p-4 lg:p-5 bg-muted/50">
            <Button
              className="w-full h-7 sm:h-8 px-3 py-2 text-xs bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 interactive-element"
              onClick={handleSignup}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {loading ? "Creating..." : (isPrivilegedRole ? "Request Access" : "Create Account")}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-medium">Or sign up with</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-7 sm:h-8 px-3 py-2 text-xs border-border hover:bg-accent"
              onClick={handleGoogleSignUp}
              disabled={googleLoading || loading}
            >
              {googleLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
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
              {googleLoading ? "Signing up..." : "Sign up with Google"}
            </Button>

            <div className="text-center space-y-2">
              <div className="text-xs">
                <span className="text-slate-600">Already have an account?</span>{" "}
                <button
                  onClick={() => navigate('/login')}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer pointer-events-auto relative z-10"
                >
                  Sign In
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground font-medium">Emergency Access</span>
                </div>
              </div>

              <AnonymousSosDialog>
                <Button
                  variant="destructive"
                  className="w-full h-7 sm:h-8 px-3 py-2 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 interactive-element"
                >
                  <AlertTriangle className="mr-1 h-3 w-3"/>
                  Emergency SOS
                </Button>
              </AnonymousSosDialog>

              <p className="text-xs text-slate-500 text-center leading-relaxed px-1">
                For urgent situations, use the SOS button above for immediate assistance without creating an account.
              </p>
            </div>

            <div className="w-full text-center space-y-1 pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium">Supported & Powered By</p>
              <div className="flex justify-center items-center gap-2">
                <div className="flex items-center gap-0.5 bg-white rounded px-0.5 py-0.5 shadow-sm">
                  <img
                    src="/caritas-logo.png"
                    alt="Caritas Nigeria Logo"
                    width={6}
                    height={3}
                    loading="lazy"
                    className="w-auto h-auto opacity-80 hover:opacity-100 transition-opacity"
                    data-ai-hint="logo"
                  />
                </div>
                <div className="w-px h-3 bg-border"></div>
                <div className="flex items-center gap-0.5 bg-white rounded px-0.5 py-0.5 shadow-sm">
                  <img
                    src="/citi-logo.png"
                    alt="CITI Foundation Logo"
                    width={12}
                    height={5}
                    loading="lazy"
                    className="w-auto h-auto opacity-80 hover:opacity-100 transition-opacity"
                    data-ai-hint="logo"
                  />
                </div>
              </div>
            </div>
          </CardFooter>
      </Card>
    </div>
    </div>
  );
}
