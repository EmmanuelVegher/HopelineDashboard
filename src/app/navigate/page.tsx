"use client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MapPin, CheckCircle, Info, Loader2, LocateFixed, Navigation, Route, Shield, Clock, Map, ArrowRight, Target, AlertTriangle, Building } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import type { Shelter } from "@/lib/data"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

type UserLocation = {
    latitude: number;
    longitude: number;
    address: string;
    accuracy: number;
}

export default function NavigatePage() {
    const [shelters, setShelters] = useState<Shelter[]>([]);
    const [loadingShelters, setLoadingShelters] = useState(true);
    const [selectedShelterId, setSelectedShelterId] = useState<string>("");
    const [customDestination, setCustomDestination] = useState("");
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchShelters = async () => {
            setLoadingShelters(true);
            try {
                const querySnapshot = await getDocs(collection(db, "shelters"));
                const sheltersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shelter));
                setShelters(sheltersData);
            } catch (error) {
                console.error("Error fetching shelters: ", error);
                toast({ title: "Error", description: "Could not fetch shelter data.", variant: "destructive"});
            }
            setLoadingShelters(false);
        };
        fetchShelters();
    }, [toast]);
    
    const handleGetCurrentLocation = useCallback(() => {
        setLocationLoading(true);
        if (!navigator.geolocation) {
            toast({ title: "Geolocation Not Supported", variant: "destructive" });
            setLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                let address = "Address not found";
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    address = data.display_name || "Could not determine address";
                } catch (e) {
                    console.error("Reverse geocoding failed", e);
                }
                setUserLocation({ latitude, longitude, address, accuracy });
                setLocationLoading(false);
            },
            (error) => {
                toast({ title: "Location Error", description: error.message, variant: "destructive" });
                setLocationLoading(false);
            }
        );
    }, [toast]);

    useEffect(() => {
        handleGetCurrentLocation();
    }, [handleGetCurrentLocation]);

    const handleFindRoutes = () => {
        if (!userLocation) {
            toast({ title: "Location needed", description: "Please get your current location first.", variant: "destructive" });
            return;
        }

        let destinationQuery = "";
        if (selectedShelterId) {
            const shelter = shelters.find(s => s.id === selectedShelterId);
            if (shelter) {
                destinationQuery = `${shelter.latitude},${shelter.longitude}`;
            }
        } else if (customDestination) {
            destinationQuery = encodeURIComponent(customDestination);
        } else {
            toast({ title: "Destination needed", description: "Please select a shelter or enter a custom destination.", variant: "destructive" });
            return;
        }

        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destinationQuery}`;
        window.open(googleMapsUrl, "_blank");
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 dark:from-blue-900 dark:via-cyan-900 dark:to-emerald-900 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
                {/* Header Section */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
                        <Navigation className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3 sm:mb-4">
                        Route Navigation
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mx-auto">
                        Get safe, step-by-step directions to shelters and emergency locations in Bayelsa and Adamawa states
                    </p>
                </div>

                {/* Main Navigation Card */}
                <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-2xl overflow-hidden" data-route-section>
                    <CardHeader className="text-center sm:text-left pb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-blue-100 p-3 rounded-2xl">
                                <Target className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">Choose Your Destination</CardTitle>
                                <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">Select a shelter or enter a custom destination</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Shelter Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-500" />
                                Select Shelter
                            </label>
                            <Select value={selectedShelterId} onValueChange={setSelectedShelterId} disabled={loadingShelters}>
                                <SelectTrigger className="h-12 sm:h-14 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20">
                                    <SelectValue placeholder={loadingShelters ? "Loading shelters..." : "Choose a shelter..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {shelters.map(shelter => (
                                        <SelectItem key={shelter.id} value={shelter.id} className="py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded-lg">
                                                    <Building className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-800">{shelter.name}</div>
                                                    <div className="text-xs text-slate-500">{shelter.location}</div>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="text-slate-500 text-sm font-medium bg-white px-3 py-1 rounded-full">or</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        {/* Custom Destination */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Route className="h-4 w-4 text-green-500" />
                                Custom Destination
                            </label>
                            <Input 
                                placeholder="Enter address or location..." 
                                value={customDestination}
                                onChange={(e) => setCustomDestination(e.target.value)}
                                className="h-12 sm:h-14 border-2 border-slate-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 text-sm sm:text-base"
                            />
                        </div>
                        
                        {/* Find Routes Button */}
                        <Button 
                            className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105" 
                            size="lg" 
                            onClick={handleFindRoutes} 
                            disabled={!userLocation}
                        >
                            <Navigation className="mr-2 h-5 w-5" />
                            Find Routes
                        </Button>
                    </CardContent>
                </Card>

                {/* Location Card */}
                <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-2xl">
                    <CardHeader className="text-center sm:text-left pb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-3 rounded-2xl">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">Your Current Location</CardTitle>
                                <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">Your starting point for navigation</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {locationLoading ? (
                            <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-4 w-64" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        ) : userLocation ? (
                            <div className="space-y-3">
                                <div className="p-4 bg-green-50/50 rounded-lg border border-green-200/50">
                                    <p className="font-semibold text-green-800 mb-1">{userLocation.address}</p>
                                    <p className="text-sm text-green-600">Coordinates: {userLocation.latitude.toFixed(4)}° N, {userLocation.longitude.toFixed(4)}° E</p>
                                    <p className="text-sm text-green-600">Accuracy: ±{userLocation.accuracy.toFixed(0)} meters</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-red-50/50 rounded-lg border border-red-200/50">
                                <p className="text-red-700 font-medium">Could not determine location. Please enable location services.</p>
                            </div>
                        )}
                        <div className="pt-2">
                            <Button 
                                variant="outline" 
                                onClick={handleGetCurrentLocation} 
                                disabled={locationLoading}
                                className="border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105"
                            >
                                {locationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4"/>}
                                {locationLoading ? 'Updating...' : 'Update Location'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Safety Tips */}
                <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900 dark:to-yellow-900 border-orange-200/50 dark:border-orange-700/50 backdrop-blur-sm shadow-lg" data-safety-tips>
                    <CardHeader className="text-center sm:text-left">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                            Safety Tips for Navigation
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white/60 p-4 rounded-lg border border-orange-200/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-orange-100 p-2 rounded-lg">
                                        <Map className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <span className="font-medium text-orange-800">Safe Routes</span>
                                </div>
                                <p className="text-sm text-orange-700">Stay on well-lit, populated roads when possible</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-lg border border-orange-200/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-orange-100 p-2 rounded-lg">
                                        <Clock className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <span className="font-medium text-orange-800">Stay Connected</span>
                                </div>
                                <p className="text-sm text-orange-700">Keep your phone charged and accessible</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-lg border border-orange-200/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-orange-100 p-2 rounded-lg">
                                        <Shield className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <span className="font-medium text-orange-800">Share Location</span>
                                </div>
                                <p className="text-sm text-orange-700">Share your route with emergency contacts</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-lg border border-orange-200/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-orange-100 p-2 rounded-lg">
                                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <span className="font-medium text-orange-800">Emergency Ready</span>
                                </div>
                                <p className="text-sm text-orange-700">If you feel unsafe, use the emergency SOS feature immediately</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-2xl">
                    <CardContent className="p-6">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-4 text-center">Quick Actions</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Button
                                variant="outline"
                                className="h-12 border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105"
                                onClick={() => {
                                    if (userLocation) {
                                        const googleMapsUrl = `https://www.google.com/maps/@${userLocation.latitude},${userLocation.longitude},15z`;
                                        window.open(googleMapsUrl, "_blank");
                                    } else {
                                        toast({ title: "Location needed", description: "Please get your current location first.", variant: "destructive" });
                                    }
                                }}
                            >
                                <Map className="mr-2 h-4 w-4" />
                                View Map
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 border-2 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 transition-all duration-200 hover:scale-105"
                                onClick={() => {
                                    // Scroll to the route finding section
                                    document.querySelector('[data-route-section]')?.scrollIntoView({ behavior: 'smooth' });
                                    toast({ title: "Safe Routes", description: "Use the route finder above to get safe directions to shelters." });
                                }}
                            >
                                <Route className="mr-2 h-4 w-4" />
                                Safe Routes
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 border-2 border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 hover:scale-105"
                                onClick={() => {
                                    // Scroll to the safety tips section
                                    document.querySelector('[data-safety-tips]')?.scrollIntoView({ behavior: 'smooth' });
                                    toast({ title: "Help & Tips", description: "Check the safety tips below for navigation guidance." });
                                }}
                            >
                                <Info className="mr-2 h-4 w-4" />
                                Help & Tips
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
