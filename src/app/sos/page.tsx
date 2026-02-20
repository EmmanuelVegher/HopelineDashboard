"use client";
import { useState, useEffect, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Ambulance, Anchor, Car, Check, Flame, Siren, Swords, Tent, User, Waves, Loader2, MapPin, Phone, AlertCircle, CheckCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { sendSos } from "@/ai/client";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { UssdCode } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { NIGERIA_STATE_BOUNDS } from "@/lib/nigeria-geography";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

const emergencyTypes = [
  { name: "Medical Emergency", icon: Ambulance, color: "bg-red-100 text-red-600", borderColor: "border-red-200" },
  { name: "Flood Emergency", icon: Waves, color: "bg-blue-100 text-blue-600", borderColor: "border-blue-200" },
  { name: "Security Threat", icon: Siren, color: "bg-purple-100 text-purple-600", borderColor: "border-purple-200" },
  { name: "Fire Emergency", icon: Flame, color: "bg-orange-100 text-orange-600", borderColor: "border-orange-200" },
  { name: "Road Accident", icon: Car, color: "bg-yellow-100 text-yellow-600", borderColor: "border-yellow-200" },
  { name: "Kidnapping/Abduction", icon: User, color: "bg-red-100 text-red-600", borderColor: "border-red-200", variant: "destructive" },
  { name: "Communal Conflict", icon: Swords, color: "bg-gray-100 text-gray-600", borderColor: "border-gray-200" },
  { name: "Terrorist Activity", icon: Anchor, color: "bg-red-100 text-red-600", borderColor: "border-red-200", variant: "destructive" },
  { name: "Other Emergency", icon: Tent, color: "bg-green-100 text-green-600", borderColor: "border-green-200" },
];

export default function SOSPage() {
  const [selectedEmergency, setSelectedEmergency] = useState<string>("Other Emergency");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [location, setLocation] = useState<{ latitude: number, longitude: number, address?: string, state?: string, localGovernment?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [ussdCodes, setUssdCodes] = useState<UssdCode[]>([]);
  const [ussdLoading, setUssdLoading] = useState(true);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualState, setManualState] = useState("");
  const [manualLga, setManualLga] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const { toast } = useToast();
  const [user] = useAuthState(auth);

  const getLocation = useCallback(() => {
    setLocationLoading(true);
    if (!navigator.geolocation) {
      toast({ title: "Location Error", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      setLocationLoading(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    };

    console.log(`Requesting location...`);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log("Geolocation success:", latitude, longitude);
        let address = "Address not found";
        let state = "";
        let localGovernment = "";
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          address = data.display_name || "Could not determine address";
          state = data.address?.state || "";
          localGovernment = data.address?.county || data.address?.city_district || data.address?.suburb || "";
        } catch (e) {
          console.error("Reverse geocoding failed", e);
        }
        setLocation({ latitude, longitude, address, state, localGovernment });
        setLocationLoading(false);
      },
      (error) => {
        console.error(`Geolocation error:`, error);

        // No automatic fallback loop here, keep it simple like AnonymousSosDialog
        let errorMessage = "Could not get your location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Ensure your system location services are enabled and you have a clear network connection.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }

        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive"
        });
        setLocationLoading(false);
      },
      options
    );
  }, [toast]);

  useEffect(() => {
    // Automatically attempt to get location on launch as requested
    getLocation();

    const fetchUssd = async () => {
      setUssdLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "ussdCodes"));
        const codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UssdCode);
        setUssdCodes(codes);
      } catch (error: any) {
        console.error("Error fetching USSD codes:", error);
        // Special handling for permission denied which might be due to stale rules or auth state
        if (error.code === 'permission-denied') {
          console.warn("USSD fetch permission denied. This might be resolved by redeploying rules or checking auth.");
        }
        toast({ title: "Note", description: "Emergency USSD codes could not be loaded at this time.", variant: "destructive" });
      }
      setUssdLoading(false);
    }
    fetchUssd();
  }, [getLocation, toast]);

  const handleSendSOS = async () => {
    if (!location && !showManualLocation) {
      toast({
        title: "Location Required",
        description: "Please click 'Detect Location' or enter your location manually before sending the SOS.",
        variant: "destructive"
      });
      // Optionally trigger the detection automatically
      getLocation();
      return;
    }

    if (showManualLocation) {
      if (!manualState || !manualAddress) {
        toast({ title: "Details Required", description: "Please provide at least your State and Address for manual location.", variant: "destructive" });
        return;
      }
      const manualLoc = {
        latitude: 0,
        longitude: 0,
        address: manualAddress,
        state: manualState,
        localGovernment: manualLga
      };
      sendSosWithLocation(manualLoc);
      return;
    }

    sendSosWithLocation(location);
  };

  const sendSosWithLocation = async (loc: any) => {
    setIsSubmitting(true);
    try {
      const result = await sendSos({
        emergencyType: selectedEmergency,
        location: loc,
        additionalInfo: additionalInfo,
        userId: user?.uid,
        userEmail: user?.email ?? 'Anonymous',
        readByAdmin: false,
        readBySuperAdmin: false
      });

      if (result.success) {
        toast({
          title: "SOS Sent Successfully",
          description: "Help is on the way. Your alert has been received by our response team.",
        });
        setSelectedEmergency("Other Emergency");
        setAdditionalInfo("");
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
  };


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Header Section */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-3 sm:mb-4">
            Emergency SOS
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mx-auto">
            Send an immediate emergency alert to CARITAS Nigeria, the Police, and local response teams.
          </p>
        </div>

        {/* SOS Button Section */}
        <Alert className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900 dark:to-orange-900 border-red-200/50 dark:border-red-700/50 backdrop-blur-sm shadow-lg">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-800 dark:text-white font-bold text-lg">Immediate Life-Threatening Emergency?</AlertTitle>
          <AlertDescription className="text-red-700/90 dark:text-red-300/90">
            Click the button below to send an instant SOS with your location. Your information will be sent after you click.
          </AlertDescription>
          <div className="flex justify-center mt-4 sm:mt-6">
            <div
              onClick={!isSubmitting ? handleSendSOS : undefined}
              aria-disabled={isSubmitting}
              role="button"
              aria-label="Send Emergency SOS"
              className={cn(
                "relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 group cursor-pointer",
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-500 rounded-full shadow-2xl transform transition-all duration-300 group-hover:scale-105 group-active:scale-95"></div>
              <div className="absolute inset-2 bg-white rounded-full shadow-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-600 mb-2">SOS</div>
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">EMERGENCY</div>
                </div>
              </div>
              {isSubmitting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm">
                  <Loader2 className="h-12 w-12 sm:h-14 sm:w-14 text-white animate-spin" />
                </div>
              )}
              {locationLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full backdrop-blur-sm">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin mx-auto mb-2" />
                    <div className="text-xs sm:text-sm">Getting Location...</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Alert>

        {/* Emergency Types Grid */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="text-center sm:text-left">
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Type of Emergency
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              Select the emergency type to help response teams prepare appropriate assistance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {emergencyTypes.map((type) => (
                <button
                  key={type.name}
                  onClick={() => setSelectedEmergency(type.name)}
                  className={cn(
                    "p-3 sm:p-4 border-2 rounded-xl flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 hover:shadow-md",
                    selectedEmergency === type.name
                      ? `${type.color} border-opacity-50 shadow-lg scale-105`
                      : "bg-white border-slate-200 hover:border-slate-300",
                    type.variant === "destructive" && selectedEmergency === type.name ? "ring-2 ring-red-300" : ""
                  )}
                >
                  <div className={`p-2 sm:p-3 rounded-lg ${type.color} mb-2 transition-all duration-200 hover:scale-110`}>
                    <type.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-black leading-tight">{type.name}</span>
                  {selectedEmergency === type.name && (
                    <Check className="h-4 w-4 text-green-600 absolute mt-1" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="text-center sm:text-left">
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Additional Information (Optional)
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              Provide any extra details to help responders understand your situation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="E.g., Number of people affected, specific medical needs, landmark for location..."
              className="min-h-[100px] sm:min-h-[120px] resize-none border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl p-4 text-sm sm:text-base"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Location and USSD Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Location Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900 dark:to-cyan-900 border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="flex flex-row items-center gap-3 pb-3">
              <div className="bg-blue-100 p-2 rounded-xl">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-blue-800">Your Location</CardTitle>
                <CardDescription className="text-xs sm:text-base text-blue-600">We need your coordinates to send responders</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {!location && !locationLoading && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Location Access Required</AlertTitle>
                    <AlertDescription className="text-xs">
                      Please allow location access to automatically detect your position.
                      Check your browser address bar or system settings.
                    </AlertDescription>
                  </Alert>
                )}

                {locationLoading ? (
                  <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <span className="text-sm text-blue-700">Getting your location...</span>
                  </div>
                ) : location ? (
                  <>
                    <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-blue-600">Status:</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700">Location Acquired</span>
                      </div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <p className="text-xs sm:text-sm text-blue-700 font-medium leading-relaxed">
                        {location.address || "Location coordinates acquired"}
                      </p>
                      <p className="text-xs text-blue-500 mt-1 font-mono">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-blue-600 hover:text-blue-700 p-0 h-auto font-normal flex items-center gap-1"
                        onClick={() => getLocation()}
                      >
                        <Loader2 className={cn("h-3 w-3", locationLoading && "animate-spin")} />
                        Refresh Location
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-blue-600">Status:</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => getLocation()}>
                          Detect Location
                        </Button>
                      </div>
                    </div>

                    {!showManualLocation ? (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-600 h-auto p-0 flex items-center justify-start gap-1"
                          onClick={() => setShowManualLocation(true)}
                        >
                          <MapPin className="h-3 w-3" />
                          Enter Location Manually
                        </Button>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-orange-600 h-auto p-0 flex items-center justify-start gap-1"
                            >
                              <AlertCircle className="h-3 w-3" />
                              Troubleshoot Geolocation
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Troubleshooting Location Issues</DialogTitle>
                              <DialogDescription>
                                If you are seeing "kCLErrorLocationUnknown" or persistent location errors:
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 text-sm">
                              <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-200">
                                <p className="font-semibold text-slate-800">1. Check System Settings (macOS)</p>
                                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                  <li>Go to <b>System Settings</b> → <b>Privacy & Security</b> → <b>Location Services</b>.</li>
                                  <li>Ensure <b>Location Services</b> is ON.</li>
                                  <li>Ensure <b>Google Chrome</b> is toggled ON.</li>
                                </ul>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-200">
                                <p className="font-semibold text-slate-800">2. Restart Services</p>
                                <p className="text-slate-600">Toggling Wi-Fi off and on can sometimes force a location refresh.</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-200">
                                <p className="font-semibold text-slate-800">3. Use Manual Entry</p>
                                <p className="text-slate-600">If GPS persists in failing, please use the "Enter Location Manually" option to ensure responders can find you.</p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : (
                      <div className="p-4 bg-white/80 rounded-xl space-y-4 border border-blue-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                          <h3 className="text-sm font-bold text-blue-800">Manual Location Details</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-slate-500 hover:text-red-500"
                            onClick={() => setShowManualLocation(false)}
                          >
                            Cancel
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-500">State</label>
                              <Select onValueChange={setManualState} value={manualState}>
                                <SelectTrigger className="h-9 text-xs sm:text-sm">
                                  <SelectValue placeholder="Select State" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {Object.keys(NIGERIA_STATE_BOUNDS).sort().map(state => (
                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-500">LGA (Optional)</label>
                              <Input
                                placeholder="Enter LGA"
                                className="h-9 text-xs sm:text-sm"
                                value={manualLga}
                                onChange={(e) => setManualLga(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Specific Address / Landmarked Area</label>
                            <Textarea
                              placeholder="E.g. No 5, Close to the Primary Health Center..."
                              className="min-h-[60px] text-xs sm:text-sm resize-none"
                              value={manualAddress}
                              onChange={(e) => setManualAddress(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* USSD Card */}
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900 border-yellow-200/50 dark:border-yellow-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="flex flex-row items-center gap-3 pb-3">
              <div className="bg-yellow-100 p-2 rounded-xl">
                <Phone className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-yellow-800">No Internet? Use USSD</CardTitle>
                <CardDescription className="text-xs sm:text-base text-yellow-600">Works on MTN, Airtel, Glo, 9mobile</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {ussdLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 bg-white/60 rounded-lg">
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))
                ) : ussdCodes.length > 0 ? (
                  ussdCodes.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="bg-yellow-100 p-1 rounded-lg">
                          <Phone className="h-4 w-4 text-yellow-600" />
                        </div>
                        <span className="text-sm font-medium text-yellow-800">{item.name}</span>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 font-mono text-xs">
                        {item.code}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-4 bg-white/60 rounded-lg">
                    <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-sm text-yellow-700">USSD codes not available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Emergency Instructions */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 border-green-200/50 dark:border-green-700/50 backdrop-blur-sm shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">What happens next?</h3>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• Your location and emergency details are sent to response teams</li>
                  <li>• Local authorities and CARITAS Nigeria are notified</li>
                  <li>• You should receive confirmation within 30 seconds</li>
                  <li>• Stay on the line if possible for follow-up communication</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
