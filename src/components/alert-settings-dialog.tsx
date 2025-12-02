
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AlertSettingsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSaveChanges = () => {
    toast({
      title: "Settings Saved",
      description: "Your alert notification preferences have been updated.",
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="mr-2 h-4 w-4" />
          Alert Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] z-[1000]">
        <DialogHeader>
          <DialogTitle>Alert Settings</DialogTitle>
          <DialogDescription>
            Manage how you receive notifications for new alerts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex items-center justify-between space-x-4 rounded-md border p-4">
            <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive an email for every new SOS alert.</p>
            </div>
            <Switch defaultChecked/>
          </div>
           <div className="flex items-center justify-between space-x-4 rounded-md border p-4">
            <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">High-Priority SMS</p>
                <p className="text-sm text-muted-foreground">Get an instant SMS for high-priority alerts.</p>
            </div>
            <Switch />
          </div>
          <div className="rounded-md border p-4 space-y-4">
             <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Quiet Hours</p>
                <p className="text-sm text-muted-foreground">Silence non-critical notifications during these hours.</p>
            </div>
             <div className="flex items-center gap-4">
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="start-time">From</Label>
                    <Input id="start-time" type="time" defaultValue="22:00" />
                </div>
                 <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="end-time">To</Label>
                    <Input id="end-time" type="time" defaultValue="08:00" />
                </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSaveChanges}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
