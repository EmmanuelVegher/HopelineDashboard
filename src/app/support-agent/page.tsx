"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare,
  Phone,
  Users,
  Clock,
  MessageCircle,
  PhoneCall,
  MapPin,
  Globe
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDocs, getCountFromServer } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

interface ChatSession {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  status: 'active' | 'waiting' | 'closed';
  language: string;
  location?: string;
}

interface CallSession {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  status: 'ringing' | 'active' | 'ended';
  startTime?: Date;
  language: string;
  location?: string;
}

export default function SupportAgentDashboard() {
  const navigate = useNavigate();
  const [activeChats, setActiveChats] = useState<ChatSession[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalChats: 0,
    activeChats: 0,
    totalCalls: 0,
    onlineUsers: 0
  });
  // const { toast } = useToast();
  const agentId = auth.currentUser?.uid;

  // Fetch agent profile first
  useEffect(() => {
    const fetchAgentProfile = async () => {
      const agentId = auth.currentUser?.uid;
      if (!agentId) return;

      try {
        const agentDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', doc(db, 'users', agentId))));
        if (!agentDoc.empty) {
          const agentData = agentDoc.docs[0].data();
          setAgentProfile(agentData);
        }
      } catch (error) {
        console.error('Error fetching agent profile:', error);
      }
    };

    fetchAgentProfile();
  }, []);

  useEffect(() => {
    if (!agentProfile) return;

    const agentState = agentProfile.state || agentProfile.location?.split(',')[1]?.trim() || 'Nigeria';

    // Listen for active chats assigned to this agent
    if (!agentId) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('agentId', '==', agentId),
      where('status', 'in', ['active', 'waiting']),
      orderBy('lastMessageTimestamp', 'desc'),
      limit(20)
    );

    const countQuery = query(
      collection(db, 'chats'),
      where('agentId', '==', agentId),
      where('status', 'in', ['active', 'waiting']),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribeChats = onSnapshot(chatsQuery, async (snapshot) => {
      const chats: ChatSession[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Get user profile data
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', doc(db, 'users', data.userId))));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            chats.push({
              id: docSnap.id,
              userId: data.userId,
              userName: userData.displayName || userData.firstName || userData.email || 'Unknown User',
              userImage: userData.image,
              lastMessage: data.lastMessage || '',
              lastMessageTime: data.lastMessageTimestamp?.toDate() || new Date(),
              unreadCount: data.unreadCount || 0,
              status: data.status || 'active',
              language: userData.language || 'English',
              location: userData.location
            });
          }
        } catch (error) {
          console.error('Error fetching user data for chat:', error);
        }
      }

      setActiveChats(chats.slice(0, 10)); // Limit to 10 after filtering

      // Update active chats count
      getCountFromServer(countQuery).then(snapshot => {
        setStats(prev => ({ ...prev, activeChats: snapshot.data().count }));
      }).catch(error => {
        console.error('Error getting chat count:', error);
      });
    }, (error) => {
      console.error("Support dashboard chats listener error:", error);
    });

    // Listen for active calls where I am a participant
    const callsQuery = query(
      collection(db, 'calls'),
      where('participants', 'array-contains', agentId),
      where('status', 'in', ['ringing', 'active']),
      orderBy('startTime', 'desc'),
      limit(10)
    );

    const unsubscribeCalls = onSnapshot(callsQuery, async (snapshot) => {
      const calls: CallSession[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Get user profile data
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', doc(db, 'users', data.userId))));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            calls.push({
              id: docSnap.id,
              userId: data.userId,
              userName: userData.displayName || userData.firstName || userData.email || 'Unknown User',
              userImage: userData.image,
              status: data.status || 'ringing',
              startTime: data.startTime?.toDate(),
              language: userData.language || 'English',
              location: userData.location
            });
          }
        } catch (error) {
          console.error('Error fetching user data for call:', error);
        }
      }

      setActiveCalls(calls.slice(0, 5)); // Limit to 5 after filtering
      setStats(prev => ({ ...prev, totalCalls: calls.length }));
    }, (error) => {
      console.error("Support dashboard calls listener error:", error);
    });

    // Get online users count in the same state
    const usersQuery = query(
      collection(db, 'users'),
      where('isOnline', '==', true),
      where('role', '==', 'user')
    );

    const unsubscribeUsers = onSnapshot(usersQuery, async (snapshot) => {
      let onlineUsersInState = 0;

      for (const docSnap of snapshot.docs) {
        const userData = docSnap.data();
        const userState = userData.state || userData.location?.split(',')[1]?.trim() || 'Nigeria';

        if (userState === agentState) {
          onlineUsersInState++;
        }
      }

      setStats(prev => ({ ...prev, onlineUsers: onlineUsersInState }));
    }, (error) => {
      console.error("Support dashboard users listener error:", error);
    });

    return () => {
      unsubscribeChats();
      unsubscribeCalls();
      unsubscribeUsers();
    };
  }, [agentProfile, agentId]);

  const handleAcceptChat = (chatId: string) => {
    // Navigate to chat interface
    navigate(`/support-agent/chats/${chatId}`);
  };

  const handleAcceptCall = (callId: string) => {
    // Navigate to call interface
    navigate(`/support-agent/calls/${callId}`);
  };

  return (
    <div className="min-h-screen bg-background p-1 sm:p-4 lg:p-6 overflow-x-hidden">
      <div className="w-full mx-auto space-y-2 sm:space-y-4 lg:space-y-6 px-0">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg mb-3 sm:mb-4 lg:mb-6">
            <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2 sm:mb-3 lg:mb-4">
            Support Agent Dashboard
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm lg:text-base xl:text-lg px-2 sm:px-0">
            Manage active chats, voice calls, and provide assistance to users in need
          </p>
          {agentProfile && (
            <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-primary/10 rounded-lg block overflow-x-hidden">
              <p className="text-xs sm:text-sm text-primary/foreground truncate">
                <MapPin className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Serving users in: <span className="font-semibold">{agentProfile.state || agentProfile.location?.split(',')[1]?.trim() || 'Nigeria'}</span>
              </p>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2 lg:gap-4">
          <Card className="bg-card backdrop-blur-sm border-0 shadow-sm sm:shadow-2xl w-full max-w-[90vw] sm:max-w-full">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="bg-primary/10 p-2 sm:p-3 rounded-2xl">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-primary">{stats.activeChats}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Active Chats</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card backdrop-blur-sm border-0 shadow-sm sm:shadow-2xl w-full max-w-[90vw] sm:max-w-full">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="bg-green-100 p-2 sm:p-3 rounded-2xl">
                  <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.totalCalls}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Active Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card backdrop-blur-sm border-0 shadow-sm sm:shadow-2xl w-full max-w-[90vw] sm:max-w-full">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="bg-purple-100 p-2 sm:p-3 rounded-2xl">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.onlineUsers}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Online Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card backdrop-blur-sm border-0 shadow-sm sm:shadow-2xl w-full max-w-[90vw] sm:max-w-full">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="bg-orange-100 p-2 sm:p-3 rounded-2xl">
                  <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">5</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Languages</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Chats */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-sm sm:shadow-2xl w-full max-w-[90vw] sm:max-w-full">
          <CardHeader className="p-2 sm:p-4 pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm sm:text-base">Active Chat Sessions</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Users currently waiting for chat support</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {activeChats.length === 0 ? (
              <div className="p-2 sm:p-4 text-center py-6">
                <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-muted-foreground">No active chat sessions assigned to you</p>
                <p className="text-sm text-muted-foreground mt-2">Chats assigned to you will appear here when users need assistance</p>
              </div>
            ) : (
              <div className="p-2 sm:p-4 space-y-3 overflow-x-hidden">
                {activeChats.map((chat) => (
                  <div key={chat.id} className="flex flex-col sm:flex-row items-start sm:justify-between p-2 bg-slate-50/50 rounded-lg overflow-x-hidden">
                    <div className="flex items-start gap-1 sm:gap-2 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                        <AvatarImage src={chat.userImage} />
                        <AvatarFallback>{chat.userName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground text-sm sm:text-base">{chat.userName}</p>
                        <p className="text-sm text-muted-foreground truncate w-full">{chat.lastMessage}</p>
                        <div className="flex items-center gap-0.5 sm:gap-1 mt-1 overflow-x-hidden">
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {chat.language}
                          </Badge>
                          {chat.location && (
                            <Badge variant="outline" className="text-xs inline-block max-w-[100px] sm:max-w-[150px] truncate">
                              <MapPin className="h-3 w-3 mr-1" />
                              {chat.location}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 mt-2 sm:mt-0 sm:flex-shrink-0">
                      {chat.unreadCount > 0 && (
                        <Badge variant="destructive" className="px-2 py-1">
                          {chat.unreadCount}
                        </Badge>
                      )}
                      <Button
                        onClick={() => handleAcceptChat(chat.id)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Join Chat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Calls */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-sm sm:shadow-2xl w-full max-w-[90vw] sm:max-w-full">
          <CardHeader className="p-2 sm:p-4 pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              <span className="text-sm sm:text-base">Active Voice Calls</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Voice calls requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {activeCalls.length === 0 ? (
              <div className="p-2 sm:p-4 text-center py-6">
                <Phone className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-muted-foreground">No active voice calls assigned to you</p>
                <p className="text-sm text-muted-foreground mt-2">Calls assigned to you will appear here when users need immediate assistance</p>
              </div>
            ) : (
              <div className="p-2 sm:p-4 space-y-3 overflow-x-hidden">
                {activeCalls.map((call) => (
                  <div key={call.id} className="flex flex-col sm:flex-row items-start sm:justify-between p-2 bg-slate-50/50 rounded-lg overflow-x-hidden">
                    <div className="flex items-start gap-1 sm:gap-2 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                        <AvatarImage src={call.userImage} />
                        <AvatarFallback>{call.userName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground text-sm sm:text-base">{call.userName}</p>
                        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-hidden">
                          <Badge
                            variant={call.status === 'ringing' ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {call.status === 'ringing' ? 'Ringing' : 'Active'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {call.language}
                          </Badge>
                          {call.location && (
                            <Badge variant="outline" className="text-xs inline-block max-w-[100px] sm:max-w-[150px] truncate">
                              <MapPin className="h-3 w-3 mr-1" />
                              {call.location}
                            </Badge>
                          )}
                        </div>
                        {call.startTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Started {call.startTime.toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 mt-2 sm:mt-0 sm:flex-shrink-0">
                      <Button
                        onClick={() => handleAcceptCall(call.id)}
                        className={call.status === 'ringing' ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        {call.status === 'ringing' ? 'Answer Call' : 'Join Call'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2">
          <Button
            variant="outline"
            className="h-12 sm:h-16 lg:h-20 border-2 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30"
            onClick={() => navigate('/support-agent/chats')}
          >
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
            <div className="text-left">
              <div className="font-medium text-sm sm:text-base">View All Chats</div>
              <div className="text-xs opacity-75 hidden sm:block">Chat History</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-12 sm:h-16 lg:h-20 border-2 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
            onClick={() => navigate('/support-agent/calls')}
          >
            <Phone className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
            <div className="text-left">
              <div className="font-medium text-sm sm:text-base">Voice Calls</div>
              <div className="text-xs opacity-75 hidden sm:block">Call Management</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-12 sm:h-16 lg:h-20 border-2 border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300"
            onClick={() => navigate('/support-agent/map')}
          >
            <MapPin className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
            <div className="text-left">
              <div className="font-medium text-sm sm:text-base">Location Assist</div>
              <div className="text-xs opacity-75 hidden sm:block">Map Support</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-12 sm:h-16 lg:h-20 border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
            onClick={() => navigate('/support-agent/settings')}
          >
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
            <div className="text-left">
              <div className="font-medium text-sm sm:text-base">Availability</div>
              <div className="text-xs opacity-75 hidden sm:block">Set Status</div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}