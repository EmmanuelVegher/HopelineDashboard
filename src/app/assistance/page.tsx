
"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Phone, MessageSquare, Video, Mic, Paperclip, Clock, Languages, HeartPulse, Bus, Utensils, Home, FileText, HeartHandshake, Loader2, Image, Camera, Mic as MicIcon, X, Play, Pause } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { auth, db } from "@/lib/firebase"
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, serverTimestamp, Timestamp, doc, setDoc, limit, getDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useToast } from "@/hooks/use-toast"
import { useAuthState } from "react-firebase-hooks/auth"
import type { UserProfile } from "@/lib/data"
import { Skeleton } from "@/components/ui/skeleton"
import { translateText } from "@/ai/client"

type Message = {
    id: string;
    content: string;
    messageType: string;
    originalText: string;
    receiverId: string;
    senderEmail: string;
    senderId: string;
    timestamp: Timestamp | null;
    translatedText?: string;
    attachments?: {
        type: 'image' | 'video' | 'audio';
        url: string;
        filename: string;
        size: number;
        duration?: number; // for audio/video
    }[];
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
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [uploadingAttachments, setUploadingAttachments] = useState(false);
    const { toast } = useToast();

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

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.participants && data.participants.includes(agent.uid)) {
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
                    lastMessage: "",
                    status: "active",
                    userId: userId,
                    agentId: agent.uid
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
                const q = query(usersRef, where('role', '==', 'support agent'), where('isOnline', '==', true), where('settings.allowDirectMessages', '==', true), limit(1));

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

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs: Message[] = [];
            querySnapshot.docs.forEach((doc) => {
                const data = doc.data() as Message;
                msgs.push({ ...data, id: doc.id });
            });
            setMessages(msgs);

            // Handle translation asynchronously after setting messages
            if (userProfile.language && userProfile.language !== 'English') {
                msgs.forEach(async (msg, index) => {
                    if (msg.senderId !== user.uid && msg.content && !msg.translatedText) {
                        try {
                            const translationResult = await translateText({ text: msg.content, targetLanguage: userProfile.language });
                            setMessages(prevMsgs =>
                                prevMsgs.map(m =>
                                    m.id === msg.id
                                        ? { ...m, translatedText: translationResult.translatedText }
                                        : m
                                )
                            );
                        } catch (error) {
                            console.error('Translation error:', error);
                        }
                    }
                });
            }
        });

        return () => unsubscribe();
    }, [chatId, user, userProfile]);


    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const newFiles = Array.from(files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
        // Reset the input
        event.target.value = '';
    };

    const handleImageCapture = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use back camera on mobile
        input.onchange = (e) => handleFileSelect(e as any);
        input.click();
    };

    const handleVideoCapture = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.capture = 'environment';
        input.onchange = (e) => handleFileSelect(e as any);
        input.click();
    };

    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                const audioBlob = new Blob(chunks, { type: 'audio/wav' });
                const audioFile = new File([audioBlob], `voice-recording-${Date.now()}.wav`, { type: 'audio/wav' });
                setAttachments(prev => [...prev, audioFile]);
                setRecordedChunks([]);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            setMediaRecorder(recorder);
            setRecordedChunks(chunks);
            recorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error starting voice recording:', error);
            toast({ title: "Error", description: "Could not access microphone", variant: "destructive" });
        }
    };

    const stopVoiceRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const uploadAttachments = async (files: File[]): Promise<{ type: 'image' | 'video' | 'audio'; url: string; filename: string; size: number; duration?: number }[]> => {
        const storage = getStorage();
        const uploadedAttachments: { type: 'image' | 'video' | 'audio'; url: string; filename: string; size: number; duration?: number }[] = [];

        for (const file of files) {
            try {
                const fileType = (file.type.startsWith('image/') ? 'image' :
                                file.type.startsWith('video/') ? 'video' : 'audio') as 'image' | 'video' | 'audio';

                const fileName = `${Date.now()}-${file.name}`;
                const storageRef = ref(storage, `chat-attachments/${chatId}/${fileName}`);

                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                const attachment: any = {
                    type: fileType,
                    url: downloadURL,
                    filename: file.name,
                    size: file.size
                };

                // Only add duration for audio files
                if (fileType === 'audio') {
                    attachment.duration = 0; // Could calculate actual duration for audio
                }

                // Double-check that all required fields are present and valid
                if (attachment.url && attachment.filename && typeof attachment.size === 'number' && attachment.type) {
                    uploadedAttachments.push(attachment);
                } else {
                    console.error('Invalid attachment object:', attachment);
                    throw new Error(`Invalid attachment: missing required fields for ${file.name}`);
                }
            } catch (error) {
                console.error('Error uploading file:', file.name, error);
                // Continue with other files instead of failing completely
            }
        }

        return uploadedAttachments;
    };

    const handleSend = async () => {
        if ((!inputValue.trim() && attachments.length === 0) || !user || !chatId || sending) {
            return;
        }

        setSending(true);
        const text = inputValue;
        setInputValue('');

        try {
            let uploadedAttachments: any[] = [];

            if (attachments.length > 0) {
                setUploadingAttachments(true);
                uploadedAttachments = await uploadAttachments(attachments);
                setAttachments([]);
                setUploadingAttachments(false);
            }

            // Validate all required fields before creating message
            const receiverId = supportAgent?.uid;
            const senderEmail = user.email;
            const senderId = user.uid;

            if (!receiverId || !senderEmail || !senderId) {
                throw new Error('Missing required user information');
            }

            // Filter out any undefined attachments
            const validAttachments = uploadedAttachments.filter(att => att && att.url && att.filename);

            const messageData: any = {
                content: text || "",
                messageType: validAttachments.length > 0 ? "media" : "text",
                originalText: text || "",
                receiverId: receiverId,
                senderEmail: senderEmail,
                senderId: senderId,
                timestamp: serverTimestamp(),
                translatedText: text || ""
            };

            // Only add attachments field if there are valid attachments
            if (validAttachments.length > 0) {
                messageData.attachments = validAttachments;
            }

            const messagesRef = collection(db, 'chats', chatId, 'messages');
            await addDoc(messagesRef, messageData);

            // Also update the lastMessage on the chat document
            const lastMessage = uploadedAttachments.length > 0 ?
                `📎 ${uploadedAttachments.length} attachment${uploadedAttachments.length > 1 ? 's' : ''}${text ? ': ' + text : ''}` :
                text;
            await setDoc(doc(db, 'chats', chatId), { lastMessage, lastMessageTimestamp: serverTimestamp() }, { merge: true });

        } catch (error) {
            console.error("Error sending message:", error);
            setInputValue(text);
            toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
        } finally {
            setSending(false);
            setUploadingAttachments(false);
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
                        <p>Say hello to start the conversation with {supportAgent.displayName || `${supportAgent.firstName || ''} ${supportAgent.lastName || ''}`.trim() || supportAgent.email || 'Support Agent'}!</p>
                    </div>
                )}
                {messages.map(message => (
                    <div key={message.id} className={cn("flex items-end gap-2", message.senderId === user.uid ? "justify-end" : "justify-start")}>
                        {message.senderId !== user.uid && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage
                                    src={supportAgent?.image || undefined}
                                    alt={supportAgent?.displayName || supportAgent?.firstName || supportAgent?.email || 'Support Agent'}
                                    data-ai-hint="support agent"
                                    onError={(e) => {
                                        console.log('Support agent message image failed to load:', supportAgent?.image);
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                    onLoad={() => {
                                        console.log('Support agent message image loaded successfully:', supportAgent?.image);
                                    }}
                                />
                                <AvatarFallback className={supportAgent?.image ? 'hidden' : ''}>
                                    {supportAgent?.displayName?.[0]?.toUpperCase() ||
                                     supportAgent?.firstName?.[0]?.toUpperCase() ||
                                     supportAgent?.email?.[0]?.toUpperCase() ||
                                     'S'}
                                </AvatarFallback>
                            </Avatar>
                        )}
                        <div className="flex flex-col gap-1 items-start">
                            <div className={cn("rounded-lg px-4 py-2 max-w-sm shadow-sm", message.senderId === user.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                {message.attachments && message.attachments.length > 0 && (
                                    <div className="space-y-2 mb-2">
                                        {message.attachments.map((attachment, index) => (
                                            <div key={index} className="rounded border bg-background/50 p-2">
                                                {attachment.type === 'image' && (
                                                    <img
                                                        src={attachment.url}
                                                        alt={attachment.filename}
                                                        className="max-w-full h-auto rounded max-h-48 object-cover cursor-pointer"
                                                        onClick={() => window.open(attachment.url, '_blank')}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                )}
                                                {attachment.type === 'video' && (
                                                    <video
                                                        src={attachment.url}
                                                        controls
                                                        className="max-w-full h-auto rounded max-h-48"
                                                        preload="metadata"
                                                    />
                                                )}
                                                {attachment.type === 'audio' && (
                                                    <audio
                                                        src={attachment.url}
                                                        controls
                                                        className="w-full max-w-xs"
                                                    />
                                                )}
                                                <div className="hidden text-xs text-red-500 mt-1">
                                                    Failed to load {attachment.filename}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                                    {attachment.filename} ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(message.content || message.translatedText) && (
                                    <div>
                                        <p className="text-sm">{typeof message.translatedText === 'string' ? message.translatedText : message.content}</p>
                                        {typeof message.translatedText === 'string' && <p className="text-xs text-gray-500 italic mt-1">Original: {message.content}</p>}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground px-2">
                                {message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                            </p>
                        </div>
                        {message.senderId === user.uid && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage
                                    src={userProfile?.image || undefined}
                                    alt={userProfile?.displayName || userProfile?.firstName || user.email || 'User'}
                                    onError={(e) => {
                                        console.log('User message image failed to load:', userProfile?.image);
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                    onLoad={() => {
                                        console.log('User message image loaded successfully:', userProfile?.image);
                                    }}
                                />
                                <AvatarFallback className={userProfile?.image ? 'hidden' : ''}>
                                    {userProfile?.displayName?.[0]?.toUpperCase() ||
                                     userProfile?.firstName?.[0]?.toUpperCase() ||
                                     user.email?.[0]?.toUpperCase() ||
                                     'U'}
                                </AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </CardContent>
            <CardFooter className="p-2 border-t bg-background">
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                    <div className="w-full mb-2 flex flex-wrap gap-2">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                                {file.type.startsWith('image/') && <Image className="h-4 w-4" />}
                                {file.type.startsWith('video/') && <Video className="h-4 w-4" />}
                                {file.type.startsWith('audio/') && <MicIcon className="h-4 w-4" />}
                                <span className="truncate max-w-32">{file.name}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeAttachment(index)}
                                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {uploadingAttachments && (
                            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Uploading attachments...
                            </div>
                        )}
                    </div>
                )}

                <div className="relative flex-1">
                    <Input
                        placeholder="Type your message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="pr-20 pl-10"
                        disabled={!chatId || sending || uploadingAttachments}
                    />
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Attach file" disabled={!chatId || sending || uploadingAttachments}>
                                    <Paperclip className="h-5 w-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = (e) => handleFileSelect(e as any);
                                            input.click();
                                        }}
                                    >
                                        <Image className="h-4 w-4 mr-2" />
                                        Photo
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'video/*';
                                            input.onchange = (e) => handleFileSelect(e as any);
                                            input.click();
                                        }}
                                    >
                                        <Video className="h-4 w-4 mr-2" />
                                        Video
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                                    >
                                        {isRecording ? <Pause className="h-4 w-4 mr-2" /> : <MicIcon className="h-4 w-4 mr-2" />}
                                        {isRecording ? 'Stop Recording' : 'Voice Message'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={handleImageCapture}
                                    >
                                        <Camera className="h-4 w-4 mr-2" />
                                        Camera
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        <Button
                            size="icon"
                            onClick={handleSend}
                            className="h-8 w-8 rounded-full"
                            disabled={(!inputValue.trim() && attachments.length === 0) || sending || uploadingAttachments}
                        >
                            {sending || uploadingAttachments ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
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
                                                {supportAgent.settings?.profileVisibility === 'public' && supportAgent.image ? (
                                                    <AvatarImage
                                                        src={supportAgent.image}
                                                        alt={supportAgent.displayName || supportAgent.email || 'Support Agent'}
                                                        data-ai-hint="support agent"
                                                        onError={(e) => {
                                                            console.log('Support agent image failed to load:', supportAgent.image);
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                        onLoad={() => {
                                                            console.log('Support agent image loaded successfully:', supportAgent.image);
                                                        }}
                                                    />
                                                ) : null}
                                                <AvatarFallback className={supportAgent.settings?.profileVisibility === 'public' && supportAgent.image ? 'hidden' : ''}>
                                                    {supportAgent.settings?.profileVisibility === 'public' ? (
                                                        supportAgent.displayName?.[0]?.toUpperCase() ||
                                                        supportAgent.firstName?.[0]?.toUpperCase() ||
                                                        supportAgent.email?.[0]?.toUpperCase() ||
                                                        'S'
                                                    ) : 'S'}
                                                </AvatarFallback>
                                            </Avatar>
                                            {supportAgent.settings?.showOnlineStatus !== false && <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>}
                                        </div>
                                        <div>
                                            <p className="font-semibold">
                                                {supportAgent.settings?.profileVisibility === 'public' ? (
                                                    supportAgent.displayName ||
                                                    `${supportAgent.firstName || ''} ${supportAgent.lastName || ''}`.trim() ||
                                                    supportAgent.email ||
                                                    'Support Agent'
                                                ) : 'Support Agent'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {supportAgent.settings?.showOnlineStatus !== false ? 'Online - Support Agent' : 'Support Agent'}
                                            </p>
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
