
'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { AlertTriangle, Ambulance, Anchor, Car, Flame, Loader2, Send, Siren, Swords, Tent, User, Waves } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { useState, useCallback, useEffect } from 'react';
import { sendSos } from '@/ai/client';

import { cn } from '@/lib/utils';
import { Input } from './ui/input';

const emergencyTypes = [
  { name: "Medical Emergency", icon: Ambulance },
  { name: "Flood Emergency", icon: Waves },
  { name: "Security Threat", icon: Siren },
  { name: "Fire Emergency", icon: Flame },
  { name: "Road Accident", icon: Car },
  { name: "Kidnapping/Abduction", icon: User, variant: "destructive" },
  { name: "Communal Conflict", icon: Swords },
  { name: "Terrorist Activity", icon: Anchor },
  { name: "Other Emergency", icon: Tent },
];

export function AnonymousSosDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState<{latitude: number, longitude: number, address?: string} | null>(null);

  const [selectedEmergency, setSelectedEmergency] = useState<string>("Other Emergency");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [userName, setUserName] = useState("");
  const [userContact, setUserContact] = useState("");

  const getLocation = useCallback(() => {
    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let address = "Address not found";
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            address = data.display_name || "Could not determine address";
          } catch (e) {
            console.error("Reverse geocoding failed", e);
          }
          setLocation({ latitude, longitude, address });
          setLocationLoading(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({ title: "Location Error", description: "Could not get your location. Please enable location services.", variant: "destructive" });
          setLocationLoading(false);
        }
      );
    } else {
      toast({ title: "Location Error", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      setLocationLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (isOpen) {
        getLocation();
    }
  }, [isOpen, getLocation]);


  const handleSend = async () => {
    if (!location) {
      toast({ title: "Location Required", description: "Cannot send SOS without your location. Please enable location services and try again.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await sendSos({
        emergencyType: selectedEmergency,
        location: location,
        additionalInfo: `Contact Name: ${userName || 'N/A'}\nContact Info: ${userContact || 'N/A'}\n\nDetails: ${additionalInfo}`,
        userEmail: 'anonymous-sos@hopeline.com' // To identify in the backend
      });
      
      if (result.success) {
        toast({
            title: "SOS Sent Successfully",
            description: "Help is on the way. Your alert has been received by our response team.",
        });
        // Reset form
        setSelectedEmergency("Other Emergency");
        setAdditionalInfo("");
        setUserName("");
        setUserContact("");
        setIsOpen(false);
      } else {
        throw new Error("Failed to send SOS alert.");
      }

    } catch (error) {
       toast({
            title: "SOS Failed",
            description: "Could not send your SOS. Please try again or use the USSD code.",
            variant: "destructive"
        });
      console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl z-[1000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-red-500"/>Send Emergency SOS</DialogTitle>
          <DialogDescription>
            This will immediately alert our emergency response team with your
            location. Only use this in a real emergency.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div>
                 <Label>Type of Emergency*</Label>
                 <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                    {emergencyTypes.map((type) => (
                        <button
                        key={type.name}
                        onClick={() => setSelectedEmergency(type.name)}
                        className={cn(
                            "p-2 border rounded-lg flex flex-col items-center justify-center gap-1 text-center transition-colors text-xs",
                            selectedEmergency === type.name ? "bg-blue-100 border-blue-500 ring-2 ring-blue-500" : "hover:bg-gray-100",
                            type.variant === "destructive" && selectedEmergency === type.name ? "bg-red-100 border-red-500 ring-2 ring-red-500" : ""
                        )}
                        >
                        <type.icon className={cn("h-6 w-6", selectedEmergency === type.name ? (type.variant === "destructive" ? "text-red-600" : "text-blue-600") : "text-muted-foreground" )} />
                        <span>{type.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="name">Your Name (Optional)</Label>
                    <Input id="name" placeholder="e.g., John Doe" value={userName} onChange={(e) => setUserName(e.target.value)} />
                </div>
                 <div className="grid w-full gap-1.5">
                    <Label htmlFor="contact">Phone or Email (Optional)</Label>
                    <Input id="contact" placeholder="For the team to contact you" value={userContact} onChange={(e) => setUserContact(e.target.value)} />
                </div>
            </div>
        
          <div className="grid w-full gap-1.5">
            <Label htmlFor="message">Describe your emergency (Optional)</Label>
            <Textarea
              placeholder="E.g., Number of people affected, specific medical needs, landmark for location..."
              id="message"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
            />
          </div>
          <div>
            <Label>Your Location</Label>
             <div className="text-sm space-y-2 p-3 bg-gray-50 rounded-md border mt-1">
                {locationLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Getting your location...</span>
                    </div>
                ) : location ? (
                    <>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-green-600">Location Acquired</span>
                         <Button variant="outline" size="sm" onClick={getLocation}>Refresh</Button>
                    </div>
                     <div className="text-xs text-muted-foreground pt-2">
                        {location.address}
                     </div>
                    </>
                ) : (
                    <div className="flex justify-between">
                        <span className="font-medium text-red-600">Location Not Available</span>
                    </div>
                )}
            </div>
          </div>

        </div>
        <DialogFooter className="sm:justify-between flex-row-reverse pt-4 border-t">
            <Button type="submit" variant="destructive" onClick={handleSend} disabled={isSubmitting || locationLoading} className="gap-2">
                {isSubmitting ? <Loader2 className="animate-spin"/> : <Send className="h-4 w-4"/>}
                {isSubmitting ? "Sending..." : "Send SOS Now"}
            </Button>
            <DialogClose asChild>
                <Button type="button" variant="secondary">
                    Cancel
                </Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
