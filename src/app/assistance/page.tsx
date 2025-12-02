
"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Phone, MessageSquare, Video, Mic, Paperclip, Clock, Languages, HeartPulse, Bus, Utensils, Home, FileText, HeartHandshake, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { auth, db } from "@/lib/firebase"
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, serverTimestamp, Timestamp, doc, setDoc, limit, getDoc } from "firebase/firestore"
import { useAuthState } from "react-firebase-hooks/auth"
import type { UserProfile } from "@/lib/data"
import { Skeleton } from "@/components/ui/skeleton"
import { translateText } from "@/ai/client"

type Message = {
    id: string;
    text: string;
    translatedText?: string;
    senderId: string;
    timestamp: Timestamp | null;
}

const assistanceTypes = [
    { title: "Shelter Support", description: "Help finding and accessing safe shelters", icon: Home },
    { title: "Food & Water", description: "Emergency food distribution and clean water", icon: Utensils },
    { title: "Medical Assistance", description: "Emergency medical care and health services", icon: HeartPulse },
    { title: "Psychological Support", description: "Mental health and trauma counseling", icon: HeartHandshake },
    { title: "Transportation", description: "Safe transport to shelters or medical facilities", icon: Bus },
    { title: "Legal Aid", description: "Legal assistance and documentation support", icon: FileText },
]

