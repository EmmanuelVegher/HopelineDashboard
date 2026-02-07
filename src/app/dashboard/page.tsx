"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlarmClock, AlertTriangle, Building, LifeBuoy, MessageSquare, Send, Users, Wind, MapPin, Phone, Shield, Heart, Activity, Navigation, Clock } from "lucide-react"
import { Link } from "react-router-dom"
import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { DisplacedPerson, Shelter, UssdCode } from "@/lib/data";
import { getWeather } from "@/ai/client";
import { type GetWeatherOutput } from "@/ai/schemas/weather";

export default function Home() {
  const [stats, setStats] = useState({ shelterCount: 0, peopleAssisted: 0 });
  const [ussdCodes, setUssdCodes] = useState<UssdCode[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<UssdCode[]>([]);
  const [weatherData, setWeatherData] = useState<GetWeatherOutput | null>(null);
  const [displacedRecord, setDisplacedRecord] = useState<DisplacedPerson | null>(null);
  const [assignedShelter, setAssignedShelter] = useState<Shelter | null>(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [recordLoading, setRecordLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [shelterSnapshot, ussdSnapshot] = await Promise.all([
          getDocs(collection(db, "shelters")),
          getDocs(collection(db, "ussdCodes"))
        ]);

        const sheltersData = shelterSnapshot.docs.map(doc => doc.data() as Shelter);
        const shelterCount = sheltersData.length;
        const peopleAssisted = sheltersData.reduce((acc, shelter) => {
          return acc + (shelter.capacity - shelter.availableCapacity);
        }, 0);
        setStats({ shelterCount, peopleAssisted });

        const allCodes = ussdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UssdCode));
        const ussd = allCodes.filter(c => c.code.startsWith('*'));
        const contacts = allCodes.filter(c => !c.code.startsWith('*'));
        setUssdCodes(ussd);
        setEmergencyContacts(contacts);

      } catch (error) {
        console.error("Error fetching dashboard stats: ", error);
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        // Try to get user's location first, fallback to Bayelsa/Adamawa region
        let latitude = 5.0; // Default: Bayelsa/Adamawa region
        let longitude = 6.0;

        if (navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false, // Quick location for dashboard
                timeout: 5000,
                maximumAge: 600000 // 10 minutes
              });
            });
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            console.log(`Dashboard using user location: ${latitude}, ${longitude}`);
          } catch (locationError) {
            console.log("Using default location for dashboard weather:", locationError);
          }
        }

        const weather = await getWeather({ latitude, longitude }) as GetWeatherOutput;
        setWeatherData(weather);
      } catch (error) {
        console.error("Error fetching weather data:", error);
      }
      setWeatherLoading(false);
    };

    fetchWeather();
  }, []);

  useEffect(() => {
    const fetchDisplacementRecord = async (uid: string) => {
      setRecordLoading(true);
      try {
        const q = query(collection(db, "displacedPersons"), where("userId", "==", uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const record = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DisplacedPerson;
          setDisplacedRecord(record);

          if (record.assignedShelterId) {
            const shelterDoc = await getDoc(doc(db, "shelters", record.assignedShelterId));
            if (shelterDoc.exists()) {
              setAssignedShelter({ id: shelterDoc.id, ...shelterDoc.data() } as Shelter);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching displacement record:", error);
      }
      setRecordLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchDisplacementRecord(user.uid);
      } else {
        setRecordLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const halfIndex = Math.ceil(emergencyContacts.length / 2);
  const firstHalfContacts = emergencyContacts.slice(0, halfIndex);
  const secondHalfContacts = emergencyContacts.slice(halfIndex);

  const quickActions = [
    {
      title: "Emergency SOS",
      description: "Send immediate emergency alert",
      icon: AlertTriangle,
      color: "destructive",
      href: "/sos",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      iconColor: "text-red-600",
      iconBg: "bg-red-100"
    },
    {
      title: "Find Shelter",
      description: "Locate nearby emergency shelters",
      icon: Building,
      color: "default",
      href: "/find-shelter",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100"
    },
    {
      title: "Get Assistance",
      description: "Chat with support teams",
      icon: MessageSquare,
      color: "default",
      href: "/assistance",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      iconColor: "text-green-600",
      iconBg: "bg-green-100"
    }
  ];

  const secondaryActions = [
    {
      title: "Route Navigation",
      description: "Get safe directions to shelters",
      icon: MapPin,
      href: "/navigate"
    },
    {
      title: "Weather & Safety",
      description: "Stay informed about alerts",
      icon: Wind,
      href: "/weather"
    }
  ];

  const statsData = [
    {
      icon: Building,
      value: stats.shelterCount,
      label: "Active IDP Camps",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      icon: Users,
      value: stats.peopleAssisted.toLocaleString(),
      label: "People Assisted",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      icon: LifeBuoy,
      value: "24/7",
      label: "CARITAS Support",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      icon: AlarmClock,
      value: "< 15min",
      label: "Response Time",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Heart className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-white">
              HopeLine Dashboard
            </h1>
          </div>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">
            Your emergency assistance platform for finding shelter, getting help, and staying safe in disaster-affected regions. A project supported by the CITI Foundation.
          </p>
        </div>

        {/* Weather Alerts */}
        {weatherLoading ? (
          <Alert className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900 dark:to-cyan-900 border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm">
            <Wind className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800 dark:text-blue-200 font-semibold">
              Loading Weather Information...
            </AlertTitle>
            <AlertDescription className="text-blue-700/90 dark:text-blue-300">
              <Skeleton className="h-4 w-full mt-1" />
            </AlertDescription>
          </Alert>
        ) : weatherData?.alerts && weatherData.alerts.length > 0 ? (
          weatherData.alerts.map((alert: any, index: number) => (
            <Alert key={index} className={`bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900 dark:to-orange-900 border-red-200/50 dark:border-red-700/50 backdrop-blur-sm ${alert.severity === 'Severe' ? 'border-l-4 border-l-red-500' : ''}`}>
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertTitle className="text-red-800 dark:text-red-200 font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {alert.title}
              </AlertTitle>
              <AlertDescription className="text-red-700/90 dark:text-red-300">
                {alert.description}
              </AlertDescription>
            </Alert>
          ))
        ) : weatherData ? (
          <Alert className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900 dark:to-cyan-900 border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm">
            <Wind className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800 dark:text-blue-200 font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Weather Update
            </AlertTitle>
            <AlertDescription className="text-blue-700/90 dark:text-blue-300">
              {weatherData.narrativeSummary}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Displacement Status Card */}
        {recordLoading ? (
          <Card className="border-blue-100 bg-blue-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : displacedRecord ? (
          <Card className="overflow-hidden border-blue-200 shadow-md">
            <div className="bg-blue-600 px-6 py-3 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <h2 className="font-bold">Migration & Assistance Status</h2>
              </div>
              <Badge variant="outline" className="bg-white/20 text-white border-white/40">
                {displacedRecord.status}
              </Badge>
            </div>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-6 space-y-4 border-r">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Registered Current Location</p>
                      <p className="text-sm text-muted-foreground">{displacedRecord.stayingLocation || 'Under Review'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{displacedRecord.currentLocation}</p>
                    </div>
                  </div>

                  {assignedShelter ? (
                    <div className="flex items-start gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Building className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800">Assigned Transit Space</p>
                        <p className="text-sm font-medium">{assignedShelter.name}</p>
                        <p className="text-xs text-green-700">{assignedShelter.location}</p>
                        {displacedRecord.allocatedResources?.bedNumber && (
                          <Badge variant="secondary" className="mt-2 bg-green-200 text-green-800 block w-fit">
                            Room/Space: {displacedRecord.allocatedResources.bedNumber}
                          </Badge>
                        )}
                        <div className="mt-3 flex gap-2">
                          <Link to={`/dashboard/navigate?lat=${assignedShelter.latitude || ''}&lng=${assignedShelter.longitude || ''}`}>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                              <Navigation className="h-3 w-3 mr-1" /> Get Directions
                            </Button>
                          </Link>
                          <Link to="/dashboard/assistance">
                            <Button size="sm" variant="outline" className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-100">
                              Report Issue
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="bg-slate-200 p-2 rounded-lg">
                        <Building className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-600">Shelter Assignment</p>
                        <p className="text-xs text-slate-500 mt-1">Your record is currently under review for transit space allocation. We will notify you once a space is assigned.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-50/50">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-700">
                    <Clock className="h-4 w-4" /> Activity History
                  </h3>
                  {displacedRecord.activityLog && displacedRecord.activityLog.length > 0 ? (
                    <div className="space-y-4">
                      {displacedRecord.activityLog.slice(-3).reverse().map((log, idx) => (
                        <div key={idx} className="relative pl-6 border-l-2 border-slate-200">
                          <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center ${idx === 0 ? 'bg-blue-600 shadow-sm' : 'bg-slate-400'}`}>
                            {idx === 0 && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-none">{log.action}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{log.date.split(',')[0]} &middot; {log.notes || 'Automated Update'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Activity className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400">No activity history yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className={`${action.bgColor} dark:${action.bgColor.replace('50', '900').replace('100', '800')} ${action.borderColor} dark:${action.borderColor.replace('200', '700')} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col items-center justify-center p-6 sm:p-8`}
            >
              <div className={`${action.iconBg} p-4 rounded-2xl mb-4 transition-all duration-300 hover:scale-110`}>
                <action.icon className={`h-8 w-8 sm:h-10 sm:w-10 ${action.iconColor}`} />
              </div>
              <CardTitle className={`text-lg sm:text-xl font-bold mb-2 text-center ${action.title === "Emergency SOS" || action.title === "Get Assistance" ? "text-black" : "text-foreground"
                }`}>
                {action.title}
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-muted-foreground mb-6 text-center">
                {action.description}
              </CardDescription>
              <Link to={action.href} className="w-full">
                <Button
                  className={`w-full h-12 sm:h-14 text-sm sm:text-base font-medium transition-all duration-200 hover:scale-105 ${action.color === 'destructive'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 shadow-md hover:shadow-lg'
                    }`}
                >
                  {action.title === "Emergency SOS" ? "Send SOS Now" :
                    action.title === "Find Shelter" ? "Find Nearest Shelter" : "Request Help"}
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {secondaryActions.map((action, index) => (
            <Card key={index} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="flex-row items-center gap-4 space-y-0 p-6 sm:p-8">
                <div className="bg-blue-100 p-3 rounded-xl transition-all duration-300 hover:scale-110">
                  <action.icon className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg sm:text-xl font-bold text-foreground">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-muted-foreground">
                    {action.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
                <Link to={action.href}>
                  <Button variant="outline" className="w-full h-12 sm:h-14 text-sm sm:text-base font-medium border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105">
                    Open {action.title.split(' ')[0]}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {statsData.map((stat, index) => (
            <Card key={index} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <div className={`${stat.bgColor} p-3 rounded-2xl mb-4 transition-all duration-300 hover:scale-110`}>
                  <stat.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${stat.color}`} />
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-16 sm:w-20 mx-auto" />
                ) : (
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    {stat.value}
                  </p>
                )}
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {stat.label}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* USSD & Contacts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* USSD Codes */}
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900 border-yellow-200/50 dark:border-yellow-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="pb-4 sm:pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-xl">
                  <Phone className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-foreground">
                    No Smartphone? No Wahala!
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-muted-foreground">
                    Access emergency services using USSD codes on any mobile phone
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                  MTN, Airtel, Glo, 9mobile
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 sm:pt-2">
              <div className="space-y-3 sm:space-y-4">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full bg-yellow-100/50" />
                  ))
                ) : ussdCodes.length > 0 ? (
                  ussdCodes.slice(0, 4).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm p-3 rounded-xl border border-yellow-200/50 dark:border-yellow-600/50">
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-600 font-mono text-xs">
                        {item.code}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">USSD codes not available.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contacts */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 border-green-200/50 dark:border-green-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="pb-4 sm:pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-xl">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-foreground">
                    Emergency Contacts
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-muted-foreground">
                    Important phone numbers for emergency situations
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                  24/7 Available
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 sm:pt-2">
              <div className="space-y-3 sm:space-y-4">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full bg-green-100/50" />
                  ))
                ) : emergencyContacts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {emergencyContacts.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm p-3 rounded-xl border border-green-200/50 dark:border-green-600/50">
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 border-green-200 dark:border-green-600 font-mono text-xs">
                          {item.code}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Emergency contacts not available.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
