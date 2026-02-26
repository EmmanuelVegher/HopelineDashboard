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
  Filter,
  Download,
  Eye,
  MapPin,
  Calendar,
  Globe,
  Clock
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, doc as firestoreDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
            `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || t('common.unknownUser') :
            data.userName || t('common.unknownUser');

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
            agentName: data.agentName || t('common.unknownAgent'),
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
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <History className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2 sm:mb-3 lg:mb-4">
            {t('supportAgent.history.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg px-4 sm:px-0">
            {t('supportAgent.history.subtitle')}
          </p>
        </div>

        {/* Filters and Search */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl w-full">
          <CardContent className="p-4 sm:p-6 lg:p-8 w-full">
            <div className="space-y-4 w-full">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('supportAgent.history.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 w-full"
                />
              </div>

              <div className="flex flex-col gap-3 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full h-12">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1day">{t('supportAgent.history.dateRange.lastDay')}</SelectItem>
                      <SelectItem value="7days">{t('supportAgent.history.dateRange.last7Days')}</SelectItem>
                      <SelectItem value="30days">{t('supportAgent.history.dateRange.last30Days')}</SelectItem>
                      <SelectItem value="90days">{t('supportAgent.history.dateRange.last90Days')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full h-12">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('supportAgent.history.status.all')}</SelectItem>
                      <SelectItem value="active">{t('supportAgent.history.status.active')}</SelectItem>
                      <SelectItem value="closed">{t('supportAgent.history.status.closed')}</SelectItem>
                      <SelectItem value="transferred">{t('supportAgent.history.status.transferred')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder={t('supportAgent.history.resolution.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('supportAgent.history.resolution.all')}</SelectItem>
                      <SelectItem value="resolved">{t('supportAgent.history.resolution.resolved')}</SelectItem>
                      <SelectItem value="transferred">{t('supportAgent.history.resolution.transferred')}</SelectItem>
                      <SelectItem value="abandoned">{t('supportAgent.history.resolution.abandoned')}</SelectItem>
                      <SelectItem value="pending">{t('supportAgent.history.resolution.pending')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" onClick={handleExportHistory} className="w-full h-12">
                  <Download className="h-4 w-4 mr-2" />
                  {t('supportAgent.history.exportData')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat History List */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl w-full">
          <CardHeader className="p-4 sm:p-6 lg:p-8 pb-4 w-full">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t('supportAgent.history.chatSessions')}
            </CardTitle>
            <CardDescription className="w-full truncate">
              {filteredHistory.length} {t('supportAgent.history.chatsFound')}
              {searchTerm && ` for "${searchTerm}"`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 w-full">
            {loading ? (
              <div className="p-4 sm:p-6 lg:p-8 space-y-4">
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
              <div className="p-6 sm:p-8 lg:p-12 text-center text-slate-500">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-base sm:text-lg">{t('supportAgent.history.noHistory')}</p>
                <p className="text-sm mt-2">{t('supportAgent.history.noHistoryDesc')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[50vh] sm:h-[60vh] lg:h-[600px] w-full overflow-x-hidden">
                <div className="grid grid-cols-1 gap-0 sm:gap-1 w-full overflow-x-hidden">
                  {filteredHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className="p-3 sm:p-4 border-b border-slate-100 hover:bg-muted/50 transition-colors w-full overflow-x-hidden"
                    >
                      <div className="flex flex-col gap-4 w-full overflow-x-hidden">
                        {/* Main content row */}
                        <div className="flex items-start gap-1 sm:gap-2 lg:gap-3 w-full min-w-0">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage src={chat.userImage} />
                            <AvatarFallback className="text-sm">
                              {chat.userFirstName && chat.userLastName
                                ? `${chat.userFirstName[0]}${chat.userLastName[0]}`
                                : chat.userName[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col gap-2 w-full">
                              {/* Name and badges row */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                                <p className="font-medium text-foreground truncate text-sm sm:text-base">{chat.userName}</p>
                                <div className="flex flex-wrap gap-1">
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
                              </div>

                              {/* Message */}
                              <p className="text-sm text-muted-foreground truncate w-full">
                                {chat.lastMessage === 'Attachment' ? t('supportAgent.chats.attachment') : chat.lastMessage}
                              </p>

                              {/* Metadata */}
                              <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 lg:gap-2 text-xs text-slate-500 overflow-x-hidden">
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Clock className="h-3 w-3" />
                                  <span className="hidden sm:inline truncate">{chat.lastMessageTime.toLocaleString()}</span>
                                  <span className="sm:hidden truncate">{chat.lastMessageTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                                {chat.duration && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Clock className="h-3 w-3" />
                                    <span className="truncate">{formatDuration(chat.duration)}</span>
                                  </div>
                                )}
                                {chat.location && (
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{chat.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 lg:gap-3 w-full">
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Badge
                              className={`text-xs px-2 py-1 justify-center ${getStatusColor(chat.status)} text-white`}
                            >
                              {t(`supportAgent.history.status.${chat.status}`)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-1 justify-center ${getResolutionColor(chat.resolution)} text-white border-transparent`}
                            >
                              {t(`supportAgent.history.resolution.${chat.resolution}`)}
                            </Badge>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewChat(chat.id)}
                            className="w-full sm:w-auto h-10 flex-shrink-0"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('supportAgent.history.view')}
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