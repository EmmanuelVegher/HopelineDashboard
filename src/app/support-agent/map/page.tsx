"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin,
  AlertTriangle,
  Phone,
  Navigation,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe,
  Clock
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import GoogleMap from "@/components/google-map";
import { useTranslation } from "react-i18next";

interface LocationRequest {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  latitude: number;
  longitude: number;
  address?: string;
  requestType: 'navigation' | 'shelter' | 'emergency' | 'location_share';
  status: 'active' | 'resolved' | 'cancelled';
  timestamp: Date;
  language: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  description?: string;
}

interface EmergencyLocation {
  id: string;
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  emergencyType: string;
  status: 'active' | 'responding' | 'resolved';
  timestamp: Date;
  description?: string;
}

export default function SupportAgentMapPage() {
  const { t } = useTranslation();
  const [locationRequests, setLocationRequests] = useState<LocationRequest[]>([]);
  const [emergencyLocations, setEmergencyLocations] = useState<EmergencyLocation[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LocationRequest | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 9.0765, lng: 8.6753 }); // Center of Nigeria
  const [mapZoom, setMapZoom] = useState(6);
  const [filterType, setFilterType] = useState<string>('all');
  const [showEmergencies, setShowEmergencies] = useState(true);
  // const { toast } = useToast();

  useEffect(() => {
    // Listen for location assistance requests
    const requestsQuery = query(
      collection(db, 'location_requests'),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      const requests: LocationRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || 'Unknown User',
          userImage: data.userImage,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          requestType: data.requestType || 'navigation',
          status: data.status || 'active',
          timestamp: data.timestamp?.toDate() || new Date(),
          language: data.language || 'English',
          priority: data.priority || 'medium',
          description: data.description
        });
      });
      setLocationRequests(requests);
    });

    // Listen for emergency locations
    const emergenciesQuery = query(
      collection(db, 'emergency_locations'),
      where('status', 'in', ['active', 'responding']),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeEmergencies = onSnapshot(emergenciesQuery, (snapshot) => {
      const emergencies: EmergencyLocation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        emergencies.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || t('common.unknownUser'),
          latitude: data.latitude,
          longitude: data.longitude,
          emergencyType: data.emergencyType || 'Emergency',
          status: data.status || 'active',
          timestamp: data.timestamp?.toDate() || new Date(),
          description: data.description
        });
      });
      setEmergencyLocations(emergencies);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeEmergencies();
    };
  }, []);

  const handleRequestSelect = (request: LocationRequest) => {
    setSelectedRequest(request);
    setMapCenter({ lat: request.latitude, lng: request.longitude });
    setMapZoom(15);
  };

  const handleEmergencySelect = (emergency: EmergencyLocation) => {
    setMapCenter({ lat: emergency.latitude, lng: emergency.longitude });
    setMapZoom(15);
  };

  const handleNavigateToRequest = (request: LocationRequest) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`;
    window.open(url, '_blank');
  };

  const handleContactUser = (userId: string, method: 'chat' | 'call') => {
    if (method === 'chat') {
      // Navigate to chat with user
      window.location.href = `/support-agent/chats?user=${userId}`;
    } else {
      // Navigate to calls with user
      window.location.href = `/support-agent/calls?user=${userId}`;
    }
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'navigation': return '🚗';
      case 'shelter': return '🏠';
      case 'emergency': return '🚨';
      case 'location_share': return '📍';
      default: return '📍';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-destructive border-destructive';
      case 'high': return 'bg-orange-500 border-orange-600';
      case 'medium': return 'bg-yellow-500 border-yellow-600';
      default: return 'bg-green-500 border-green-600';
    }
  };

  const filteredRequests = locationRequests.filter(request => {
    if (filterType === 'all') return true;
    return request.requestType === filterType;
  });

  const mapMarkers = [
    // Location requests
    ...filteredRequests.map(request => ({
      id: request.id,
      position: { lat: request.latitude, lng: request.longitude },
      title: `${request.userName} - ${request.requestType}`,
      icon: getRequestIcon(request.requestType),
      type: 'request',
      data: request
    })),
    // Emergency locations
    ...(showEmergencies ? emergencyLocations.map(emergency => ({
      id: emergency.id,
      position: { lat: emergency.latitude, lng: emergency.longitude },
      title: `${emergency.userName} - ${emergency.emergencyType}`,
      icon: '🚨',
      type: 'emergency',
      data: emergency
    })) : [])
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <MapPin className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-3 sm:mb-4">
            {t('supportAgent.map.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            {t('supportAgent.map.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    {t('supportAgent.map.liveMap')}
                  </CardTitle>
                  <CardDescription>
                    {mapMarkers.length} {t('supportAgent.map.activeLocations')} • Zoom: {mapZoom}x
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMapZoom(prev => Math.min(prev + 1, 20))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMapZoom(prev => Math.max(prev - 1, 3))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMapCenter({ lat: 9.0765, lng: 8.6753 });
                      setMapZoom(6);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] w-full">
                <GoogleMap
                  center={mapCenter}
                  zoom={mapZoom}
                  markers={mapMarkers}
                  onMarkerClick={(marker: any) => {
                    if (marker.type === 'request') {
                      handleRequestSelect(marker.data);
                    } else if (marker.type === 'emergency') {
                      handleEmergencySelect(marker.data);
                    }
                  }}
                  showUserLocation={false}
                  showRouting={false}
                  mapTypeId="satellite"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('supportAgent.map.filters')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('supportAgent.map.requestType')}</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('supportAgent.map.types.all')}</SelectItem>
                      <SelectItem value="navigation">{t('supportAgent.map.types.navigation')}</SelectItem>
                      <SelectItem value="shelter">{t('supportAgent.map.types.shelter')}</SelectItem>
                      <SelectItem value="emergency">{t('supportAgent.map.types.emergency')}</SelectItem>
                      <SelectItem value="location_share">{t('supportAgent.map.types.location_share')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{t('supportAgent.map.showEmergencies')}</label>
                  <Button
                    variant={showEmergencies ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowEmergencies(!showEmergencies)}
                  >
                    {showEmergencies ? t('supportAgent.map.hide') : t('supportAgent.map.show')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Location Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('supportAgent.map.locationRequests')}
                </CardTitle>
                <CardDescription>{filteredRequests.length} {t('supportAgent.map.activeRequests')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  {filteredRequests.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t('supportAgent.map.noLocationRequests')}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredRequests.map((request) => (
                        <div
                          key={request.id}
                          className={`p-4 cursor-pointer hover:bg-muted transition-colors border-l-4 ${selectedRequest?.id === request.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-transparent'
                            }`}
                          onClick={() => handleRequestSelect(request)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.userImage} />
                              <AvatarFallback>{request.userName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-foreground truncate">{request.userName}</p>
                                <span className="text-lg">{getRequestIcon(request.requestType)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{request.description || request.requestType}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  <Globe className="h-3 w-3 mr-1" />
                                  {request.language}
                                </Badge>
                                <Badge
                                  className={`text-xs text-primary-foreground border-transparent ${getPriorityColor(request.priority)}`}
                                >
                                  {request.priority}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Emergency Locations */}
            {showEmergencies && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {t('supportAgent.map.emergencyLocations')}
                  </CardTitle>
                  <CardDescription>{emergencyLocations.length} {t('supportAgent.map.activeEmergencies')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[200px]">
                    {emergencyLocations.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{t('supportAgent.map.noActiveEmergencies')}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {emergencyLocations.map((emergency) => (
                          <div
                            key={emergency.id}
                            className="p-4 cursor-pointer hover:bg-red-50 transition-colors border-l-4 border-red-500"
                            onClick={() => handleEmergencySelect(emergency)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{emergency.userName}</p>
                                <p className="text-sm text-muted-foreground truncate">{emergency.emergencyType}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {emergency.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Selected Request Details */}
        {selectedRequest && (
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedRequest.userImage} />
                  <AvatarFallback>{selectedRequest.userName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedRequest.userName}</h3>
                  <p className="text-muted-foreground">{selectedRequest.language}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{t('supportAgent.map.requestDetails')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{selectedRequest.address || `${selectedRequest.latitude.toFixed(6)}, ${selectedRequest.longitude.toFixed(6)}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{selectedRequest.timestamp.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getRequestIcon(selectedRequest.requestType)}</span>
                        <span className="capitalize">{selectedRequest.requestType.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.description && (
                    <div>
                      <h4 className="font-medium mb-2">{t('supportAgent.map.description')}</h4>
                      <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">{t('supportAgent.map.actions')}</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleNavigateToRequest(selectedRequest)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      {t('supportAgent.map.navigate')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleContactUser(selectedRequest.userId, 'chat')}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {t('supportAgent.map.chat')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleContactUser(selectedRequest.userId, 'call')}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      {t('supportAgent.map.call')}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-primary-foreground border-transparent ${getPriorityColor(selectedRequest.priority)}`}>
                      {selectedRequest.priority.toUpperCase()} {t('supportAgent.map.priorityLabel')}
                    </Badge>
                    <Badge variant="outline">
                      {selectedRequest.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}