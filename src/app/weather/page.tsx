"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, MapPin, Calendar, Droplets, Eye, Sun, Thermometer, Wind, Clock, CloudDrizzle, Cloud, Cloudy, CloudLightning, CloudRain, CloudSnow, CloudFog, Loader2, Info, RefreshCw, Briefcase, CheckCircle, AlertCircle, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWeather, type GetWeatherOutput } from "@/ai/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const iconMap = {
    Sun,
    Cloud,
    Cloudy,
    CloudDrizzle,
    CloudRain,
    CloudLightning,
    CloudSnow,
    CloudFog
};

const getAlertCardClass = (severity: 'Severe' | 'Moderate' | 'Minor') => {
    switch(severity) {
        case 'Severe': return 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200/50';
        case 'Moderate': return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200/50';
        case 'Minor': return 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200/50';
        default: return 'bg-white';
    }
}

const getAlertIcon = (severity: 'Severe' | 'Moderate' | 'Minor') => {
    switch(severity) {
        case 'Severe': return <AlertTriangle className="h-5 w-5 text-red-600" />;
        case 'Moderate': return <CloudDrizzle className="h-5 w-5 text-yellow-600" />;
        default: return <Cloud className="h-5 w-5 text-blue-600"/>
    }
}

const renderCurrentConditions = (loading: boolean, weatherData: GetWeatherOutput | null) => {
    if (loading) {
        return Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center">
                    <Skeleton className="h-8 w-8 mb-3 rounded-full" />
                    <Skeleton className="h-7 w-16 mb-1" />
                    <Skeleton className="h-4 w-20" />
                </CardContent>
            </Card>
        ));
    }
    if (!weatherData) return null;

    const { humidity, windSpeed, visibility, uvIndex } = weatherData.currentConditions;
    const weatherStats = [
        { value: humidity, label: "Humidity", icon: Droplets, color: "text-cyan-600", bgColor: "bg-cyan-100", unit: "%" },
        { value: windSpeed, label: "Wind Speed", icon: Wind, color: "text-green-600", bgColor: "bg-green-100", unit: "km/h" },
        { value: visibility, label: "Visibility", icon: Eye, color: "text-purple-600", bgColor: "bg-purple-100", unit: "km" },
        { value: uvIndex, label: "UV Index", icon: Sun, color: "text-orange-600", bgColor: "bg-orange-100", unit: "" },
    ];
    
    return weatherStats.map((stat) => (
        <Card key={stat.label} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center">
                <div className={`${stat.bgColor} p-3 rounded-2xl mb-3 transition-all duration-300 hover:scale-110`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-200 mb-1">{stat.value}{stat.unit}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{stat.label}</p>
            </CardContent>
        </Card>
    ));
};

const renderForecast = (loading: boolean, weatherData: GetWeatherOutput | null) => {
     if (loading) {
        return (
             <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Card key={i} className="p-4 flex flex-col items-center gap-3 bg-slate-50/50">
                            <Skeleton className="h-5 w-12" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-6 w-10" />
                            <Skeleton className="h-4 w-16" />
                        </Card>
                    ))}
                </CardContent>
            </Card>
        )
    }
    if (!weatherData) return null;

    return (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
             <CardHeader className="text-center sm:text-left">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    5-Day Forecast
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {weatherData.forecast.map((day) => {
                    const Icon = iconMap[day.icon] || Cloud;
                    return (
                         <Card key={day.day} className="p-4 flex flex-col items-center gap-3 bg-slate-50/50 hover:bg-slate-100/50 transition-all duration-200 hover:scale-105">
                            <p className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200">{day.day}</p>
                            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-2xl">
                                <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400"/>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200">{day.temp}</p>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 capitalize text-center leading-tight">{day.description}</p>
                        </Card>
                    )
                })}
            </CardContent>
        </Card>
    )
};


