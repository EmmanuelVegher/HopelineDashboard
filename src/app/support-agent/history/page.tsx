"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History,
  Search,
  MessageSquare,
  Phone,
  Clock,
  Filter,
  Download,
  Eye,
  Globe,
  MapPin,
  Calendar,
  User
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, doc as firestoreDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface ChatHistory {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  lastMessage: string;
  lastMessageTime: Date;
  status: 'active' | 'closed' | 'transferred';
  language: string;
  location?: string;
  agentId: string;
  agentName: string;
  duration?: number;
  messageCount: number;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  resolution: 'resolved' | 'transferred' | 'abandoned' | 'pending';
  userFirstName?: string;
  userLastName?: string;
}

export default function SupportAgentHistoryPage() {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ChatHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resolutionFilter, setResolutionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7days');
  const { toast } = useToast();

  useEffect(() => {
    loadChatHistory();
  }, [dateRange]);

  useEffect(() => {
    filterChats();
  }, [chatHistory, searchTerm, statusFilter, resolutionFilter]);

  const loadChatHistory = async () => {
    const agentId = auth.currentUser?.uid;
    if (!agentId) return;

    setLoading(true);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case '1day':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    try {
      // Query chats handled by this agent
      const chatsQuery = query(
        collection(db, 'chats'),
        where('agentId', '==', agentId),
        where('lastMessageTimestamp', '>=', startDate),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(100)
      );

      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chats: ChatHistory[] = [];

        for (const doc of snapshot.docs) {
          const data = doc.data();

          // Get message count
          const messagesQuery = query(collection(db, 'chats', doc.id, 'messages'));
          const messagesSnapshot = await getDocs(messagesQuery);

          // Fetch user profile for full name and image
          let userProfile = null;
          try {
            const userDoc = await getDoc(firestoreDoc(db, 'users', data.userId));
            if (userDoc.exists()) {
              userProfile = userDoc.data();
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }

          const fullName = userProfile ?
            `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Unknown User' :
            data.userName || 'Unknown User';

          chats.push({
            id: doc.id,
            userId: data.userId,
            userName: fullName,
            userImage: userProfile?.image || data.userImage,
            userFirstName: userProfile?.firstName,
            userLastName: userProfile?.lastName,
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTimestamp?.toDate() || new Date(),
            status: data.status || 'closed',
            language: data.language || 'English',
            location: data.location,
            agentId: data.agentId,
            agentName: data.agentName || 'Unknown Agent',
            duration: data.duration,
            messageCount: messagesSnapshot.size,
            priority: data.priority || 'medium',
            resolution: data.resolution || 'pending'
          });
        }

        setChatHistory(chats);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error loading chat history:", error);
      setLoading(false);
      toast({ title: "Error", description: "Failed to load chat history", variant: "destructive" });
    }
  };

  const filterChats = () => {
    let filtered = chatHistory;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(chat =>
        chat.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.language.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(chat => chat.status === statusFilter);
    }

    // Resolution filter
    if (resolutionFilter !== 'all') {
      filtered = filtered.filter(chat => chat.resolution === resolutionFilter);
    }

    setFilteredHistory(filtered);
  };

  const handleViewChat = (chatId: string) => {
    // Navigate to chat interface (could be a modal or separate page)
    window.location.href = `/support-agent/chats/${chatId}`;
  };

  const handleExportHistory = () => {
    // Export chat history as CSV
    const csvData = filteredHistory.map(chat => ({
      'User Name': chat.userName,
      'Language': chat.language,
      'Last Message': chat.lastMessage,
      'Last Message Time': chat.lastMessageTime.toLocaleString(),
      'Status': chat.status,
      'Resolution': chat.resolution,
      'Message Count': chat.messageCount,
      'Duration (minutes)': chat.duration ? Math.round(chat.duration / 60) : 0,
      'Priority': chat.priority
    }));

    const csvString = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: "Chat history exported successfully" });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'closed': return 'bg-muted';
      case 'transferred': return 'bg-orange-500';
      default: return 'bg-primary';
    }
  };

  const getResolutionColor = (resolution: string) => {
    switch (resolution) {
      case 'resolved': return 'bg-green-500';
      case 'transferred': return 'bg-orange-500';
      case 'abandoned': return 'bg-destructive';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <History className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-3 sm:mb-4">
            Chat History
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            Review and analyze past support conversations
          </p>
        </div>

        {/* Filters and Search */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by user name, message, or language..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-32">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1day">Last Day</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="90days">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resolutions</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={handleExportHistory}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat History List */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat Sessions
            </CardTitle>
            <CardDescription>
              {filteredHistory.length} chats found
              {searchTerm && ` for "${searchTerm}"`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-full animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded animate-pulse w-1/4" />
                      <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No chat history found</p>
                <p className="text-sm mt-2">Try adjusting your filters or date range</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-1">
                  {filteredHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className="p-4 border-b border-slate-100 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={chat.userImage} />
                            <AvatarFallback>
                              {chat.userFirstName && chat.userLastName
                                ? `${chat.userFirstName[0]}${chat.userLastName[0]}`
                                : chat.userName[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground truncate">{chat.userName}</p>
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0.5"
                              >
                                <Globe className="h-3 w-3 mr-1" />
                                {chat.language}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0.5"
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {chat.messageCount}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate max-w-md">{chat.lastMessage}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="h-3 w-3" />
                                {chat.lastMessageTime.toLocaleString()}
                              </div>
                              {chat.duration && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(chat.duration)}
                                </div>
                              )}
                              {chat.location && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <MapPin className="h-3 w-3" />
                                  {chat.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              className={`text-xs ${getStatusColor(chat.status)} text-white`}
                            >
                              {chat.status}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getResolutionColor(chat.resolution)} text-white border-transparent`}
                            >
                              {chat.resolution}
                            </Badge>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewChat(chat.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}