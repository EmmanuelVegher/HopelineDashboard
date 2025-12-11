
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { type Shelter } from "@/lib/data";
import { Clock, Filter, LocateFixed, MapPin, Phone, Search, Send, Star, Zap, Loader2, Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type UserLocation = {
    city: string;
    state: string;
    country: string;
    lat: number;
    lon: number;
}

// Haversine formula to calculate distance between two points on Earth
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

export default function FindShelterPage() {
    const [allShelters, setAllShelters] = useState<Shelter[]>([]);
    const [filteredShelters, setFilteredShelters] = useState<Shelter[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [selectedState, setSelectedState] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();

    const availableStates = useMemo(() => {
        const states = allShelters.map(s => s.location.split(',')[1]?.trim()).filter(Boolean);
        return [...new Set(states)];
    }, [allShelters]);

    useEffect(() => {
        const fetchShelters = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "shelters"));
                const sheltersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shelter));
                setAllShelters(sheltersData);
            } catch (error) {
                console.error("Error fetching shelters: ", error);
                 toast({
                    title: "Error",
                    description: "Could not fetch shelter data.",
                    variant: "destructive"
                });
            }
            setLoading(false);
        };
        fetchShelters();
    }, [toast]);

     useEffect(() => {
        let shelters = [...allShelters];

        // Update distances if user location is available
        if (userLocation) {
            shelters = shelters.map(shelter => ({
                ...shelter,
                distance: calculateDistance(userLocation.lat, userLocation.lon, shelter.latitude, shelter.longitude).toFixed(1) + ' km'
            }));
        }

        // Filter by state
        if (selectedState !== "all") {
            shelters = shelters.filter(shelter => shelter.location.includes(selectedState));
        }

        // Filter by search term
        if (searchTerm) {
            shelters = shelters.filter(shelter =>
                shelter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                shelter.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
                shelter.location.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // Sort by distance if location is available
        if (userLocation) {
            shelters.sort((a, b) => {
                const distanceA = parseFloat(a.distance?.replace(' km', '') || '9999');
                const distanceB = parseFloat(b.distance?.replace(' km', '') || '9999');
                return distanceA - distanceB;
            });
        }

        setFilteredShelters(shelters);
    }, [selectedState, searchTerm, allShelters, userLocation]);


    const handleGetCurrentLocation = () => {
        setLocationLoading(true);
        if (!navigator.geolocation) {
            toast({
                title: "Geolocation Not Supported",
                description: "Your browser does not support geolocation.",
                variant: "destructive"
            });
            setLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    
                    if (data && data.address) {
                        const newUserLocation = {
                            city: data.address.city || data.address.town || data.address.village || "Unknown City",
                            state: data.address.state || "Unknown State",
                            country: data.address.country || "Unknown Country",
                            lat: latitude,
                            lon: longitude,
                        };
                        setUserLocation(newUserLocation);

                    } else {
                         toast({ title: "Error", description: "Could not determine your address.", variant: "destructive"});
                    }
                } catch (error) {
                    console.error("Reverse geocoding error:", error);
                    toast({ title: "Error", description: "Could not fetch address data.", variant: "destructive"});
                } finally {
                    setLocationLoading(false);
                }
            },
            (error) => {
                toast({
                    title: "Geolocation Error",
                    description: error.message || "Could not get your location. Please ensure location services are enabled.",
                    variant: "destructive"
                });
                setLocationLoading(false);
            }
        );
    };

    const handleGetDirections = (shelter: Shelter) => {
        if (!userLocation) {
            toast({
                title: "Location Needed",
                description: "Please click 'Use Current Location' first to get directions.",
                variant: "destructive",
            });
            return;
        }

        const origin = `${userLocation.lat},${userLocation.lon}`;
        const destination = `${shelter.latitude},${shelter.longitude}`;
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

        window.open(googleMapsUrl, "_blank");
    }

    const getSecurityBadgeVariant = (securityLevel?: string) => {
        switch (securityLevel) {
            case 'High Security': return 'success';
            case 'Medium Security': return 'warning';
            default: return 'destructive';
        }
    };

    const getCapacityProgressColor = (percentage: number) => {
        if (percentage > 85) return "bg-red-500";
        if (percentage > 60) return "bg-yellow-500";
        return "bg-green-500";
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Find IDP Camps & Emergency Shelters</h1>
                <p className="text-muted-foreground mt-2">
                    Locate official IDP camps and shelters in Bayelsa and Adamawa with available space and services.
                </p>
            </div>
            
            <Card className="p-4 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search by camp name, organization, or state..."
                            className="pl-10 h-11"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                        <SelectTrigger className="h-11 w-full md:w-[200px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Filter by State" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All States</SelectItem>
                            {availableStates.map(state => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button className="h-11 bg-black dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700" onClick={handleGetCurrentLocation} disabled={locationLoading}>
                        {locationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4" />}
                        {locationLoading ? 'Getting Location...' : 'Use Current Location'}
                    </Button>
                </div>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-100 dark:border-blue-700 rounded-lg flex items-center gap-4">
                    <MapPin className="h-6 w-6 text-blue-600" />
                    <div>
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold">Your Current Location</p>
                          {userLocation ? (
                             <>
                                 <p className="text-xs text-blue-700 dark:text-blue-300">{userLocation.city}, {userLocation.state}, {userLocation.country}</p>
                                 <p className="text-xs text-blue-700/80 dark:text-blue-300/80">Coordinates: {userLocation.lat.toFixed(4)}° N, {userLocation.lon.toFixed(4)}° E</p>
                             </>
                         ) : (
                             <p className="text-xs text-blue-700 dark:text-blue-300">Click the button above to find your location.</p>
                         )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="shadow-md">
                            <CardContent className="p-6 space-y-4">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-4 w-1/3" />
                                <div className="flex gap-4 mt-6">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : filteredShelters.length > 0 ? (
                    filteredShelters.map(shelter => {
                        const currentOccupancy = shelter.capacity - shelter.availableCapacity;
                        const capacityPercentage = shelter.capacity > 0 ? Math.round((currentOccupancy / shelter.capacity) * 100) : 0;

                        return (
                            <Card key={shelter.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                                <CardContent className="p-0">
                                    {shelter.imageUrl && (
                                        <div className="aspect-video w-full relative">
                                            <img src={shelter.imageUrl} alt={shelter.name} className="object-cover rounded-t-lg w-full h-full" />
                                        </div>
                                    )}
                                    <div className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{shelter.name}</h2>
                                                <p className="text-sm text-muted-foreground">{shelter.organization} - {shelter.location}</p>
                                            </div>
                                            {shelter.securityLevel && (
                                                <Badge variant={getSecurityBadgeVariant(shelter.securityLevel)}>{shelter.securityLevel}</Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-6 text-sm text-muted-foreground my-4">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4" />
                                                <span>{shelter.distance || 'N/A'}</span>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Zap className="h-4 w-4"/>
                                                    <span>Capacity</span>
                                                </div>
                                                <p className="text-sm font-bold text-green-600 dark:text-green-400">{shelter.availableCapacity} spaces available</p>
                                            </div>
                                            <Progress value={capacityPercentage} colorClassName={getCapacityProgressColor(capacityPercentage)} />
                                            <p className="text-xs text-muted-foreground mt-1">{currentOccupancy}/{shelter.capacity} occupied ({capacityPercentage}%)</p>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm my-4">
                                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                            <span><span className="font-bold">{shelter.rating ? shelter.rating.toFixed(1) : 'N/A'}</span> average rating</span>
                                        </div>

                                        <div className="border-t pt-4">
                                            <h3 className="text-sm font-semibold mb-2">Available Services</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {(shelter.facilities || []).slice(0, 4).map(facility => (
                                                    <Badge key={facility} variant="secondary" className="font-normal">{facility}</Badge>
                                                ))}
                                                {shelter.facilities && shelter.facilities.length > 4 && (
                                                    <Badge variant="secondary" className="font-normal">+{shelter.facilities.length - 4} more</Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-4 mt-6">
                                            <Button className="w-full bg-black dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700" onClick={() => handleGetDirections(shelter)}>
                                                <Send className="mr-2 h-4 w-4" />
                                                Get Directions
                                            </Button>
                                             <Button asChild variant="outline" className="w-full">
                                                <Link to={`/shelter/${shelter.id}`}>
                                                    <Info className="mr-2 h-4 w-4"/>
                                                    View Details
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="col-span-1 md:col-span-2 text-center py-16">
                        <h3 className="text-lg font-semibold">No Shelters Found</h3>
                        <p className="text-muted-foreground mt-2">Try adjusting your search or filter criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