export default function AssistancePage() {
    const [user, authLoading] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [chatId, setChatId] = useState<string | null>(null);
    const [chatLoading, setChatLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [supportAgent, setSupportAgent] = useState<UserProfile | null>(null);

    const messagesEndRef = useRef<null | HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(scrollToBottom, [messages]);
    
    const getOrCreateChat = useCallback(async (userId: string, agent: UserProfile) => {
        setChatLoading(true);
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', userId));
        
        try {
            const querySnapshot = await getDocs(q);
            let existingChat: { id: string, data: any } | null = null;
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.participants.includes(agent.uid)) {
                    existingChat = { id: doc.id, data };
                }
            });

            if (existingChat) {
                setChatId(existingChat.id);
            } else {
                const newChatRef = doc(collection(db, "chats"));
                await setDoc(newChatRef, {
                    participants: [userId, agent.uid],
                    participantInfo: {
                        [userId]: { email: user?.email },
                        [agent.uid]: { email: agent.email }
                    },
                    createdAt: serverTimestamp(),
                    lastMessage: ""
                });
                setChatId(newChatRef.id);
            }
        } catch (error) {
            console.error("Error getting or creating chat:", error);
        } finally {
            setChatLoading(false);
        }
    }, [user?.email]);

     useEffect(() => {
        const fetchUserProfile = async () => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setUserProfile(userDoc.data() as UserProfile);
                }
            }
        };
        fetchUserProfile();
    }, [user]);

    useEffect(() => {
        const findSupportAgentAndInitChat = async () => {
            if (user) {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('role', '==', 'Support Agent'), where('isOnline', '==', true), limit(1));
                
                try {
                    const agentSnapshot = await getDocs(q);
                    if (!agentSnapshot.empty) {
                        const agentData = agentSnapshot.docs[0].data() as UserProfile;
                        setSupportAgent(agentData);
                        getOrCreateChat(user.uid, agentData);
                    } else {
                        console.log("No online support agents available.");
                        // Handle case where no agent is available
                        setChatLoading(false);
                    }
                } catch (error) {
                    console.error("Error finding support agent:", error);
                    setChatLoading(false);
                }
            } else if (!authLoading) {
                setChatLoading(false);
            }
        };
        
        findSupportAgentAndInitChat();

    }, [user, authLoading, getOrCreateChat]);

    useEffect(() => {
        if (!chatId || !user || !userProfile) return;

        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const msgs: Message[] = [];
            for (const doc of querySnapshot.docs) {
                const data = doc.data() as Message;
                if (data.senderId !== user.uid && userProfile.language && userProfile.language !== 'English') {
                    const translationResult = await translateText({ text: data.text, targetLanguage: userProfile.language });
                    msgs.push({ ...data, id: doc.id, translatedText: translationResult.translatedText });
                } else {
                    msgs.push({ ...data, id: doc.id });
                }
            }
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [chatId, user, userProfile]);


    const handleSend = async () => {
        if (!inputValue.trim() || !user || !chatId || sending) {
            return;
        }
        setSending(true);
        const text = inputValue;
        setInputValue('');

        try {
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            await addDoc(messagesRef, {
                text: text,
                senderId: user.uid,
                timestamp: serverTimestamp(),
            });

            // Also update the lastMessage on the chat document
            await setDoc(doc(db, 'chats', chatId), { lastMessage: text, lastMessageTimestamp: serverTimestamp() }, { merge: true });

        } catch (error) {
            console.error("Error sending message:", error);
            setInputValue(text);
        } finally {
            setSending(false);
        }
    }
    
    const renderChat = () => {
        if (authLoading || chatLoading) {
            return <div className="flex flex-col justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/><p className="mt-2 text-muted-foreground">Connecting to support...</p></div>
        }
        if (!user) {
            return <div className="flex justify-center items-center h-full"><p>Please log in to use the chat.</p></div>
        }
        if (!supportAgent) {
            return <div className="flex flex-col justify-center items-center h-full text-center"><p className="font-semibold">No Support Agents Available</p><p className="text-muted-foreground">We're sorry, but no support agents are currently online. Please try again later or use our other contact methods.</p></div>
        }
         return (
            <>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length === 0 && !chatLoading && (
                    <div className="text-center text-muted-foreground">
                        <p>No messages yet.</p>
                        <p>Say hello to start the conversation with {supportAgent.email}!</p>
                    </div>
                )}
                {messages.map(message => (
                    <div key={message.id} className={cn("flex items-end gap-2", message.senderId === user.uid ? "justify-end" : "justify-start")}>
                        {message.senderId !== user.uid && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="https://placehold.co/100x100" alt="Support" data-ai-hint="support agent"/>
                                <AvatarFallback>{supportAgent.email?.[0].toUpperCase() ?? 'S'}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className="flex flex-col gap-1 items-start">
                            <div className={cn("rounded-lg px-4 py-2 max-w-sm shadow-sm", message.senderId === user.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                <p className="text-sm">{message.translatedText || message.text}</p>
                                {message.translatedText && <p className="text-xs text-gray-500 italic mt-1">Original: {message.text}</p>}
                            </div>
                            <p className="text-xs text-muted-foreground px-2">
                                {message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                            </p>
                        </div>
                        {message.senderId === user.uid && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="https://placehold.co/100x100" alt="User" />
                                <AvatarFallback>{user.email?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </CardContent>
            <CardFooter className="p-2 border-t bg-background">
                <div className="relative flex-1">
                    <Input
                        placeholder="Type your message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="pr-20 pl-10"
                        disabled={!chatId || sending}
                    />
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
                        <Button variant="ghost" size="icon" aria-label="Attach file">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        <Button size="icon" onClick={handleSend} className="h-8 w-8 rounded-full" disabled={!inputValue.trim() || sending}>
                            {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                        </Button>
                    </div>
                </div>
            </CardFooter>
            </>
        )
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Get Assistance</h1>
                <p className="text-muted-foreground mt-2">Connect with our support teams via chat or phone for immediate assistance</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>What kind of assistance do you need?</CardTitle>
                    <CardDescription>Select the type of help you need for faster assistance</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assistanceTypes.map((item) => (
                        <Card key={item.title} className="p-4 flex flex-col items-start hover:bg-gray-50 cursor-pointer">
                            <item.icon className="h-6 w-6 mb-2 text-primary"/>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </Card>
                    ))}
                </CardContent>
            </Card>

            <Tabs defaultValue="chat" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chat"><MessageSquare className="mr-2 h-4 w-4"/> Live Chat</TabsTrigger>
                    <TabsTrigger value="call"><Phone className="mr-2 h-4 w-4"/> Voice Call</TabsTrigger>
                </TabsList>
                <TabsContent value="chat">
                    <Card className="h-[calc(100vh-32rem)] flex flex-col shadow-lg">
                        <CardHeader className="flex-row items-center justify-between border-b p-4">
                            <div className="flex items-center gap-3">
                                {supportAgent ? (
                                    <>
                                        <div className="relative">
                                            <Avatar className="h-10 w-10 border">
                                                <AvatarImage src="https://placehold.co/100x100" alt={supportAgent.email ?? 'Support Agent'} data-ai-hint="support agent" />
                                                <AvatarFallback>{supportAgent.email?.[0].toUpperCase() ?? 'S'}</AvatarFallback>
                                            </Avatar>
                                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                                        </div>
                                        <div>
                                            <p className="font-semibold">{supportAgent.email}</p>
                                            <p className="text-sm text-muted-foreground">Online - Support Agent</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-[150px]" />
                                            <Skeleton className="h-3 w-[100px]" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon"><Video className="h-5 w-5"/></Button>
                                <Button variant="ghost" size="icon"><Mic className="h-5 w-5"/></Button>
                            </div>
                        </CardHeader>
                        {renderChat()}
                    </Card>
                </TabsContent>
                <TabsContent value="call">
                     <Card className="h-[calc(100vh-32rem)] flex flex-col items-center justify-center shadow-lg p-6 text-center">
                         <CardHeader>
                            <CardTitle>Voice Call Support</CardTitle>
                            <CardDescription>Our support agents are ready to assist you over the phone.</CardDescription>
                         </CardHeader>
                         <CardContent className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-primary/10 rounded-full">
                                <Phone className="h-10 w-10 text-primary" />
                            </div>
                            <p className="text-muted-foreground">Click the button below to start a call.</p>
                            <Button size="lg" asChild>
                                <a href="tel:+234-800-123-4567"><Phone className="mr-2"/> Start Call</a>
                            </Button>
                         </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="bg-gray-50">
                <CardContent className="p-6 text-center">
                    <h3 className="font-semibold mb-2">24/7 Emergency Support Available</h3>
                    <p className="text-sm text-muted-foreground mb-4">Our assistance teams are available around the clock for emergency situations</p>
                    <div className="flex justify-center items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>Response time: &lt; 5 minutes</span>
                        </div>
                         <div className="flex items-center gap-2">
                            <Languages className="h-4 w-4 text-primary" />
                            <span>Multilingual support</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    )
}
