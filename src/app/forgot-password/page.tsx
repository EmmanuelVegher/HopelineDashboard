"use client";

import React, { useState } from "react";
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
import { ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your email for password reset instructions.",
      });
    } catch (error: any) {
      console.error("Password reset error:", error);

      let errorMessage = "Failed to send reset email. Please try again.";
      let errorTitle = "Reset Failed";

      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address.";
        errorTitle = "Account Not Found";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
        errorTitle = "Invalid Email";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many reset attempts. Please try again later.";
        errorTitle = "Too Many Attempts";
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

  if (emailSent) {
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
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">Check Your Email</h2>
                  <p className="text-slate-600 text-sm mb-4">
                    We've sent password reset instructions to <strong>{email}</strong>
                  </p>
                  <p className="text-slate-500 text-xs">
                    Didn't receive the email? Check your spam folder or try again.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2 p-2 sm:p-3 lg:p-4 bg-slate-50/50">
              <Button
                className="w-full h-8 sm:h-10 text-xs sm:text-sm"
                onClick={() => navigate("/login")}
              >
                Back to Login
              </Button>
              <Button
                variant="outline"
                className="w-full h-8 sm:h-10 text-xs sm:text-sm"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
              >
                Try Different Email
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

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
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-1">Reset Password</h2>
                <p className="text-slate-600 text-xs sm:text-sm">Enter your email address and we'll send you reset instructions</p>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                    Email Address
                  </Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      disabled={loading}
                      className="h-8 sm:h-10 pl-2 sm:pl-3 pr-2 sm:pr-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 bg-slate-50/50 hover:bg-white focus:bg-white text-xs sm:text-sm placeholder:text-slate-400"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-1 sm:gap-2 p-2 sm:p-3 lg:p-4 bg-slate-50/50">
            <Button className="w-full h-8 sm:h-10 text-xs sm:text-sm" onClick={handleResetPassword} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Sending..." : "Send Reset Email"}
            </Button>
            <div className="text-xs sm:text-sm text-center">
              Remember your password?{" "}
              <Link to="/login" className="underline font-medium text-primary">
                Sign in
              </Link>
            </div>
            <div className="text-xs sm:text-sm text-center">
              Don't have an account?{" "}
              <Link to="/signup" className="underline font-medium text-primary">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}