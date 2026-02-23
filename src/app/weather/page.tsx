"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, MapPin, Calendar, Droplets, Eye, Sun, Thermometer, Wind, Clock, CloudDrizzle, Cloud, Cloudy, CloudLightning, CloudRain, CloudSnow, CloudFog, Loader2, Info, RefreshCw, Briefcase, CheckCircle, AlertCircle, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getWeather } from "@/ai/client";
import { type GetWeatherOutput } from "@/ai/schemas/weather";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";


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
    switch (severity) {
        case 'Severe': return 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200/50';
        case 'Moderate': return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200/50';
        case 'Minor': return 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200/50';
        default: return 'bg-white';
    }
}

const getAlertIcon = (severity: 'Severe' | 'Moderate' | 'Minor') => {
    switch (severity) {
        case 'Severe': return <AlertTriangle className="h-5 w-5 text-red-600" />;
        case 'Moderate': return <CloudDrizzle className="h-5 w-5 text-yellow-600" />;
        default: return <Cloud className="h-5 w-5 text-blue-600" />
    }
}

const renderCurrentConditions = (loading: boolean, weatherData: GetWeatherOutput | null, t: any) => {
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
        { value: humidity, label: t('weather.stats.humidity'), icon: Droplets, color: "text-cyan-600", bgColor: "bg-cyan-100", unit: "%" },
        { value: windSpeed, label: t('weather.stats.windSpeed'), icon: Wind, color: "text-green-600", bgColor: "bg-green-100", unit: "km/h" },
        { value: visibility, label: t('weather.stats.visibility'), icon: Eye, color: "text-purple-600", bgColor: "bg-purple-100", unit: "km" },
        { value: uvIndex, label: t('weather.stats.uvIndex'), icon: Sun, color: "text-orange-600", bgColor: "bg-orange-100", unit: "" },
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

const renderForecast = (loading: boolean, weatherData: GetWeatherOutput | null, t: any) => {
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
                    {t('weather.fiveDayForecast')}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {weatherData.forecast.map((day: any) => {
                    const Icon = iconMap[day.icon as keyof typeof iconMap] || Cloud;
                    return (
                        <Card key={day.day} className="p-4 flex flex-col items-center gap-3 bg-slate-50/50 hover:bg-slate-100/50 transition-all duration-200 hover:scale-105">
                            <p className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200">{day.day}</p>
                            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-2xl">
                                <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
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
    const { t } = useTranslation();
    const [weatherData, setWeatherData] = useState<GetWeatherOutput | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationName, setLocationName] = useState("your location");
    const [currentCoords, setCurrentCoords] = useState<{ latitude: number, longitude: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [showManualLocation, setShowManualLocation] = useState(false);
    const { toast } = useToast();

    const fetchWeather = useCallback(async (latitude: number, longitude: number) => {
        setLoading(true);
        try {
            const data = await getWeather({ latitude, longitude }) as GetWeatherOutput;
            setWeatherData(data);
        } catch (error) {
            console.error("Failed to fetch weather data:", error);
            toast({
                title: t('weather.errors.title'),
                description: t('weather.errors.fetchFailed'),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchLocationAndWeather = useCallback(() => {
        setLoading(true);
        setLocationError(null);

        // Check for HTTPS requirement
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            const errorMsg = t('weather.errors.httpsRequiredDesc');
            setLocationError(errorMsg);
            toast({
                title: t('weather.errors.httpsRequiredTitle'),
                description: errorMsg,
                variant: "destructive"
            });
            setLoading(false);
            return;
        }

        if (!navigator.geolocation) {
            const errorMsg = t('weather.errors.geoNotSupportedDesc');
            setLocationError(errorMsg);
            toast({
                title: t('weather.errors.geoNotSupportedTitle'),
                description: errorMsg,
                variant: "destructive"
            });
            setLoading(false);
            return;
        }

        // Enhanced geolocation options for better mobile support
        const options: PositionOptions = {
            enableHighAccuracy: true, // Use GPS when available
            timeout: 15000, // 15 second timeout
            maximumAge: 600000 // Accept positions up to 10 minutes old
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                console.log(`Location obtained: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

                setCurrentCoords({ latitude, longitude });
                setLocationError(null);
                fetchWeather(latitude, longitude);

                try {
                    // Use a more reliable geocoding service
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    const data = await response.json();

                    if (data.city && data.principalSubdivision) {
                        setLocationName(`${data.city}, ${data.principalSubdivision}`);
                    } else if (data.locality) {
                        setLocationName(data.locality);
                    } else {
                        setLocationName("your current location");
                    }
                } catch (error) {
                    console.error("Reverse geocoding error:", error);
                    setLocationName("your current location");
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                let errorMsg = t('weather.errors.couldNotGetLocation');

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = t('weather.errors.permissionDenied');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = t('weather.errors.positionUnavailable');
                        break;
                    case error.TIMEOUT:
                        errorMsg = t('weather.errors.timeout');
                        break;
                    default:
                        errorMsg = t('weather.errors.generalError', { message: error.message });
                }

                setLocationError(errorMsg);
                toast({
                    title: t('weather.locationAccessTitle'),
                    description: errorMsg,
                    variant: "destructive"
                });
                setLoading(false);
            },
            options
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

    const MainIcon = weatherData && weatherData.forecast.length > 0 ? iconMap[weatherData.forecast[0].icon as keyof typeof iconMap] || Cloud : Loader2;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 dark:from-blue-900 dark:via-cyan-900 dark:to-emerald-900 p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                            {t('weather.title')}
                        </h1>
                        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg mt-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            {t('weather.conditionsFor', { location: locationName })}
                            {locationError && (
                                <span className="text-red-500 text-xs">{t('weather.locationRequiredNote')}</span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {weatherData && !loading && (
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-white/60 px-3 py-2 rounded-lg">
                                <Clock className="h-4 w-4" />
                                <span>{t('weather.lastUpdated', { time: weatherData.lastUpdated })}</span>
                            </div>
                        )}
                        {locationError && (
                            <Button
                                onClick={fetchLocationAndWeather}
                                disabled={loading}
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                                <MapPin className="mr-2 h-4 w-4" />
                                {t('weather.enableLocation')}
                            </Button>
                        )}
                        <Button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                            {t('weather.refresh')}
                        </Button>
                    </div>
                </div>

                {locationError && (
                    <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-800">{t('weather.locationAccessTitle')}</AlertTitle>
                        <AlertDescription className="text-red-700">
                            <div className="space-y-3">
                                <p>{locationError}</p>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                                    <strong>{t('weather.mobileUsersHint').split(':')[0]}:</strong> {t('weather.mobileUsersHint').split(':')[1]}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        onClick={() => setShowManualLocation(true)}
                                        variant="outline"
                                        size="sm"
                                        className="border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                        <MapPin className="h-4 w-4 mr-2" />
                                        {t('weather.enterLocationManually')}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            // Use default coordinates for Abuja, Nigeria
                                            const defaultCoords = { latitude: 9.0765, longitude: 7.3986 };
                                            setCurrentCoords(defaultCoords);
                                            setLocationName("Abuja, Nigeria");
                                            setLocationError(null);
                                            fetchWeather(defaultCoords.latitude, defaultCoords.longitude);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                        {t('weather.useDefaultLocation')}
                                    </Button>
                                    <Button
                                        onClick={fetchLocationAndWeather}
                                        size="sm"
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        {t('weather.tryAgain')}
                                    </Button>
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {showManualLocation && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-800">
                                <MapPin className="h-5 w-5" />
                                {t('weather.enterLocationManually')}
                            </CardTitle>
                            <CardDescription className="text-blue-700">
                                {t('weather.enterLocationDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-blue-800">{t('weather.latitude')}</label>
                                        <Input
                                            type="number"
                                            step="0.0001"
                                            placeholder="9.0765"
                                            className="mt-1"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const lat = parseFloat(e.target.value);
                                                if (!isNaN(lat) && currentCoords) {
                                                    setCurrentCoords({ ...currentCoords, latitude: lat });
                                                } else if (!isNaN(lat)) {
                                                    setCurrentCoords({ latitude: lat, longitude: 0 });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-blue-800">{t('weather.longitude')}</label>
                                        <Input
                                            type="number"
                                            step="0.0001"
                                            placeholder="7.3986"
                                            className="mt-1"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const lng = parseFloat(e.target.value);
                                                if (!isNaN(lng) && currentCoords) {
                                                    setCurrentCoords({ ...currentCoords, longitude: lng });
                                                } else if (!isNaN(lng)) {
                                                    setCurrentCoords({ latitude: 0, longitude: lng });
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => {
                                            if (currentCoords && currentCoords.latitude && currentCoords.longitude) {
                                                setLocationName("Custom Location");
                                                setLocationError(null);
                                                setShowManualLocation(false);
                                                fetchWeather(currentCoords.latitude, currentCoords.longitude);
                                            }
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700"
                                        disabled={!currentCoords || !currentCoords.latitude || !currentCoords.longitude}
                                    >
                                        {t('weather.getWeatherBtn')}
                                    </Button>
                                    <Button
                                        onClick={() => setShowManualLocation(false)}
                                        variant="outline"
                                    >
                                        {t('weather.cancelBtn')}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

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
                                    <p className="text-slate-500 text-lg">{t('weather.couldNotLoad')}</p>
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
                        {renderCurrentConditions(loading, weatherData, t)}
                    </CardContent>
                </Card>

                {/* Tabs Section */}
                <Tabs defaultValue="forecast" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger value="forecast" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Calendar className="h-4 w-4 mr-2" />
                            {t('weather.fiveDayForecast')}
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            {t('weather.activeAlertsTab')}
                        </TabsTrigger>
                        <TabsTrigger value="impact" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Briefcase className="h-4 w-4 mr-2" />
                            {t('weather.shelterImpactTab')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="forecast" className="mt-6">
                        {renderForecast(loading, weatherData, t)}
                    </TabsContent>

                    <TabsContent value="alerts" className="mt-6">
                        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                            <CardHeader className="text-center sm:text-left">
                                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                                    {t('weather.activeAlertsFor', { location: locationName })}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loading ? (
                                    <Card className="bg-slate-50/50"><CardContent className="p-4 sm:p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
                                ) : weatherData && weatherData.alerts.length > 0 ? (
                                    weatherData.alerts.map((alert: any, index: number) => (
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
                                                                )}>{t('weather.riskLevel', { severity: alert.severity })}</Badge>
                                                                <h3 className="font-bold text-slate-800 mt-1">{alert.title}</h3>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{alert.description}</p>
                                                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                                            <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {t('weather.area', { area: alert.area })}</div>
                                                            <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {t('weather.until', { time: alert.activeUntil })}</div>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50 mt-4 lg:mt-0">
                                                        {t('weather.viewDetails')}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                        <p className="text-lg font-medium text-slate-800">{t('weather.noActiveAlerts')}</p>
                                        <p className="text-slate-600 mt-1">{t('weather.allClear')}</p>
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
                                    {t('weather.potentialImpact')}
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base">{t('weather.impactDesc')}</CardDescription>
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
                                        <AlertTitle className="text-purple-800">{t('weather.impactAnalysis')}</AlertTitle>
                                        <AlertDescription className="text-purple-700 leading-relaxed">
                                            {weatherData.shelterImpact}
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="text-center py-8">
                                        <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                        <p className="text-slate-500">{t('weather.impactCouldNotBeGenerated')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900 border-yellow-200/50 dark:border-yellow-700/50 backdrop-blur-sm shadow-lg">
                    <CardHeader className="text-center sm:text-left">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                            {t('weather.ussdTitle')}
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base">{t('weather.ussdDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white/60 p-4 rounded-lg border border-yellow-200/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-yellow-100 p-2 rounded-lg">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    </div>
                                    <span className="font-medium text-yellow-800">{t('weather.weatherAlertsUSSD')}</span>
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
                                    <span className="font-medium text-yellow-800">{t('weather.forecastUSSD')}</span>
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
