"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Phone,
  MapPin,
  Globe,
  Loader2,
  Paperclip,
  CheckCircle,
  File,
  ExternalLink,
  Search,
  Plus,
  Video // ✅ Added Video import
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, addDoc, doc, setDoc, getDoc, updateDoc, serverTimestamp, limit, getDocs, increment } from "firebase/firestore";
import { db, auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useToast } from "@/hooks/use-toast";
import { MessageStatus } from "@/components/message-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { CallInterface } from "@/components/chat/call-interface";
import { useTranslation } from "react-i18next";

// generateChannelName is now defined locally, so no import needed. 
// Actually generateChannelName might be in admin chats page, let's check if we can import it or need to duplicate/move it.
// For now, let's assume we need to implement it or usage. AdminChats had it inline or imported? 
// Let's check AdminChats imports. 
// It was `import { generateChannelName } from "@/lib/utils";` (inferred). 
// Let's just import CallInterface for now.

interface ChatSession {
  id: string;
  userId: string;
  fullName: string;
  userImage?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  status: 'active' | 'waiting' | 'closed';
  language: string;
  location?: string;
  userEmail: string;
  participants?: string[];
}

interface Attachment {
  url: string;
  type: 'image' | 'video' | 'audio';
  filename: string;
  size?: number;
  duration?: number;
}

interface Message {
  id: string;
  content: string;
  messageType: string;
  originalText: string;
  receiverId: string;
  senderEmail: string;
  senderId: string;
  timestamp: any;
  userTranslatedText?: string; // Translation for the user
  agentTranslatedText?: string; // Translation for the agent
  attachments?: Attachment[];
  status?: 'sent' | 'delivered' | 'read';
}

interface SupportAgentSettings {
  defaultLanguage: string;
  autoTranslate: boolean;
}

