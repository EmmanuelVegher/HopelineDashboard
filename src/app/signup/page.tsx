"use client";

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, EyeOff, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db, functions } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnonymousSosDialog } from "@/components/anonymous-sos-dialog";

// Define the images for the slideshow (same as login/page.tsx)
const SLIDE_IMAGES = [
  "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=2070&auto=format&fit=crop",
  "/hassan.jpg",
  "/guillermo.jpg"
];


const languages = [
  "English",
  "Hausa",
  "Igbo",
  "Yoruba",
  "Nigerian Pidgin"
];

const nigerianStates = [
  "Federal Capital Territory", "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
  "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState("English");
  const [state, setState] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Slideshow timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDE_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Auto-detect location on load
  useEffect(() => {
    if ("geolocation" in navigator) {
      setDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&email=support@hopeline.ng`);
            const data = await response.json();
            const detectedState = data.address?.state || "";

            if (detectedState) {
              // Standardize detected state for matching
              let searchState = detectedState.toLowerCase();
              if (searchState.includes('abuja') || searchState.includes('fct')) {
                searchState = 'federal capital territory';
              }

              // Try to find a match in our nigerianStates list
              const matchedState = nigerianStates.find(s =>
                searchState.includes(s.toLowerCase()) ||
                s.toLowerCase().includes(searchState)
              );
              if (matchedState) {
                setState(matchedState);
                toast({ title: "Location Detected", description: `Auto-selected ${matchedState} as your state.` });
              }
            }
          } catch (error) {
            console.error("Error auto-detecting location:", error);
          } finally {
            setDetectingLocation(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setDetectingLocation(false);
        },
        { timeout: 10000 }
      );
    }
  }, []);

  const handleGoogleSignUp = async () => {
    if (!state) {
      toast({
        title: "State Required",
        description: "Please select your State of Residence before continuing with Google.",
        variant: "destructive"
      });
      return;
    }
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

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
        toast({ title: "Account Already Exists", description: "Redirecting to your dashboard..." });

        if (role === 'admin') navigate("/admin");
        else if (['driver', 'pilot', 'responder', 'rider'].includes(role)) navigate("/driver/map");
        else if (role === 'support agent') navigate("/support-agent");
        else navigate("/dashboard");
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
          state: state, // Use the selected state
        };
        await setDoc(userDocRef, newUserData);
        toast({ title: "Account Created", description: "Welcome to HopeLine! Redirecting to your dashboard..." });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Google sign-up error:", error);
      toast({ title: "Sign Up Failed", description: error.message || "Failed to sign up with Google.", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!password || !fullName || !mobile || !state) {
      toast({ title: "Missing fields", description: "Please fill in all required fields, including full name, phone number, and state.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const registerUserFn = httpsCallable(functions, 'registerUser');
      const response = await registerUserFn({
        email,
        password,
        fullName,
        mobile,
        state,
        language
      });

      const data: any = response.data;
      if (!data.success) {
        throw new Error("Registration returned failure.");
      }

      // Automatically sign them in using the Client SDK now that the backend created the user
      // Use data.email because it contains the generated virtual email if the user didn't provide one
      await signInWithEmailAndPassword(auth, data.email, password);

      toast({
        title: "Account Created",
        description: "Redirecting to your dashboard..."
      });

      navigate("/dashboard");

    } catch (error: any) {
      toast({ title: "Signup Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="light">
      <div className="flex min-h-screen w-full">

        {/* LEFT SIDE: Slideshow Section */}
        <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-slate-900">
          {SLIDE_IMAGES.map((imgSrc, index) => (
            <div key={index} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-90" : "opacity-0"}`}>
              <img src={imgSrc} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 text-white z-10">
            <h2 className="text-4xl font-bold mb-4">Join the Movement</h2>
            <p className="text-lg opacity-90 max-w-xl">Be part of a community dedicated to providing hope and aid. Together, we can make a difference.</p>

            {/* Dots Indicator */}
            <div className="flex gap-2 mt-6">
              {SLIDE_IMAGES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/60"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Signup Form */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 relative overflow-hidden">

          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-200/40 to-emerald-200/40 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-200/40 to-blue-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 sm:w-72 h-36 sm:h-72 bg-gradient-to-r from-accent/10 to-destructive/10 rounded-full blur-2xl animate-pulse delay-500"></div>
          </div>

          <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md mx-auto relative z-10">
            <div className="text-center mb-6 animate-fade-in-up">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-brand-indigo to-brand-purple rounded-3xl shadow-xl mb-4 animate-float relative group mx-auto">
                <img src="/shelter_logo.png" alt="Logo" width={56} height={56} className="w-full h-full rounded-3xl" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-emerald-700 bg-clip-text text-transparent mb-1">
                {t('auth.signup.title')}
              </h1>
              <p className="text-muted-foreground text-sm">{t('auth.signup.subtitle')}</p>
            </div>

            <Card className="backdrop-blur-sm bg-card shadow-2xl border-0 rounded-3xl overflow-hidden animate-fade-in-up animate-pulse-glow">
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent pointer-events-none"></div>
              <CardContent className="relative p-2 sm:p-4">
                <div className="space-y-3">

                  {/* Full Name */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{t('auth.signup.fullNameLabel')} <span className="text-red-500">*</span></Label>
                    <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} className="h-8 text-xs bg-background/50 px-2" placeholder="John Doe" />
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">{t('auth.signup.emailLabel')}</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="h-8 text-xs bg-background/50 px-2" placeholder="name@example.com" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">{t('auth.signup.phoneLabel')} <span className="text-red-500">*</span></Label>
                      <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={loading} className="h-8 text-xs bg-background/50 px-2" placeholder="08012345678" />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{t('auth.signup.passwordLabel')} <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className="h-8 text-xs bg-background/50 pr-8" placeholder={t('auth.signup.passwordLabel')} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Language & State (Grid) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">{t('auth.signup.languageLabel')}</Label>
                      <Select value={language} onValueChange={setLanguage} disabled={loading}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>{t('auth.signup.stateLabel')} <span className="text-red-500">*</span></span>
                        {detectingLocation && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="h-8 w-full justify-between text-xs bg-background/50 px-2">
                            {state || t('common.select')}
                            <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="end">
                          <div className="p-2 border-b"><Input placeholder="Search..." className="h-7 text-xs" value={stateSearch} onChange={(e) => setStateSearch(e.target.value)} /></div>
                          <div className="max-h-40 overflow-y-auto p-1">
                            {nigerianStates.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase())).map(s => (
                              <div key={s} className="flex items-center px-2 py-1.5 text-xs hover:bg-accent rounded-sm cursor-pointer" onClick={() => { setState(s); setStateSearch(""); }}>
                                <Check className={`mr-2 h-3 w-3 ${state === s ? "opacity-100" : "opacity-0"}`} />
                                {s}
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Privilege text removed since roles are defaulted */}

                </div>
              </CardContent>

              <CardFooter className="flex-col gap-2 p-4 bg-slate-50/50">
                <Button className="w-full h-9 text-xs" onClick={handleSignup} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  {loading ? t('auth.signup.signingUp') : t('auth.signup.signUp')}
                </Button>

                <div className="relative w-full my-1">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-300" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-slate-50 px-2 text-muted-foreground">{t('auth.login.orContinueWith')}</span></div>
                </div>

                <Button variant="outline" className="w-full h-9 text-xs" onClick={handleGoogleSignUp} disabled={googleLoading || loading}>
                  {googleLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : (
                    <div className="flex items-center"><svg className="mr-2 h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg> {t('auth.signup.googleSignUp')}</div>
                  )}
                </Button>

                <div className="text-xs text-center mt-1">
                  {t('auth.signup.alreadyHaveAccount')} <Link to="/login" className="underline font-medium text-primary">{t('auth.signup.logIn')}</Link>
                </div>

                <Separator className="my-1" />
                <AnonymousSosDialog>
                  <Button variant="destructive" className="w-full h-8 text-xs"><AlertTriangle className="mr-2 h-3 w-3" /> {t('auth.login.sosAlert')}</Button>
                </AnonymousSosDialog>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
