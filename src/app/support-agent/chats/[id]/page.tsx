"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Clock,
  User,
  Loader2,
  Paperclip,
  Mic,
  Video,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  File,
  Download,
  Image,
  ExternalLink,
  ArrowLeft
} from "lucide-react";
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, getDoc, updateDoc, serverTimestamp, orderBy, limit, getDocs } from "firebase/firestore";
import { db, auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { translateText } from "@/ai/client";
import { useToast } from "@/hooks/use-toast";
import { MessageStatus } from "@/components/message-status";

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
  userEmail: string;
}

interface SupportAgentSettings {
  defaultLanguage: string;
  autoTranslate: boolean;
}

export default function IndividualChatPage() {
  const params = useParams();
  const chatId = params.id as string;
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<Record<string, {firstName: string, lastName: string, image?: string}>>({});
  const [settings, setSettings] = useState<SupportAgentSettings | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userSettings = userData.settings || {};
          setSettings({
            defaultLanguage: userData.language || userSettings.defaultLanguage || 'English',
            autoTranslate: userSettings.autoTranslate || false
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  // Handle media load errors with fallback
  function handleMediaError(attachment: Attachment, error: Error) {
    console.error(`Failed to load media ${attachment.type}: ${attachment.filename}`, error);
    toast({
      title: "Media Load Error",
      description: `Failed to load ${attachment.filename} (${attachment.type})`,
      variant: "destructive"
    });
  }

  // Load chat session data
  useEffect(() => {
    if (!chatId) return;

    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribe = onSnapshot(chatDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Get user profile data
        try {
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const session: ChatSession = {
              id: docSnap.id,
              userId: data.userId,
              userName: userData.displayName || userData.firstName || userData.email || 'Unknown User',
              userImage: userData.image,
              lastMessage: data.lastMessage || '',
              lastMessageTime: data.lastMessageTimestamp?.toDate() || new Date(),
              unreadCount: data.unreadCount || 0,
              status: data.status || 'active',
              language: userData.language || 'English',
              location: userData.location,
              userEmail: userData.email || ''
            };
            setChatSession(session);

            // Also set user data for agent
            const agentId = auth.currentUser?.uid;
            if (agentId) {
              const agentDoc = await getDoc(doc(db, 'users', agentId));
              if (agentDoc.exists()) {
                const agentData = agentDoc.data();
                setUserData({
                  [data.userId]: {
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    image: userData.image
                  },
                  [agentId]: {
                    firstName: agentData.firstName || '',
                    lastName: agentData.lastName || '',
                    image: agentData.image
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user data for chat:', error);
        }
      } else {
        toast({
          title: "Chat Not Found",
          description: "The requested chat session does not exist.",
          variant: "destructive"
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, toast]);

  // Load messages for the chat
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const msgs: Message[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data() as Message;
        let processedMessage = { ...data, id: doc.id };

        // No need for additional translation - dual translation is handled during message sending

        msgs.push(processedMessage);
      }
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
      }
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatId || !chatSession || sending) return;

    const agentId = auth.currentUser?.uid;
    if (!agentId) return;

    setSending(true);
    const originalText = inputValue;
    setInputValue('');

    try {
      // Get user and agent language preferences
      const userLanguage = chatSession.language || 'English';
      const agentLanguage = settings?.defaultLanguage || 'English';

      console.log('Agent sending message:', originalText);
      console.log('User language:', userLanguage);
      console.log('Agent language:', agentLanguage);

      // Dual translation: translate for both user and agent
      let userTranslatedText = originalText;
      let agentTranslatedText = originalText;

      if (originalText.trim()) {
        // Translate for user if different from English
        if (userLanguage !== 'English') {
          try {
            const translateFunction = httpsCallable(functions, 'translateText');
            const result = await translateFunction({ text: originalText, targetLanguage: userLanguage });
            userTranslatedText = (result.data as { translatedText: string }).translatedText;
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
            agentTranslatedText = (result.data as { translatedText: string }).translatedText;
            console.log('Agent translated text:', agentTranslatedText);
          } catch (error) {
            console.error('Agent translation error:', error);
            agentTranslatedText = originalText;
          }
        }
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        content: originalText, // Keep original for processing
        messageType: "text",
        originalText: originalText,
        userTranslatedText: userTranslatedText, // For user's display
        agentTranslatedText: agentTranslatedText, // For agent's display
        receiverId: chatSession.userId,
        senderEmail: auth.currentUser?.email || "",
        senderId: agentId,
        timestamp: serverTimestamp(),
        status: 'sent'
      });

      // Update last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: originalText,
        lastMessageTimestamp: serverTimestamp()
      });

    } catch (error) {
      console.error("Error sending message:", error);
      setInputValue(originalText);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleCloseChat = async () => {
    if (!chatId) return;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        status: 'closed',
        closedAt: serverTimestamp()
      });
      toast({ title: "Chat Closed", description: "Chat session has been closed" });
      // Navigate back to chat list
      window.location.href = '/support-agent/chats';
    } catch (error) {
      console.error("Error closing chat:", error);
      toast({ title: "Error", description: "Failed to close chat", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-spin" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3 sm:mb-4">
              Loading Chat...
            </h1>
          </div>
        </div>
      </div>
    );
  }

  if (!chatSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
              <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-3 sm:mb-4">
              Chat Not Found
            </h1>
            <p className="text-slate-600 text-sm sm:text-base lg:text-lg mb-6">
              The requested chat session does not exist or you don't have access to it.
            </p>
            <Link to="/support-agent">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link to="/support-agent">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
          <CardHeader className="flex-row items-center justify-between border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={chatSession.userImage} />
                <AvatarFallback>{chatSession.userName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg">{chatSession.userName}</p>
                <p className="text-sm text-muted-foreground">{chatSession.userEmail}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    {chatSession.language}
                  </Badge>
                  {chatSession.location && (
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {chatSession.location}
                    </Badge>
                  )}
                  <Badge
                    variant={chatSession.status === 'waiting' ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {chatSession.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast({ title: "Call Feature", description: "Voice calling will be available soon" })}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseChat}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Close Chat
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 h-[500px]">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.senderId === auth.currentUser?.uid ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.senderId !== auth.currentUser?.uid && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={chatSession.userImage} />
                      <AvatarFallback>{chatSession.userName[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-1 items-start">
                    <div className={`rounded-lg px-4 py-2 shadow-sm max-w-[400px] ${
                      message.senderId === auth.currentUser?.uid
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="space-y-2 mb-2">
                          {message.attachments.map((attachment, index) => (
                            <div key={index} className="rounded-lg bg-background/50 p-2 max-w-[300px] border border-slate-200">
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
                                      Failed to load {attachment.filename}
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
                                      Failed to load {attachment.filename}
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
                                      Failed to load {attachment.filename}
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
                                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                                    message.senderId === auth.currentUser?.uid
                                      ? "border-blue-400 bg-blue-700 hover:bg-blue-800"
                                      : "border-slate-300 bg-slate-50 hover:bg-slate-100"
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
                      {(message.content || message.userTranslatedText || message.agentTranslatedText) && (
                        <div>
                          {/* Display appropriate translation based on viewer role */}
                          <p className="text-sm break-words">
                            {message.agentTranslatedText || message.content}
                          </p>
                          {/* Show original text if translation exists */}
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

          <div className="p-4 border-t bg-background">
            <div className="relative flex-1">
              <Input
                placeholder="Type your response..."
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
                  {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}