export default function SupportAgentChatsPage() {
  const { t } = useTranslation();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<Record<string, { firstName: string, lastName: string, image?: string }>>({});
  const [fetchedUsers, setFetchedUsers] = useState<Set<string>>(new Set());
  const [recentMessages, setRecentMessages] = useState<Record<string, Message[]>>({});
  const [settings, setSettings] = useState<SupportAgentSettings | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const { users: allUsers } = useAdminData();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    chatId: string;
    channelName: string;
    recipientName: string;
    recipientImage?: string;
    callType: 'video' | 'voice';
    isIncoming: boolean;
  } | null>(null);

  const generateChannelName = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  const getAgentProfile = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !userData[uid]) return { name: t('common.roles.supportAgent'), avatar: '' };
    return {
      name: `${userData[uid].firstName} ${userData[uid].lastName}`.trim() || t('common.roles.supportAgent'),
      avatar: userData[uid].image || ''
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Load user settings with real-time sync
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      const user = auth.currentUser;
      if (!user) return;

      unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          const userSettings = userData.settings || {};
          setSettings({
            defaultLanguage: userData.language || userSettings.defaultLanguage || 'English',
            autoTranslate: userSettings.autoTranslate || false
          });
        }
      });
    };

    setupListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle media load errors with fallback
  function handleMediaError(attachment: Attachment, error: Error) {
    console.error(`Failed to load media ${attachment.type}: ${attachment.filename}`, error);
    toast({
      title: t('supportAgent.chats.mediaLoadError'),
      description: `${t('supportAgent.chats.failedToLoad')} ${attachment.filename} (${attachment.type})`,
      variant: "destructive"
    });
  }

  // Load active chat sessions
  useEffect(() => {
    const agentId = auth.currentUser?.uid;
    if (!agentId) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('status', 'in', ['active', 'waiting'])
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const sessions: ChatSession[] = [];
      for (const chatDoc of snapshot.docs) {
        const data = chatDoc.data();
        let language = data.userLanguage || 'English';

        // If userLanguage not set in chat, get from user profile
        if (!data.userLanguage) {
          try {
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as any;
              language = userData.language || 'English';
              // Update the chat document with the language
              await updateDoc(chatDoc.ref, { userLanguage: language });
            }
          } catch (error) {
            console.error('Error fetching user language:', error);
          }
        }

        const otherUserId = data.participants?.find((id: string) => id !== auth.currentUser?.uid) || data.userId;

        sessions.push({
          id: chatDoc.id,
          userId: otherUserId,
          fullName: t('common.unknownUser'),
          userImage: data.userImage,
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTimestamp?.toDate() || new Date(),
          unreadCount: data.unreadCount || 0,
          status: data.status || 'active',
          language: language,
          location: data.location,
          userEmail: data.userEmail || '',
          participants: data.participants
        });
      }
      setChatSessions(sessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch user data for chat sessions
  useEffect(() => {
    const agentId = auth.currentUser?.uid;
    const userIds = [...new Set([...chatSessions.map(c => c.userId), agentId].filter(id => id !== undefined))];
    const toFetch = userIds.filter(id => !fetchedUsers.has(id));
    if (toFetch.length === 0) return;

    const fetchPromises = toFetch.map(async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          return { userId, firstName: data.firstName || '', lastName: data.lastName || '', image: data.image };
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
      return { userId, firstName: '', lastName: '', image: undefined };
    });

    Promise.all(fetchPromises).then((results) => {
      setUserData(prev => {
        const newData = { ...prev };
        results.forEach(({ userId, firstName, lastName, image }) => {
          newData[userId] = { firstName, lastName, image };
        });
        return newData;
      });
    });
    setFetchedUsers(new Set([...fetchedUsers, ...toFetch]));
  }, [chatSessions, fetchedUsers]);

  // Fetch recent messages for chat sessions
  useEffect(() => {
    if (chatSessions.length === 0) return;

    const fetchRecentMessages = async () => {
      const promises = chatSessions.map(async (session) => {
        const q = query(
          collection(db, 'chats', session.id, 'messages'),
          orderBy('timestamp', 'desc'),
          limit(3)
        );
        const snapshot = await getDocs(q);
        const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message)).reverse();
        return { chatId: session.id, messages: msgs };
      });

      const results = await Promise.all(promises);
      const newRecent: Record<string, Message[]> = {};
      results.forEach(({ chatId, messages }) => {
        newRecent[chatId] = messages;
      });
      setRecentMessages(newRecent);
    };

    fetchRecentMessages();
  }, [chatSessions]);

  // Load messages for selected chat
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'chats', selectedChatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Message;
        msgs.push({ ...data, id: doc.id });
      });
      setMessages(msgs);

      // Update message status to 'delivered' for messages from users that haven't been delivered yet
      const agentId = auth.currentUser?.uid;
      if (agentId) {
        const undeliveredMessages = snapshot.docs.filter(doc => {
          const data = doc.data() as Message;
          return data.senderId !== agentId && (!data.status || data.status === 'sent');
        });

        undeliveredMessages.forEach(async (doc) => {
          await updateDoc(doc.ref, { status: 'delivered' });
        });

        // Update message status to 'read' for messages from users that are delivered but not read
        const unreadMessages = snapshot.docs.filter(doc => {
          const data = doc.data() as Message;
          return data.senderId !== agentId && data.status === 'delivered';
        });

        unreadMessages.forEach(async (doc) => {
          await updateDoc(doc.ref, { status: 'read' });
        });

        // Clear agent's unread count when they view the chat
        const chatRef = doc(db, 'chats', selectedChatId);
        getDoc(chatRef).then(snap => {
          if (snap.exists() && (snap.data().unreadCount || 0) > 0) {
            updateDoc(chatRef, { unreadCount: 0 });
          }
        });
      }
    });

    return () => unsubscribe();
  }, [selectedChatId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedChatId || sending) return;

    const agentId = auth.currentUser?.uid;
    if (!agentId) return;

    const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);
    if (!selectedChat) return;

    setSending(true);
    const originalText = inputValue;
    setInputValue('');

    try {
      // Get user profile for language
      const userDoc = await getDoc(doc(db, 'users', selectedChat.userId));
      const userProfile = userDoc.exists() ? userDoc.data() : null;

      // Dual translation: translate for both user and agent
      let userTranslatedText = originalText;
      let agentTranslatedText = originalText;

      if (originalText.trim()) {
        // Get language preferences
        const userLanguage = userProfile?.language || 'English';
        const agentLanguage = settings?.defaultLanguage || 'English';

        console.log('Agent sending - Original text:', originalText);
        console.log('User language:', userLanguage);
        console.log('Agent language:', agentLanguage);

        // Translate for user if different from English
        if (userLanguage !== 'English') {
          try {
            const translateFunction = httpsCallable(functions, 'translateText');
            const result = await translateFunction({ text: originalText, targetLanguage: userLanguage });
            userTranslatedText = (result.data as any).translatedText;
            console.log('User translated text:', userTranslatedText);
          } catch (error) {
            console.error('User translation error:', error);
            userTranslatedText = originalText;
          }
        }

        // Translate for agent if different from English
        if (agentLanguage !== 'English') {
          try {
            const translateFunction = httpsCallable(functions, 'translateText');
            const result = await translateFunction({ text: originalText, targetLanguage: agentLanguage });
            agentTranslatedText = (result.data as any).translatedText;
            console.log('Agent translated text:', agentTranslatedText);
          } catch (error) {
            console.error('Agent translation error:', error);
            agentTranslatedText = originalText;
          }
        }
      }

      const messagesRef = collection(db, 'chats', selectedChatId, 'messages');
      await addDoc(messagesRef, {
        content: originalText, // Keep original for processing
        messageType: "text",
        originalText: originalText,
        userTranslatedText: userTranslatedText, // For user's display
        agentTranslatedText: agentTranslatedText, // For agent's display
        receiverId: selectedChat.userId,
        senderEmail: auth.currentUser?.email || "",
        senderId: agentId,
        timestamp: serverTimestamp(),
        status: 'sent'
      });

      // Update last message and increment beneficiary's unread count
      await updateDoc(doc(db, 'chats', selectedChatId), {
        lastMessage: originalText,
        lastMessageTimestamp: serverTimestamp(),
        unreadCountBeneficiary: increment(1)
      });

    } catch (error) {
      console.error("Error sending message:", error);
      setInputValue(originalText);
      toast({ title: t('common.error'), description: t('supportAgent.chats.failedToSend'), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleCloseChat = async (chatId: string) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        status: 'closed',
        closedAt: serverTimestamp()
      });
      toast({ title: t('supportAgent.chats.chatClosed'), description: t('supportAgent.chats.chatClosedDesc') });
    } catch (error) {
      console.error("Error closing chat:", error);
      toast({ title: t('common.error'), description: t('supportAgent.chats.failedToCloseChat'), variant: "destructive" });
    }
  };

  const startNewChat = async (user: any) => {
    const agentId = auth.currentUser?.uid;
    if (!agentId) return;

    try {
      // Deterministic Chat ID
      const chatId = agentId < user.id ? `${agentId}_${user.id}` : `${user.id}_${agentId}`;
      const chatDocRef = doc(db, 'chats', chatId);
      const chatDocSnap = await getDoc(chatDocRef);

      if (chatDocSnap.exists()) {
        const chatData = chatDocSnap.data();
        // If it's a waiting chat or doesn't have an agent, assign yourself
        if (chatData.status === 'waiting' || !chatData.agentId) {
          await updateDoc(chatDocRef, {
            agentId: agentId,
            status: 'active'
          });
        }
      } else {
        // Create new unified chat document
        await setDoc(chatDocRef, {
          agentId: agentId,
          userId: user.id,
          userEmail: user.email || '',
          userImage: user.image || '',
          userLanguage: user.language || 'English',
          status: 'active',
          createdAt: serverTimestamp(),
          lastMessage: t('supportAgent.chats.conversationStarted'),
          lastMessageTimestamp: serverTimestamp(),
          unreadCount: 0,
          participants: [agentId, user.id],
          participantInfo: {
            [agentId]: {
              email: auth.currentUser?.email || '',
              name: t('common.roles.supportAgent'), // This could be better if we fetch own profile
              role: 'support agent'
            },
            [user.id]: {
              email: user.email || '',
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || 'User',
              role: user.role || 'user'
            }
          }
        });
      }

      setSelectedChatId(chatId);
      setIsNewChatOpen(false);

      // Add optimistic entry to userData
      setUserData(prev => ({
        ...prev,
        [user.id]: {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          image: user.image
        }
      }));

      toast({ title: t('supportAgent.chats.chatStartedWith', { name: user.firstName }), description: t('supportAgent.chats.chatStartedWith', { name: user.firstName }) });
    } catch (error) {
      console.error("Error starting chat:", error);
      toast({ title: t('common.error'), description: t('supportAgent.chats.failedToStartChat'), variant: "destructive" });
    }
  };

  const filteredUsers = allUsers?.filter(u =>
    u.id !== auth.currentUser?.uid &&
    (`${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()))
  ) || [];

  const sessionsWithNames = chatSessions
    .filter(session => {
      // Show only my chats or waiting chats
      return session.status === 'waiting' || (session.participants && session.participants.includes(auth.currentUser?.uid || ''));
    })
    .map(session => ({
      ...session,
      fullName: userData[session.userId] ? `${userData[session.userId].firstName} ${userData[session.userId].lastName}`.trim() || 'Unknown User' : 'Unknown User',
      userImage: userData[session.userId]?.image || session.userImage
    }))
    .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

  const selectedChat = sessionsWithNames.find(chat => chat.id === selectedChatId);

  // ✅ Render Call Interface if active
  if (activeCall) {
    return (
      <CallInterface
        callId={activeCall.callId}
        channelName={activeCall.channelName}
        recipientName={activeCall.recipientName}
        recipientImage={activeCall.recipientImage}
        userName={auth.currentUser?.displayName || t('common.roles.supportAgent')}
        userImage={auth.currentUser?.photoURL || ''}
        isIncoming={activeCall.isIncoming}
        onClose={() => setActiveCall(null)} // ✅ Changed onEndCall to onClose
        callType={activeCall.callType}
        chatId={activeCall.chatId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
              {t('supportAgent.chats.title')}
            </h1>
            <p className="text-muted-foreground">{t('supportAgent.chats.subtitle')}</p>
          </div>
          <Button onClick={() => setIsNewChatOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('supportAgent.chats.newConversation')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat Sessions List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">{t('supportAgent.chats.chatSessions')}</CardTitle>
              <CardDescription>{chatSessions.length} {t('supportAgent.chats.activeChats')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[800px]">
                {loading ? (
                  <div className="p-4 space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : chatSessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('supportAgent.chats.noActiveChats')}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sessionsWithNames.map((chat) => (
                      <div
                        key={chat.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border-l-4 ${selectedChatId === chat.id
                          ? 'border-primary bg-muted/50'
                          : 'border-transparent'
                          }`}
                        onClick={() => setSelectedChatId(chat.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={chat.userImage} />
                            <AvatarFallback>{chat.fullName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground break-words">{chat.fullName}</p>
                              <div className="flex items-center gap-1">
                                {chat.unreadCount > 0 && (
                                  <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
                                    {chat.unreadCount}
                                  </Badge>
                                )}
                                <Badge
                                  variant={chat.status === 'waiting' ? 'secondary' : 'default'}
                                  className="text-xs"
                                >
                                  {chat.status}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground break-words">{chat.lastMessage}</p>
                            {recentMessages[chat.id] && recentMessages[chat.id].length > 0 && (
                              <div className="mt-2 space-y-1">
                                {recentMessages[chat.id].slice(-2).map((msg, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <div className={`text-xs px-2 py-1 rounded-md max-w-[200px] break-words ${msg.senderId === auth.currentUser?.uid
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                      }`}>
                                      {msg.content || (msg.attachments ? t('supportAgent.chats.attachment') : t('supportAgent.chats.message'))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                <Globe className="h-3 w-3 mr-1" />
                                {chat.language}
                              </Badge>
                              {chat.location && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {chat.location}
                                </Badge>
                              )}
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

          {/* Chat Interface */}
          <Card className="lg:col-span-1">
            {selectedChat ? (
              <>
                <CardHeader className="flex-row items-center justify-between border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedChat.userImage} />
                      <AvatarFallback>{selectedChat.fullName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedChat.fullName}</p>
                      <p className="text-sm text-muted-foreground">{selectedChat.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">


                    <div className="flex flex-col gap-2">


                      <Button variant="outline" size="sm" onClick={() => {
                        if (selectedChat && auth.currentUser) {
                          const channelName = generateChannelName(auth.currentUser.uid, selectedChat.userId);
                          const callDocRef = doc(collection(db, 'calls')); // Generate ID first

                          // We'll treat this as starting call logic similar to Admin
                          // But we need to actually create the call doc
                          const startCall = async (type: 'voice' | 'video') => {
                            try {
                              const agent = getAgentProfile();
                              await setDoc(callDocRef, {
                                userId: selectedChat.userId,
                                agentId: auth.currentUser!.uid,
                                userName: selectedChat.fullName,
                                userImage: selectedChat.userImage || '',
                                agentName: agent.name,
                                agentImage: agent.avatar,
                                callerName: agent.name,
                                callerAvatar: agent.avatar,
                                callType: type,
                                chatId: selectedChat.id,
                                channelName: channelName,
                                callerId: auth.currentUser!.uid,
                                receiverId: selectedChat.userId,
                                isGroupCall: false,
                                status: 'ringing',
                                startTime: serverTimestamp(),
                                acceptedAt: null,
                                endTime: null,
                                duration: 0,
                                language: 'en',
                                location: '',
                                priority: 'normal',
                                participants: [auth.currentUser!.uid, selectedChat.userId]
                              });

                              setActiveCall({
                                callId: callDocRef.id,
                                chatId: selectedChat.id,
                                channelName: channelName,
                                recipientName: selectedChat.fullName,
                                recipientImage: selectedChat.userImage,
                                callType: type,
                                isIncoming: false
                              });
                            } catch (e) {
                              console.error("Error starting call:", e);
                              toast({ title: "Error", description: "Failed to start call", variant: "destructive" });
                            }
                          };

                          startCall('voice');
                        }
                      }}>
                        <Phone className="h-4 w-4 mr-2" />
                        {t('supportAgent.chats.call')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        if (selectedChat && auth.currentUser) {
                          const channelName = generateChannelName(auth.currentUser.uid, selectedChat.userId);
                          const callDocRef = doc(collection(db, 'calls'));

                          const startCall = async (type: 'voice' | 'video') => {
                            try {
                              const agent = getAgentProfile();
                              await setDoc(callDocRef, {
                                userId: selectedChat.userId,
                                agentId: auth.currentUser!.uid,
                                userName: selectedChat.fullName,
                                userImage: selectedChat.userImage || '',
                                agentName: agent.name,
                                agentImage: agent.avatar,
                                callerName: agent.name,
                                callerAvatar: agent.avatar,
                                callType: type,
                                chatId: selectedChat.id,
                                channelName: channelName,
                                callerId: auth.currentUser!.uid,
                                receiverId: selectedChat.userId,
                                isGroupCall: false,
                                status: 'ringing',
                                startTime: serverTimestamp(),
                                acceptedAt: null,
                                endTime: null,
                                duration: 0,
                                language: 'en',
                                location: '',
                                priority: 'normal',
                                participants: [auth.currentUser!.uid, selectedChat.userId]
                              });

                              setActiveCall({
                                callId: callDocRef.id,
                                chatId: selectedChat.id,
                                channelName: channelName,
                                recipientName: selectedChat.fullName,
                                recipientImage: selectedChat.userImage,
                                callType: type,
                                isIncoming: false
                              });
                            } catch (e) {
                              console.error("Error starting call:", e);
                              toast({ title: "Error", description: "Failed to start call", variant: "destructive" });
                            }
                          };

                          startCall('video');
                        }
                      }}>
                        <Video className="h-4 w-4 mr-2" />
                        {t('supportAgent.chats.videoCall')}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloseChat(selectedChat.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('supportAgent.chats.closeChat')}
                      </Button>

                    </div>
                  </div>

                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 h-[400px]">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t('supportAgent.chats.startConversation')}</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 ${message.senderId === auth.currentUser?.uid ? "justify-end" : "justify-start"
                          }`}
                      >
                        {message.senderId !== auth.currentUser?.uid && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={selectedChat.userImage} />
                            <AvatarFallback>{selectedChat.fullName[0]}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col gap-1 items-start">
                          <div className={`rounded-lg px-4 py-2 shadow-sm ${message.senderId === auth.currentUser?.uid
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                            }`}>
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="space-y-2 mb-2">
                                {message.attachments.map((attachment, index) => (
                                  <div key={index} className="rounded-lg bg-muted/50 p-2 max-w-[300px] border border-border">
                                    {attachment.type === 'image' ? (
                                      <>
                                        <div className="relative">
                                          <img
                                            src={attachment.url}
                                            alt={attachment.filename}
                                            className="max-w-full h-auto rounded-lg max-h-[192px] object-cover cursor-pointer"
                                            onClick={() => window.open(attachment.url, '_blank')}
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              const errorElement = e.currentTarget.nextElementSibling as HTMLElement;
                                              if (errorElement) {
                                                errorElement.classList.remove('hidden');
                                              }
                                              handleMediaError(attachment, new Error(`Image failed to load: ${attachment.url}`));
                                            }}
                                          />
                                          <div className="hidden text-xs text-red-500 mt-1">
                                            {t('supportAgent.chats.failedToLoad')} {attachment.filename}
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                          <p className="text-xs text-muted-foreground break-words">
                                            {attachment.filename}
                                          </p>
                                          {attachment.size && (
                                            <span className="text-xs text-muted-foreground">
                                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    ) : attachment.type === 'video' ? (
                                      <>
                                        <div className="relative">
                                          <video
                                            src={attachment.url}
                                            controls
                                            className="max-w-full h-auto rounded-lg max-h-[192px]"
                                            preload="metadata"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              const errorElement = e.currentTarget.nextElementSibling as HTMLElement;
                                              if (errorElement) {
                                                errorElement.classList.remove('hidden');
                                              }
                                              handleMediaError(attachment, new Error(`Video failed to load: ${attachment.url}`));
                                            }}
                                          />
                                          <div className="hidden text-xs text-red-500 mt-1">
                                            {t('supportAgent.chats.failedToLoad')} {attachment.filename}
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                          <p className="text-xs text-muted-foreground break-words">
                                            {attachment.filename}
                                          </p>
                                          {attachment.size && (
                                            <span className="text-xs text-muted-foreground">
                                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    ) : attachment.type === 'audio' ? (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <audio
                                            src={attachment.url}
                                            controls
                                            className="flex-1"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              const errorElement = e.currentTarget.nextElementSibling as HTMLElement;
                                              if (errorElement) {
                                                errorElement.classList.remove('hidden');
                                              }
                                              handleMediaError(attachment, new Error(`Audio failed to load: ${attachment.url}`));
                                            }}
                                          />
                                          <div className="hidden text-xs text-red-500">
                                            {t('supportAgent.chats.failedToLoad')} {attachment.filename}
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                          <p className="text-xs text-muted-foreground break-words">
                                            {attachment.filename}
                                          </p>
                                          {attachment.size && (
                                            <span className="text-xs text-muted-foreground">
                                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <a
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${message.senderId === auth.currentUser?.uid
                                          ? "border-primary bg-primary hover:bg-primary/90"
                                          : "border-border bg-muted hover:bg-muted/80"
                                          }`}
                                      >
                                        <File className="h-4 w-4" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium break-words">{attachment.filename}</p>
                                          {attachment.size && (
                                            <p className="text-xs opacity-70">
                                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                          )}
                                        </div>
                                        <ExternalLink className="h-4 w-4 opacity-70" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {(message.content || message.agentTranslatedText) && (
                              <div>
                                <p className="text-sm break-words">
                                  {message.agentTranslatedText || message.content}
                                </p>
                                {message.agentTranslatedText && message.agentTranslatedText !== message.content && (
                                  <p className="text-xs text-muted-foreground mt-1 break-words">
                                    Original: {message.content}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 px-2">
                            <p className="text-xs text-muted-foreground">
                              {message.timestamp?.toDate().toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {message.senderId === auth.currentUser?.uid && (
                              <MessageStatus status={message.status} />
                            )}
                          </div>
                        </div>
                        {message.senderId === auth.currentUser?.uid && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={userData[auth.currentUser?.uid]?.image} />
                            <AvatarFallback>SA</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </CardContent>
                <div className="p-4 border-t bg-card">
                  <div className="relative flex-1">
                    <Input
                      placeholder={t('supportAgent.chats.typeResponse')}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="pr-20 pl-10"
                      disabled={sending}
                    />
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
                      <Button variant="ghost" size="icon" aria-label="Attach file">
                        <Paperclip className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        className="h-8 w-8 rounded-full"
                        disabled={!inputValue.trim() || sending}
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[600px] flex items-center justify-center text-center">
                <div>
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t('supportAgent.chats.selectChat')}</h3>
                  <p className="text-muted-foreground">{t('supportAgent.chats.selectChatDesc')}</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('supportAgent.chats.newConversation')}</DialogTitle>
            <DialogDescription>{t('supportAgent.chats.searchUsersDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('supportAgent.chats.searchUsersPlaceholder')}
                className="pl-9"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">{t('supportAgent.chats.noMatchingUsers')}</p>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition-colors"
                      onClick={() => startNewChat(user)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image} />
                        <AvatarFallback>{user.firstName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase">{user.role}</Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}