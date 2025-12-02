
"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { UserProfile } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Languages, Bell } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const languages = [
    "English",
    "Hausa",
    "Igbo",
    "Yoruba",
    "Nigerian Pidgin"
];

export default function SettingsPage() {
  const [user, authLoading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [language, setLanguage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setProfile(profileData);
          setLanguage(profileData.language || "English");
        }
        setLoading(false);
      } else if (!authLoading) {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, authLoading]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { language });
      toast({ title: "Settings Saved", description: "Your language preference has been updated." });
    } catch (error) {
      toast({ title: "Failed to update settings", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading || authLoading) {
    return (
        <Card>
            <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    )
  }

  if (!user || !profile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p>You must be logged in to view your settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage your application preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
            <div className="flex items-start gap-4">
                <Languages className="h-6 w-6 text-primary mt-1" />
                <div>
                    <h3 className="text-lg font-semibold">Language</h3>
                    <p className="text-muted-foreground text-sm">Choose the language for application text and chat translation.</p>
                </div>
            </div>
            <div className="pl-10">
                <Label htmlFor="language" className="sr-only">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language" className="w-full md:w-1/2">
                        <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                        {languages.map(lang => (
                             <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-start gap-4">
                <Bell className="h-6 w-6 text-primary mt-1" />
                <div>
                    <h3 className="text-lg font-semibold">Notifications</h3>
                    <p className="text-muted-foreground text-sm">Manage how you receive notifications.</p>
                </div>
            </div>
            <div className="pl-10 space-y-4">
                 <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="push-notifications" className="font-normal">
                        Push Notifications
                    </Label>
                    <Switch id="push-notifications" />
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-3">
                     <Label htmlFor="email-notifications" className="font-normal">
                        Email Notifications
                    </Label>
                    <Switch id="email-notifications" checked />
                </div>
            </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
