"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlarmClock, AlertTriangle, Building, LifeBuoy, MessageSquare, Send, Users, Wind, MapPin, Phone, Shield, Heart, Activity } from "lucide-react"
import { Link } from "react-router-dom"
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import type { Shelter, UssdCode } from "@/lib/data";

export default function Home() {
  const [stats, setStats] = useState({ shelterCount: 0, peopleAssisted: 0 });
  const [ussdCodes, setUssdCodes] = useState<UssdCode[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<UssdCode[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 dark:from-slate-900 dark:via-blue-900 dark:to-emerald-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Heart className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-emerald-700 bg-clip-text text-transparent">
              HopeLine Dashboard
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg max-w-4xl mx-auto leading-relaxed">
            Your emergency assistance platform for finding shelter, getting help, and staying safe in Bayelsa and Adamawa states. 
            A project supported by the CITI Foundation.
          </p>
        </div>

        {/* Emergency Alert */}
        <Alert className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200/50 backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-800 font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Flood & Security Alert
          </AlertTitle>
          <AlertDescription className="text-red-700/90">
            Heavy rainfall and potential flooding forecasted for Bayelsa. Increased security vigilance advised in Adamawa. 
            Please find safe shelter immediately.
          </AlertDescription>
        </Alert>

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
              <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 mb-2 text-center">
                {action.title}
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-6 text-center">
                {action.description}
              </CardDescription>
              <Link to={action.href} className="w-full">
                <Button 
                  className={`w-full h-12 sm:h-14 text-sm sm:text-base font-medium transition-all duration-200 hover:scale-105 ${
                    action.color === 'destructive' 
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
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
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
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    {stat.value}
                  </p>
                )}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
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
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                    No Smartphone? No Wahala!
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
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
                  Array.from({length: 4}).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full bg-yellow-100/50" />
                  ))
                ) : ussdCodes.length > 0 ? (
                  ussdCodes.slice(0, 4).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-yellow-200/50">
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 font-mono text-xs">
                        {item.code}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">USSD codes not available.</p>
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
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                    Emergency Contacts
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
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
                  Array.from({length: 4}).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full bg-green-100/50" />
                  ))
                ) : emergencyContacts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {emergencyContacts.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-green-200/50">
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 font-mono text-xs">
                          {item.code}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Emergency contacts not available.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
