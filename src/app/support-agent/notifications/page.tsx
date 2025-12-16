"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellRing,
  MessageSquare,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Globe,
  Trash2,
  Archive,
  Eye,
  EyeOff,
  Filter,
  Settings
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: 'chat_request' | 'call_request' | 'emergency' | 'system' | 'location_request';
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'unread' | 'read' | 'archived';
  timestamp: Date;
  language?: string;
  location?: string;
  actionRequired?: boolean;
  actionUrl?: string;
}

export default function SupportAgentNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    filterNotifications();
    updateUnreadCount();
  }, [notifications, filterType, filterStatus]);

  const loadNotifications = async () => {
    const agentId = auth.currentUser?.uid;
    if (!agentId) return;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('agentId', '==', agentId),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        const notifs: Notification[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          notifs.push({
            id: doc.id,
            type: data.type || 'system',
            title: data.title || 'Notification',
            message: data.message || '',
            userId: data.userId,
            userName: data.userName,
            userImage: data.userImage,
            priority: data.priority || 'medium',
            status: data.status || 'unread',
            timestamp: data.timestamp?.toDate() || new Date(),
            language: data.language,
            location: data.location,
            actionRequired: data.actionRequired || false,
            actionUrl: data.actionUrl
          });
        });
        setNotifications(notifs);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error loading notifications:", error);
      setLoading(false);
      toast({ title: "Error", description: "Failed to load notifications", variant: "destructive" });
    }
  };

  const filterNotifications = () => {
    let filtered = notifications;

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(notif => notif.type === filterType);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(notif => notif.status === filterStatus);
    }

    setFilteredNotifications(filtered);
  };

  const updateUnreadCount = () => {
    const unread = notifications.filter(notif => notif.status === 'unread').length;
    setUnreadCount(unread);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        status: 'read'
      });
      toast({ title: "Marked as Read", description: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleMarkAsUnread = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        status: 'unread'
      });
      toast({ title: "Marked as Unread", description: "Notification marked as unread" });
    } catch (error) {
      console.error("Error marking notification as unread:", error);
      toast({ title: "Error", description: "Failed to mark as unread", variant: "destructive" });
    }
  };

  const handleArchive = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        status: 'archived'
      });
      toast({ title: "Archived", description: "Notification archived" });
    } catch (error) {
      console.error("Error archiving notification:", error);
      toast({ title: "Error", description: "Failed to archive notification", variant: "destructive" });
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      toast({ title: "Deleted", description: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({ title: "Error", description: "Failed to delete notification", variant: "destructive" });
    }
  };

  const handleAction = (notification: Notification) => {
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    } else {
      // Default actions based on type
      switch (notification.type) {
        case 'chat_request':
          window.location.href = `/support-agent/chats?user=${notification.userId}`;
          break;
        case 'call_request':
          window.location.href = `/support-agent/calls?user=${notification.userId}`;
          break;
        case 'location_request':
          window.location.href = `/support-agent/map?user=${notification.userId}`;
          break;
        default:
          break;
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chat_request': return MessageSquare;
      case 'call_request': return Phone;
      case 'emergency': return AlertTriangle;
      case 'location_request': return MapPin;
      default: return Bell;
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

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <BellRing className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-3 sm:mb-4">
            Notifications Center
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            Stay updated with all your support requests and system alerts
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive mb-1">{unreadCount}</div>
              <div className="text-sm text-muted-foreground">Unread</div>
            </CardContent>
          </Card>

          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {notifications.filter(n => n.type === 'chat_request').length}
              </div>
              <div className="text-sm text-muted-foreground">Chat Requests</div>
            </CardContent>
          </Card>

          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {notifications.filter(n => n.type === 'call_request').length}
              </div>
              <div className="text-sm text-muted-foreground">Call Requests</div>
            </CardContent>
          </Card>

          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {notifications.filter(n => n.priority === 'emergency').length}
              </div>
              <div className="text-sm text-muted-foreground">Emergencies</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters:</span>
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="chat_request">Chat Requests</SelectItem>
                  <SelectItem value="call_request">Call Requests</SelectItem>
                  <SelectItem value="emergency">Emergencies</SelectItem>
                  <SelectItem value="location_request">Location Requests</SelectItem>
                  <SelectItem value="system">System Alerts</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <div className="ml-auto text-sm text-muted-foreground">
                {filteredNotifications.length} notifications
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Notifications
            </CardTitle>
            <CardDescription>Your latest notifications and alerts</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
                      <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notifications found</p>
                <p className="text-sm mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-slate-100">
                  {filteredNotifications.map((notification) => {
                    const IconComponent = getNotificationIcon(notification.type);
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-slate-50/50 transition-colors ${
                          notification.status === 'unread' ? 'bg-primary/30 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Notification Icon */}
                          <div className={`p-2 rounded-full ${
                            notification.status === 'unread' ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              notification.status === 'unread' ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-slate-800 truncate">
                                    {notification.title}
                                  </h4>
                                  <Badge
                                    className={`text-xs text-white border-transparent ${getPriorityColor(notification.priority)}`}
                                  >
                                    {notification.priority}
                                  </Badge>
                                  {notification.status === 'unread' && (
                                    <Badge variant="default" className="text-xs">
                                      Unread
                                    </Badge>
                                  )}
                                </div>

                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {notification.message}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeAgo(notification.timestamp)}
                                  </div>

                                  {notification.userName && (
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {notification.userName}
                                    </div>
                                  )}

                                  {notification.language && (
                                    <div className="flex items-center gap-1">
                                      <Globe className="h-3 w-3" />
                                      {notification.language}
                                    </div>
                                  )}

                                  {notification.location && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {notification.location}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                {notification.actionRequired && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAction(notification)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    Take Action
                                  </Button>
                                )}

                                <div className="flex items-center gap-1">
                                  {notification.status === 'unread' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      title="Mark as read"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleMarkAsUnread(notification.id)}
                                      title="Mark as unread"
                                    >
                                      <EyeOff className="h-4 w-4" />
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleArchive(notification.id)}
                                    title="Archive"
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(notification.id)}
                                    title="Delete"
                                    className="text-destructive hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}