export default function WeatherPage() {
    const [weatherData, setWeatherData] = useState<GetWeatherOutput | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationName, setLocationName] = useState("your location");
    const [currentCoords, setCurrentCoords] = useState<{latitude: number, longitude: number} | null>(null);
    const { toast } = useToast();

    const fetchWeather = useCallback(async (latitude: number, longitude: number) => {
        setLoading(true);
        try {
            const data = await getWeather({ latitude, longitude });
            setWeatherData(data);
        } catch (error) {
            console.error("Failed to fetch weather data:", error);
            toast({
                title: "Error",
                description: "Could not fetch weather data. Please ensure your API key is correct and has access to the OneCall API.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchLocationAndWeather = useCallback(() => {
        setLoading(true);
        if (!navigator.geolocation) {
            toast({
                title: "Geolocation Not Supported",
                description: "Please enable location services in your browser.",
                variant: "destructive"
            });
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setCurrentCoords({ latitude, longitude });
                fetchWeather(latitude, longitude);
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    const city = data.address.city || data.address.town || data.address.village || "Unknown City";
                    const state = data.address.state || "Unknown State";
                    setLocationName(`${city}, ${state}`);
                } catch (error) {
                    console.error("Reverse geocoding error:", error);
                    setLocationName("your current location");
                }
            },
            (error) => {
                toast({
                    title: "Geolocation Error",
                    description: "Could not get your location. Please ensure location services are enabled.",
                    variant: "destructive"
                });
                setLoading(false);
            }
        );
    }, [toast, fetchWeather]);

    useEffect(() => {
        fetchLocationAndWeather();
    }, [fetchLocationAndWeather]);

    const handleRefresh = () => {
        if (currentCoords) {
            fetchWeather(currentCoords.latitude, currentCoords.longitude);
        } else {
            fetchLocationAndWeather();
        }
    };

    const MainIcon = weatherData && weatherData.forecast.length > 0 ? iconMap[weatherData.forecast[0].icon] : Loader2;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 dark:from-blue-900 dark:via-cyan-900 dark:to-emerald-900 p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                            Weather Alerts & Forecast
                        </h1>
                        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg mt-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            Conditions for {locationName}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {weatherData && !loading && (
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-white/60 px-3 py-2 rounded-lg">
                                <Clock className="h-4 w-4" />
                                <span>Last updated: {weatherData.lastUpdated}</span>
                            </div>
                        )}
                        <Button 
                            onClick={handleRefresh} 
                            disabled={loading} 
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Main Weather Card */}
                <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-2xl overflow-hidden">
                    <CardContent className="p-6 sm:p-8 lg:p-12">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
                            {loading ? (
                                 <div className="flex flex-col items-center text-center lg:items-start lg:text-left flex-1">
                                    <Skeleton className="h-6 w-40 mb-4" />
                                    <Skeleton className="h-20 w-32 mb-4" />
                                    <Skeleton className="h-8 w-full max-w-md" />
                                </div>
                            ) : weatherData ? (
                                <div className="flex flex-col items-center text-center lg:items-start lg:text-left flex-1">
                                    <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg capitalize mb-2">{weatherData.currentConditions.description}</p>
                                    <p className="text-6xl sm:text-7xl lg:text-8xl font-bold text-slate-800 dark:text-slate-200 mb-4">{weatherData.currentConditions.temperature}</p>
                                    <p className="text-base sm:text-lg lg:text-xl font-semibold text-blue-600 dark:text-blue-400 leading-relaxed">{weatherData.narrativeSummary}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center lg:items-start lg:text-left flex-1">
                                    <p className="text-slate-500 text-lg">Could not load weather data.</p>
                                </div>
                            )}
                            {loading ? (
                                <Skeleton className="h-24 w-24 sm:h-32 sm:w-32 rounded-full" />
                            ) : weatherData ? (
                                <div className="bg-blue-100 p-6 sm:p-8 rounded-full shadow-lg">
                                    <MainIcon className="h-24 w-24 sm:h-32 sm:w-32 text-blue-600" />
                                </div>
                            ) : (
                                <div className="bg-slate-100 p-6 sm:p-8 rounded-full">
                                    <Cloud className="h-24 w-24 sm:h-32 sm:w-32 text-slate-400" />
                                </div>
                            )}
                        </div>
                    </CardContent>
                    
                    {/* Current Conditions Grid */}
                    <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-6 pb-6">
                        {renderCurrentConditions(loading, weatherData)}
                    </CardContent>
                </Card>

                {/* Tabs Section */}
                <Tabs defaultValue="forecast" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger value="forecast" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Calendar className="h-4 w-4 mr-2" />
                            5-Day Forecast
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Active Alerts
                        </TabsTrigger>
                        <TabsTrigger value="impact" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Briefcase className="h-4 w-4 mr-2" />
                            Shelter Impact
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="forecast" className="mt-6">
                        {renderForecast(loading, weatherData)}
                    </TabsContent>
                    
                    <TabsContent value="alerts" className="mt-6">
                         <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                            <CardHeader className="text-center sm:text-left">
                                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                                    Active Weather Alerts for {locationName}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                            {loading ? (
                                <Card className="bg-slate-50/50"><CardContent className="p-4 sm:p-6"><Skeleton className="h-24 w-full"/></CardContent></Card>
                            ) : weatherData && weatherData.alerts.length > 0 ? (
                                weatherData.alerts.map((alert, index) => (
                                    <Card key={index} className={cn("backdrop-blur-sm border-0 shadow-md", getAlertCardClass(alert.severity))}>
                                        <CardContent className="p-4 sm:p-6">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    {getAlertIcon(alert.severity)}
                                                    <div>
                                                        <Badge className={cn(
                                                            "text-xs font-semibold",
                                                            alert.severity === 'Severe' && 'bg-red-100 text-red-700',
                                                            alert.severity === 'Moderate' && 'bg-yellow-100 text-yellow-700',
                                                            alert.severity === 'Minor' && 'bg-blue-100 text-blue-700',
                                                        )}>{alert.severity} Risk</Badge>
                                                        <h3 className="font-bold text-slate-800 mt-1">{alert.title}</h3>
                                                    </div>
                                                </div>
                                                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{alert.description}</p>
                                                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                                    <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5"/> Area: {alert.area}</div>
                                                    <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5"/> Until: {alert.activeUntil}</div>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50 mt-4 lg:mt-0">
                                                View Details
                                            </Button>
                                            </div>
                                            </CardContent>
                                        </Card>
                                    ))
                            ) : (
                                <div className="text-center py-12">
                                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                    <p className="text-lg font-medium text-slate-800">No active weather alerts</p>
                                    <p className="text-slate-600 mt-1">All clear for your area.</p>
                                </div>
                            )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="impact" className="mt-6">
                    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                        <CardHeader className="text-center sm:text-left">
                             <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                                Potential Shelter Impact
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-base">AI-generated analysis of how current weather may affect shelter operations and safety.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            ) : weatherData ? (
                                <Alert className="bg-purple-50 border-purple-200">
                                    <AlertTriangle className="h-4 w-4 text-purple-600" />
                                    <AlertTitle className="text-purple-800">Impact Analysis</AlertTitle>
                                    <AlertDescription className="text-purple-700 leading-relaxed">
                                        {weatherData.shelterImpact}
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="text-center py-8">
                                    <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                    <p className="text-slate-500">Impact analysis could not be generated.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    </TabsContent>
                </Tabs>

                {/* USSD Section */}
                <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900 border-yellow-200/50 dark:border-yellow-700/50 backdrop-blur-sm shadow-lg">
                    <CardHeader className="text-center sm:text-left">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                            Get Weather Updates via USSD
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base">Access weather information without internet on any mobile phone</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white/60 p-4 rounded-lg border border-yellow-200/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-yellow-100 p-2 rounded-lg">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    </div>
                                    <span className="font-medium text-yellow-800">Weather Alerts</span>
                                </div>
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 font-mono">
                                    *347*102#
                                </Badge>
                            </div>
                            <div className="bg-white/60 p-4 rounded-lg border border-yellow-200/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-yellow-100 p-2 rounded-lg">
                                        <Calendar className="h-4 w-4 text-yellow-600" />
                                    </div>
                                    <span className="font-medium text-yellow-800">5-Day Forecast</span>
                                </div>
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 font-mono">
                                    *347*202#
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

}
