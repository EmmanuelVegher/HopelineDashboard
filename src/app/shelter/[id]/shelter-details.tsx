"use client"
import { type Shelter } from "@/lib/data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Building, MapPin, Users, ShieldCheck, Phone, MessageSquare, Map as MapIcon, CheckCircle, Star, Wifi, Car, Utensils, Droplets, Zap, Heart, Clock, Navigation } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { doc, getDoc, updateDoc, increment, runTransaction } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function ShelterDetailsClient({ shelterId }: { shelterId: string }) {
    const [shelter, setShelter] = useState<Shelter | null>(null);
    const [loading, setLoading] = useState(true);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    useEffect(() => {
        const fetchShelter = async () => {
            if (!shelterId) return;
            setLoading(true);
            try {
                const docRef = doc(db, "shelters", shelterId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setShelter({ id: docSnap.id, ...docSnap.data() } as Shelter);
                } else {
                    console.log("No such document!");
                }
            } catch (error) {
                console.error("Error fetching shelter:", error);
            }
            setLoading(false);
        };

        fetchShelter();
    }, [shelterId]);

    const handleRatingSubmit = async () => {
        if (rating === 0) {
            toast({ title: "Please select a rating", variant: "destructive" });
            return;
        }
        if (!shelterId) return;
        setIsSubmitting(true);

        try {
            const docRef = doc(db, "shelters", shelterId);

            // Use a transaction to safely update the rating
            await runTransaction(db, async (transaction) => {
                const shelterDoc = await transaction.get(docRef);
                if (!shelterDoc.exists()) {
                    throw "Document does not exist!";
                }

                const data = shelterDoc.data();
                const currentTotalRating = (data.rating || 0) * (data.ratingCount || 0);
                const newRatingCount = (data.ratingCount || 0) + 1;
                const newAverageRating = (currentTotalRating + rating) / newRatingCount;

                transaction.update(docRef, {
                    rating: newAverageRating,
                    ratingCount: increment(1)
                });

                // Update client state after successful transaction
                setShelter(prev => prev ? ({ ...prev, rating: newAverageRating, ratingCount: newRatingCount }) : null);
            });

            // Reset rating after successful submission
            setRating(0);
            setHoverRating(0);

            toast({ title: "Thank you!", description: "Your rating has been submitted." });

        } catch (error) {
            console.error("Error submitting rating: ", error);
            toast({ title: "Error", description: "Could not submit your rating. Check permissions.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGetDirections = () => {
        if (!shelter) return;

        // Try to open in Google Maps or fallback to generic maps
        const address = encodeURIComponent(shelter.location);
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;

        // Check if user is on mobile and try to open native maps app
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            // Try to open native maps app first
            const nativeUrl = `maps:///?q=${address}`;
            window.location.href = nativeUrl;

            // Fallback to Google Maps after a short delay
            setTimeout(() => {
                window.open(googleMapsUrl, '_blank');
            }, 1000);
        } else {
            // Desktop: Open Google Maps in new tab
            window.open(googleMapsUrl, '_blank');
        }

        toast({ title: "Opening Maps", description: "Directions to shelter are opening..." });
    };


    if (loading) {
        return (
             <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
                        <CardHeader className="pb-6">
                            <Skeleton className="h-10 w-3/4 mb-3" />
                            <Skeleton className="h-6 w-1/2" />
                        </CardHeader>
                        <CardContent className="grid lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                            <Skeleton className="aspect-video w-full rounded-lg" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    if (!shelter) {
        return <div>Shelter not found</div>
    }

    const currentOccupancy = shelter.capacity - shelter.availableCapacity;
    const occupancyPercentage = shelter.capacity > 0 ? Math.round((currentOccupancy / shelter.capacity) * 100) : 0;

    const facilityIcons: Record<string, any> = {
        'WiFi': Wifi,
        'Transport': Car,
        'Food': Utensils,
        'Water': Droplets,
        'Electricity': Zap,
        'Medical': Heart,
        'Security': ShieldCheck,
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
                {/* Header Card */}
                <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl overflow-hidden">
                    <CardHeader className="pb-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 mb-2">
                                    <div className="bg-blue-100 p-3 rounded-2xl">
                                        <Building className="h-8 w-8 text-blue-600" />
                                    </div>
                                    {shelter.name}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 text-base sm:text-lg text-slate-600">
                                    <MapPin className="h-5 w-5 text-blue-500" />
                                    {shelter.location}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1">
                                    {shelter.status}
                                </Badge>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Star className="h-4 w-4 text-yellow-500" />
                                    <span className="font-medium">{shelter.rating?.toFixed(1) ?? 'N/A'}</span>
                                    <span className="text-slate-400">({shelter.ratingCount || 0} reviews)</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="grid lg:grid-cols-2 gap-8 lg:gap-12">
                        {/* Left Column - Details */}
                        <div className="space-y-6 sm:space-y-8">
                            {/* Capacity Section */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/50">
                                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                                    <Users className="h-5 w-5 text-blue-600" />
                                    Capacity Information
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Current Occupancy</span>
                                        <span className="font-semibold text-slate-800">{currentOccupancy} / {shelter.capacity}</span>
                                    </div>
                                    <Progress value={occupancyPercentage} className="h-3" />
                                    <div className="flex justify-between text-sm">
                                        <span className="text-green-600 font-medium">{shelter.availableCapacity} spots available</span>
                                        <span className="text-slate-500">{occupancyPercentage}% occupied</span>
                                    </div>
                                </div>
                            </div>

                            {/* Facilities Section */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/50">
                                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                    Available Facilities
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {shelter.facilities && shelter.facilities.map(facility => {
                                        const IconComponent = facilityIcons[facility] || CheckCircle;
                                        return (
                                            <div key={facility} className="flex items-center gap-2 bg-white/60 p-3 rounded-lg border border-slate-200/50">
                                                <IconComponent className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium text-slate-700">{facility}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Security Section */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/50">
                                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                                    Security Information
                                </h3>
                                <p className="text-slate-600 leading-relaxed">{shelter.security || 'Security details not available'}</p>
                            </div>

                            {/* Rating Section */}
                            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-2xl border border-yellow-200/50">
                                <h3 className="font-bold text-lg text-yellow-800 mb-4 flex items-center gap-2">
                                    <Star className="h-5 w-5 text-yellow-600" />
                                    Rate this Shelter
                                </h3>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="flex" onMouseLeave={() => setHoverRating(0)}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className={cn(
                                                    "h-8 w-8 cursor-pointer transition-all duration-200 hover:scale-110",
                                                    (hoverRating >= star || rating >= star)
                                                        ? "text-yellow-400 fill-yellow-400"
                                                        : "text-slate-300 hover:text-yellow-300"
                                                )}
                                                onMouseEnter={() => setHoverRating(star)}
                                                onClick={() => setRating(star)}
                                            />
                                        ))}
                                    </div>
                                    <Button 
                                        onClick={handleRatingSubmit} 
                                        size="sm" 
                                        disabled={rating === 0 || isSubmitting}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit Rating"}
                                    </Button>
                                </div>
                                <p className="text-sm text-yellow-700">Your feedback helps improve our services. Current rating: {shelter.rating?.toFixed(1) ?? 'N/A'} ({shelter.ratingCount || 0} reviews)</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/50">
                                <h3 className="font-bold text-lg text-slate-800 mb-4">Get Help</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button asChild className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                                        <Link to="/assistance">
                                            <MessageSquare className="mr-2 h-4 w-4"/>
                                            Chat with Support
                                        </Link>
                                    </Button>
                                    <Button variant="outline" asChild className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105">
                                        <a href={`tel:${shelter.phone}`}>
                                            <Phone className="mr-2 h-4 w-4"/>
                                            Call Support
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Map */}
                        <div className="space-y-4">
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/50">
                                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                                    <Navigation className="h-5 w-5 text-blue-600" />
                                    Route to Shelter
                                </h3>
                                <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                    {shelter.imageUrl ? (
                                        <img
                                            src={shelter.imageUrl}
                                            alt={`Map to ${shelter.name}`}
                                            className="object-cover h-full w-full"
                                        />
                                    ) : (
                                         <img
                                            src="https://placehold.co/800x450/e2e8f0/64748b?text=Map+View"
                                            alt={`Route to ${shelter.name}`}
                                            className="object-cover h-full w-full"
                                        />
                                    )}
                                </div>
                                <Button
                                    onClick={handleGetDirections}
                                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                                >
                                    <Navigation className="mr-2 h-4 w-4"/>
                                    Get Directions
                                </Button>
                            </div>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/60 p-4 rounded-lg border border-slate-200/50 text-center">
                                    <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-600">24/7</p>
                                    <p className="font-semibold text-slate-800">Available</p>
                                </div>
                                <div className="bg-white/60 p-4 rounded-lg border border-slate-200/50 text-center">
                                    <Heart className="h-6 w-6 text-red-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-600">Safe</p>
                                    <p className="font-semibold text-slate-800">Environment</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Emergency Contact Card */}
                <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200/50 backdrop-blur-sm shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-2xl">
                                <Phone className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-red-800 mb-1">Emergency Contact</h3>
                                <p className="text-red-700 text-sm">For urgent situations, call the shelter directly</p>
                            </div>
                            <Button variant="destructive" asChild className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                                <a href={`tel:${shelter.phone}`}>
                                    <Phone className="mr-2 h-4 w-4"/>
                                    Call Now
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
