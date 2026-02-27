
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { type Shelter } from "@/lib/data";
import { Filter, LocateFixed, MapPin, Search, Send, Star, Zap, Loader2, Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";


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
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { t } = useTranslation();

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
                    title: t('findShelter.geolocationError'),
                    description: t('findShelter.fetchError'),
                    variant: "destructive"
                });
            }
            setLoading(false);
        };
        fetchShelters();
    }, [toast]);

    // Auto-request location on mount
    useEffect(() => {
        handleGetCurrentLocation();
    }, []);

    useEffect(() => {
        let shelters = [...allShelters];

        // Update distances if user location is available
        if (userLocation) {
            shelters = shelters.map(shelter => {
                let destLat = shelter.latitude;
                let destLon = shelter.longitude;

                // Fallback to first geofence point if primary coordinates are 0
                if ((!destLat || !destLon || destLat === 0 || destLon === 0) && shelter.geofence && shelter.geofence.length > 0) {
                    destLat = shelter.geofence[0].lat;
                    destLon = shelter.geofence[0].lng;
                }

                if (destLat && destLon && destLat !== 0 && destLon !== 0) {
                    return {
                        ...shelter,
                        distance: calculateDistance(userLocation.lat, userLocation.lon, destLat, destLon).toFixed(1) + ' km'
                    };
                }

                return {
                    ...shelter,
                    distance: t('findShelter.notAvailable')
                };
            });
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
                title: t('findShelter.geolocationNotSupported'),
                description: t('findShelter.geolocationNotSupportedDesc'),
                variant: "destructive"
            });
            setLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&email=support@hopeline.ng`);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data && data.address) {
                        const newUserLocation = {
                            city: data.address.city || data.address.town || data.address.village || t('findShelter.unknownCity'),
                            state: data.address.state || t('findShelter.unknownState'),
                            country: data.address.country || t('findShelter.unknownCountry'),
                            lat: latitude,
                            lon: longitude,
                        };
                        setUserLocation(newUserLocation);
                    } else {
                        // Fallback to coordinates only if address data is missing
                        setUserLocation({
                            city: t('findShelter.unknownCity'),
                            state: t('findShelter.unknownState'),
                            country: t('findShelter.unknownCountry'),
                            lat: latitude,
                            lon: longitude,
                        });
                    }
                } catch (error) {
                    console.error("Reverse geocoding error (likely CORS or Rate Limit):", error);
                    // Graceful fallback: set coordinates even if reverse lookup fails
                    setUserLocation({
                        city: t('findShelter.unknownCity'),
                        state: t('findShelter.unknownState'),
                        country: t('findShelter.unknownCountry'),
                        lat: latitude,
                        lon: longitude,
                    });

                    // Show a less intrusive toast if it's just a lookup failure
                    toast({
                        title: t('findShelter.geolocationError'),
                        description: t('findShelter.addressDataError'),
                        variant: "default"
                    });
                } finally {
                    setLocationLoading(false);
                }
            },
            (error) => {
                let description = error.message || t('findShelter.geolocationErrorDesc');

                // Specific advice for macOS / Position Unavailable
                if (error.code === error.POSITION_UNAVAILABLE) {
                    description = "Location unavailable. Please ensure your device's Location Services are ON (System Settings > Privacy) and Wi-Fi is enabled for better accuracy. On macOS, Wi-Fi is required for location triangulation.";
                } else if (error.code === error.TIMEOUT) {
                    description = "Location request timed out. Please check your signal and try again.";
                } else if (error.code === error.PERMISSION_DENIED) {
                    description = "Location permission was denied. Please allow access in your browser settings to find nearby shelters.";
                }

                toast({
                    title: t('findShelter.geolocationError'),
                    description: description,
                    variant: "destructive"
                });
                setLocationLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const handleGetDirections = (shelter: Shelter) => {
        if (!userLocation) {
            toast({
                title: t('findShelter.locationNeeded'),
                description: t('findShelter.locationNeededDesc'),
                variant: "destructive",
            });
            return;
        }

        const origin = `${userLocation.lat},${userLocation.lon}`;
        let destCoords = `${shelter.latitude},${shelter.longitude}`;

        // Geofence fallback logic
        if ((!shelter.latitude || !shelter.longitude || shelter.latitude === 0 || shelter.longitude === 0) && shelter.geofence && shelter.geofence.length > 0) {
            const firstPoint = shelter.geofence[0];
            destCoords = `${firstPoint.lat},${firstPoint.lng}`;
        } else if (!shelter.latitude || !shelter.longitude || (shelter.latitude === 0 && shelter.longitude === 0)) {
            // Last fallback: name or address
            destCoords = encodeURIComponent(shelter.location || shelter.name);
        }

        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destCoords}`;
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
                <h1 className="text-3xl font-bold">{t('findShelter.title')}</h1>
                <p className="text-muted-foreground mt-2">
                    {t('findShelter.subtitle')}
                </p>
            </div>

            <Card className="p-4 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder={t('findShelter.searchPlaceholder')}
                            className="pl-10 h-11"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                        <SelectTrigger className="h-11 w-full md:w-[200px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder={t('findShelter.filterByState')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('findShelter.allStates')}</SelectItem>
                            {availableStates.map(state => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button className="h-11 bg-black dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700" onClick={handleGetCurrentLocation} disabled={locationLoading}>
                        {locationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                        {locationLoading ? t('findShelter.gettingLocation') : t('findShelter.useCurrentLocation')}
                    </Button>
                </div>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-100 dark:border-blue-700 rounded-lg flex items-center gap-4">
                    <MapPin className="h-6 w-6 text-blue-600" />
                    <div>
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold">{t('findShelter.yourLocation')}</p>
                        {userLocation ? (
                            <>
                                <p className="text-xs text-blue-700 dark:text-blue-300">{userLocation.city}, {userLocation.state}, {userLocation.country}</p>
                                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">{t('findShelter.coordinates')}: {userLocation.lat.toFixed(4)}° N, {userLocation.lon.toFixed(4)}° E</p>
                            </>
                        ) : (
                            <p className="text-xs text-blue-700 dark:text-blue-300">{t('findShelter.clickToFind')}</p>
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
                                        <div className="aspect-video w-full relative group overflow-hidden">
                                            <img
                                                src={shelter.imageUrl}
                                                alt={shelter.name}
                                                className="object-cover rounded-t-lg w-full h-full cursor-zoom-in transition-transform duration-500 group-hover:scale-110"
                                                crossOrigin="anonymous"
                                                onClick={() => setSelectedImage(shelter.imageUrl!)}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none flex items-center justify-center">
                                                <Zap className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-8 w-8 drop-shadow-lg" />
                                            </div>
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
                                                <span>{shelter.distance || t('findShelter.notAvailable')}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Zap className="h-4 w-4" />
                                                    <span>{t('findShelter.capacity')}</span>
                                                </div>
                                                <p className="text-sm font-bold text-green-600 dark:text-green-400">{shelter.availableCapacity} {t('findShelter.spacesAvailable')}</p>
                                            </div>
                                            <Progress value={capacityPercentage} colorClassName={getCapacityProgressColor(capacityPercentage)} />
                                            <p className="text-xs text-muted-foreground mt-1">{currentOccupancy}/{shelter.capacity} {t('findShelter.occupied')} ({capacityPercentage}%)</p>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm my-4">
                                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                            <span><span className="font-bold">{shelter.rating ? shelter.rating.toFixed(1) : t('findShelter.notAvailable')}</span> {t('findShelter.averageRating')}</span>
                                        </div>

                                        <div className="border-t pt-4">
                                            <h3 className="text-sm font-semibold mb-2">{t('findShelter.availableServices')}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {(shelter.facilities || []).slice(0, 4).map(facility => (
                                                    <Badge key={facility} variant="secondary" className="font-normal">{facility}</Badge>
                                                ))}
                                                {shelter.facilities && shelter.facilities.length > 4 && (
                                                    <Badge variant="secondary" className="font-normal">+{shelter.facilities.length - 4} {t('findShelter.more')}</Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-4 mt-6">
                                            <Button className="w-full bg-black dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700" onClick={() => handleGetDirections(shelter)}>
                                                <Send className="mr-2 h-4 w-4" />
                                                {t('findShelter.getDirections')}
                                            </Button>
                                            <Button asChild variant="outline" className="w-full">
                                                <Link to={`/shelter/${shelter.id}`}>
                                                    <Info className="mr-2 h-4 w-4" />
                                                    {t('findShelter.viewDetails')}
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
                        <h3 className="text-lg font-semibold">{t('findShelter.noSheltersFound')}</h3>
                        <p className="text-muted-foreground mt-2">{t('findShelter.adjustSearch')}</p>
                    </div>
                )}
            </div>

            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-transparent border-none shadow-none outline-none">
                    <DialogTitle className="sr-only">Shelter Image Full View</DialogTitle>
                    {selectedImage && (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <img
                                src={selectedImage}
                                alt="Shelter Full View"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                                crossOrigin="anonymous"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

