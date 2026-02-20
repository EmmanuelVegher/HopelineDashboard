"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Send, Phone, MessageSquare, Video, Mic, Paperclip, Clock, HeartPulse, Bus, Utensils, Home, FileText, HeartHandshake, Loader2, Camera, Pause, ArrowLeft, AlertTriangle, HelpCircle, Users } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { auth, db, functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, serverTimestamp, doc, setDoc, limit, getDoc, updateDoc, increment, arrayUnion } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useToast } from "@/hooks/use-toast"
import { useAuthState } from "react-firebase-hooks/auth"
import type { UserProfile } from "@/lib/data"
import { CallInterface } from "@/components/chat/call-interface"

type Message = {
    id: string;
    content: string;
    messageType: string;
    originalText: string;
    receiverId: string;
    senderEmail: string;
    senderId: string;
    timestamp: Date | null;
    userTranslatedText?: string;
    agentTranslatedText?: string;
    attachments?: {
        type: 'image' | 'video' | 'audio';
        url: string;
        filename: string;
        size: number;
        duration?: number;
    }[];
}

const assistanceTypes = [
    { title: "Psychological Support", description: "Mental health and trauma counseling", icon: HeartHandshake, color: "bg-blue-100 text-blue-600" },
    { title: "Transportation", description: "Safe transport to shelters or medical facilities", icon: Bus, color: "bg-green-100 text-green-600" },
    { title: "Legal Aid", description: "Legal assistance and documentation support", icon: FileText, color: "bg-purple-100 text-purple-600" },
    { title: "Shelter Support", description: "Help finding and accessing safe shelters", icon: Home, color: "bg-orange-100 text-orange-600" },
    { title: "Food & Water", description: "Emergency food distribution and clean water", icon: Utensils, color: "bg-red-100 text-red-600" },
    { title: "Medical Assistance", description: "Emergency medical care and health services", icon: HeartPulse, color: "bg-teal-100 text-teal-600" },
]

export default function AssistancePage() {
    const [user] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    // Removed unused currentLanguage
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [chatId, setChatId] = useState<string | null>(null);
    const [chatLoading, setChatLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Core state for UI switching
    const [activeTab, setActiveTab] = useState("chat");
    const [supportAgent, setSupportAgent] = useState<UserProfile | null>(null);

    const [agentsLoading, setAgentsLoading] = useState(true);
    const [availableAgents, setAvailableAgents] = useState<UserProfile[]>([]);
    const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
    const [availableAdmins, setAvailableAdmins] = useState<UserProfile[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [adminsLoading, setAdminsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<'agents' | 'users' | 'admins'>('agents');
    const [agentSearch, setAgentSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [adminSearch, setAdminSearch] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [isInCall, setIsInCall] = useState(false);
    const [callType, setCallType] = useState<'voice' | 'video'>('voice');
    const [callHistory, setCallHistory] = useState<any[]>([]);
    const [currentCallId, setCurrentCallId] = useState<string | null>(null);
    const [participantInfo, setParticipantInfo] = useState<Record<string, any>>({});
    const [userData, setUserData] = useState<Record<string, UserProfile>>({});
    const [fetchedUsers, setFetchedUsers] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    // Helper to get group ID based on user role and state
    const getSystemGroupId = useCallback(() => {
        if (!user || !userProfile?.state) return null;
        const state = userProfile.state.toLowerCase().replace(/\s+/g, '_');

        // Normalize role to ensure robust matching (lowercase, trim)
        const userRole = (userProfile.role || '').toString().toLowerCase().trim();

        // If role is displaced_person, beneficiary, or displaced-person -> beneficiary group
        let groupRole = 'user';
        if (['displaced_person', 'beneficiary', 'displaced-person', 'displaced person'].includes(userRole)) {
            groupRole = 'beneficiary';
        } else if (userRole === 'driver' || userRole === 'pilot') {
            groupRole = 'driver';
        }

        return `group_${state}_${groupRole}`;
    }, [user, userProfile]);

    const handleGroupChatSelect = async () => {
        const groupId = getSystemGroupId();
        if (groupId && user) {
            // Ensure user is in the participants list before setting chatId to avoid listener permission errors
            try {
                const chatRef = doc(db, 'chats', groupId);

                // Directly try to join. Rule 115 in firestore.rules allows adding yourself to participants.
                // We add ourselves to both the participants list and the metadata map.
                await updateDoc(chatRef, {
                    participants: arrayUnion(user.uid),
                    [`participantInfo.${user.uid}`]: {
                        name: (userProfile?.firstName && userProfile?.lastName) ? `${userProfile.firstName} ${userProfile.lastName}` : (user.displayName || 'User'),
                        role: userProfile?.role || 'user',
                        email: user?.email || '',
                        avatar: userProfile?.image || user.photoURL || ''
                    }
                });

                console.log("Joined system group successfully");
                setChatId(groupId);
                setSupportAgent(null); // Clear agent selection
                setActiveTab("group");
            } catch (error: any) {
                console.error("Error joining system group:", error);

                // If permission-denied, it might be because we ARE already participants but can't run updateDoc?
                // Or some other rule issue. Let's try to proceed if we think we might already be in.
                if (error.code === 'permission-denied') {
                    setChatId(groupId);
                    setSupportAgent(null);
                    setActiveTab("group");
                } else {
                    toast({ title: "Error", description: "Could not join your community group.", variant: "destructive" });
                }
            }

        } else {
            toast({ title: "Error", description: "Could not determine your community group.", variant: "destructive" });
        }
    };

    const messagesEndRef = useRef<null | HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUserProfile({
                        ...data,
                        image: data.image || data.imageUrl || data.profileImage || data.photoURL || data.photoUrl || data.avatar || ''
                    } as UserProfile);
                }
            }
        };
        fetchUserProfile();
    }, [user]);

    // Check for existing chat when supportAgent is selected (P2P only)
    useEffect(() => {
        if (!user || !supportAgent) return;

        const checkExistingChat = async () => {
            try {
                const q = query(
                    collection(db, 'chats'),
                    where('participants', 'array-contains', user.uid)
                );

                const querySnapshot = await getDocs(q);
                const existing = querySnapshot.docs.find(d =>
                    d.data().participants?.includes(supportAgent.uid) &&
                    !d.id.includes('_group_')
                );

                if (existing) {
                    setChatId(existing.id);
                } else {
                    setChatId(null); // Will be created on handleSend
                }
            } catch (error) {
                console.error('Error checking for existing chat:', error);
            }
        };

        checkExistingChat();
    }, [user, supportAgent]);

    useEffect(() => {
        if (!chatId || !user) return;

        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs: Message[] = [];
            querySnapshot.docs.forEach((doc) => {
                const data = doc.data() as Message;
                // Fix: Check if timestamp is a Firestore Timestamp (has toDate) or already a Date
                const timestamp = (data.timestamp as any)?.toDate ? (data.timestamp as any).toDate() : (data.timestamp instanceof Date ? data.timestamp : null);
                msgs.push({ ...data, id: doc.id, timestamp });
            });
            setMessages(msgs);
        }, (error) => {
            console.error("Chat message listener error:", error);
            if (error.code === 'permission-denied') {
                toast({
                    title: "Access Restricted",
                    description: "You may not be a participant in this chat yet. Please wait or try refreshing.",
                    variant: "destructive"
                });
            }
        });

        const chatRef = doc(db, 'chats', chatId);
        const unsubscribeMeta = onSnapshot(chatRef, (snap) => {
            if (snap.exists()) {
                setParticipantInfo(snap.data().participantInfo || {});
            }
        }, (err) => {
            if (err.code !== 'permission-denied') {
                console.error("Chat metadata listener error:", err);
            }
        });

        return () => {
            unsubscribe();
            unsubscribeMeta();
        };
    }, [chatId, user]);

    // Reset messages when chatId is cleared
    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            setParticipantInfo({});
        }
    }, [chatId]);

    // Fetch missing profiles for participants
    useEffect(() => {
        const fetchMissingProfiles = async () => {
            const missingIds = Array.from(new Set(messages
                .map(m => m.senderId)
                .filter(id => id && id !== user?.uid && !userData[id] && !fetchedUsers.has(id))));

            if (missingIds.length === 0) return;

            // Mark as fetched immediately to prevent duplicate requests
            setFetchedUsers(prev => {
                const next = new Set(prev);
                missingIds.forEach(id => next.add(id));
                return next;
            });

            for (const id of missingIds) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', id));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserData(prev => ({
                            ...prev,
                            [id]: {
                                id: userDoc.id,
                                ...data,
                                // Normalize image field during fetch
                                image: data.image || data.imageUrl || data.profileImage || data.photoURL || data.photoUrl || data.avatar || ''
                            } as UserProfile
                        }));
                    }
                } catch (err: any) {
                    if (err.code !== 'permission-denied') {
                        console.error("Error fetching missing profile:", id, err);
                    }
                }
            }
        };

        if (messages.length > 0) {
            fetchMissingProfiles();
        }
    }, [messages, userData, fetchedUsers, user]);

    useEffect(() => {
        if (user && userProfile) {
            setChatLoading(false);
        }
    }, [user, userProfile]);

    // Consolidated fetch for available people in the same state
    useEffect(() => {
        const fetchAvailablePeople = async () => {
            if (user && userProfile) {
                try {
                    setAgentsLoading(true);
                    setUsersLoading(true);
                    setAdminsLoading(true);

                    // 1. Fetch all potentially relevant users in the same state
                    const usersRef = collection(db, 'users');
                    const personQuery = query(
                        usersRef,
                        where('state', '==', userProfile.state),
                        limit(500)
                    );
                    const snapshot = await getDocs(personQuery);
                    const allPeople = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));

                    // 2. Fetch lastMessage for all relevant chats in one go
                    const chatsRef = collection(db, 'chats');
                    const chatsQuery = query(chatsRef, where('participants', 'array-contains', user.uid));
                    const chatsSnapshot = await getDocs(chatsQuery);
                    const lastMessagesMap = new Map();
                    chatsSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const participants = data.participants || [];
                        const otherId = participants.find((id: string) => id !== user.uid);
                        if (otherId) {
                            lastMessagesMap.set(otherId, data.lastMessage);
                        }
                    });

                    // 3. Categorize and Enrich client-side
                    const enrich = (people: UserProfile[]) => people.map(p => ({
                        ...p,
                        lastMessage: lastMessagesMap.get(p.uid) || null
                    }));

                    const agents = allPeople.filter(u => {
                        const role = (u.role || '').toString().toLowerCase();
                        return role.includes('support') && u.uid !== user.uid;
                    });

                    const admins = allPeople.filter(u => {
                        const role = (u.role || '').toString().toLowerCase();
                        return role.includes('admin') && u.uid !== user.uid;
                    });

                    const regularUsers = allPeople.filter(u => {
                        const role = (u.role || '').toString().toLowerCase();
                        return (role === 'user' || role === 'displaced_person' || role === 'beneficiary') &&
                            u.uid !== user.uid &&
                            u.accountStatus !== 'inactive';
                    });

                    setAvailableAgents(enrich(agents));
                    setAvailableUsers(enrich(regularUsers));
                    setAvailableAdmins(enrich(admins));

                } catch (error) {
                    console.error('Error fetching available people:', error);
                } finally {
                    setAgentsLoading(false);
                    setUsersLoading(false);
                    setAdminsLoading(false);
                }
            }
        };

        fetchAvailablePeople();
    }, [user, userProfile]);


    // Listen for call history
    useEffect(() => {
        if (!user) return;
        const callsRef = collection(db, 'calls');
        const q = query(callsRef, where('userId', '==', user.uid), orderBy('startTime', 'desc'), limit(10));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const calls: any[] = [];
            querySnapshot.docs.forEach((doc) => {
                const data = doc.data();
                calls.push({ id: doc.id, ...data, startTime: data.startTime?.toDate(), endTime: data.endTime?.toDate() });
            });
            setCallHistory(calls.map(call => ({ ...call, startTime: call.startTime ? new Date(call.startTime) : null, endTime: call.endTime ? new Date(call.endTime) : null })));
        });
        return () => unsubscribe();
    }, [user]);
    // ... (rest of search/filter state)



    // ... (existing useEffects)

    // --- File & Call Handlers ---
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) { setAttachments(prev => [...prev, ...Array.from(files)]); }
        event.target.value = '';
    };

    const handleImageCapture = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
        input.onchange = (e) => handleFileSelect(e as any); input.click();
    };

    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
            recorder.onstop = () => {
                const audioBlob = new Blob(chunks, { type: 'audio/wav' });
                const audioFile = new File([audioBlob], `voice-recording-${Date.now()}.wav`, { type: 'audio/wav' });
                setAttachments(prev => [...prev, audioFile]);
                stream.getTracks().forEach(track => track.stop());
            };
            setMediaRecorder(recorder); recorder.start(); setIsRecording(true);
        } catch (error) { toast({ title: "Error", description: "Could not access microphone", variant: "destructive" }); }
    };

    const stopVoiceRecording = () => {
        if (mediaRecorder && isRecording) { mediaRecorder.stop(); setIsRecording(false); setMediaRecorder(null); }
    };

    const startCall = async (type: 'voice' | 'video') => {
        if (!user || (!supportAgent && activeTab !== 'group')) return;

        try {
            if (activeTab === 'group') {
                toast({ title: "Not Available", description: "Group calling is coming soon.", variant: "default" });
                return;
            }

            const channelName = [user.uid, supportAgent!.uid].sort().join('_');
            const callDocRef = doc(collection(db, 'calls'));

            await setDoc(callDocRef, {
                userId: user.uid,
                agentId: supportAgent!.uid,
                userName: userProfile?.firstName || 'User',
                userImage: userProfile?.image || '',
                agentName: supportAgent!.displayName || 'Support Agent',
                agentImage: supportAgent!.image || '',
                callType: type,
                chatId: chatId || 'temp-id',
                channelName: channelName,
                callerId: user.uid,
                status: 'ringing',
                startTime: serverTimestamp(),
                acceptedAt: null,
                endTime: null,
                duration: 0,
                language: 'en',
                location: '',
                priority: 'normal'
            });

            setCallType(type);
            setIsInCall(true);
            setCurrentCallId(callDocRef.id);
        } catch (error) {
            console.error("Error starting call:", error);
            toast({ title: "Error", description: "Failed to start call", variant: "destructive" });
        }
    };



    const uploadAttachments = async (files: File[]) => {
        const storage = getStorage();
        const uploaded = [];
        for (const file of files) {
            const fileName = `${Date.now()}-${file.name}`;
            const storageRef = ref(storage, `chat-attachments/${chatId}/${fileName}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            uploaded.push({
                type: (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio') as any,
                url, filename: file.name, size: file.size, duration: 0
            });
        }
        return uploaded;
    };

    const handleSend = async () => {
        if ((!inputValue.trim() && attachments.length === 0) || !user || (!supportAgent && activeTab !== 'group') || sending || !chatId) return;
        setSending(true);
        const originalText = inputValue;
        setInputValue('');

        try {
            let currentChatId = chatId;
            if (!currentChatId || currentChatId === 'temp-id') {
                currentChatId = `${user.uid}_${supportAgent!.uid}`;
                const chatRef = doc(db, 'chats', currentChatId);
                await setDoc(chatRef, {
                    participants: [user.uid, supportAgent!.uid],
                    participantInfo: {
                        [user.uid]: {
                            name: (userProfile?.firstName && userProfile?.lastName) ? `${userProfile.firstName} ${userProfile.lastName}` : (user.displayName || 'User'),
                            role: userProfile?.role || 'user',
                            email: user.email,
                            avatar: userProfile?.image || (userProfile as any)?.profileImage || (userProfile as any)?.photoURL || (userProfile as any)?.photoUrl || (userProfile as any)?.imageUrl || (userProfile as any)?.avatar || user.photoURL || ''
                        },
                        [supportAgent!.uid]: {
                            name: supportAgent!.displayName,
                            role: supportAgent!.role || 'support agent',
                            email: supportAgent!.email,
                            avatar: supportAgent!.image || (supportAgent as any)!.profileImage || (supportAgent as any)!.photoURL || (supportAgent as any)!.photoUrl || (supportAgent as any)!.imageUrl || (supportAgent as any)!.avatar || ''
                        }
                    },
                    createdAt: serverTimestamp(), lastMessage: "", status: "active",
                    userId: user.uid, agentId: supportAgent!.uid, userLanguage: userProfile?.language || 'English'
                });
                setChatId(currentChatId);
            }

            let uploadedAttachments: any[] = [];
            if (attachments.length > 0) {
                uploadedAttachments = await uploadAttachments(attachments);
                setAttachments([]);
            }

            // Translation logic
            let userTranslatedText = originalText;
            let agentTranslatedText = originalText;

            if (originalText.trim() && userProfile?.language !== 'English') {
                try {
                    const translateFunction = httpsCallable(functions, 'translateText');
                    const result = await translateFunction({ text: originalText, targetLanguage: 'English' });
                    agentTranslatedText = (result.data as any).translatedText;
                } catch (e) { console.error(e); }
            }

            const receiverId = activeTab === 'group' ? currentChatId : supportAgent?.uid || 'support';

            const messageData: any = {
                content: originalText,
                messageType: uploadedAttachments.length > 0 ? "media" : "text",
                originalText: originalText,
                userTranslatedText, agentTranslatedText,
                receiverId: receiverId, senderEmail: user.email!, senderId: user.uid,
                timestamp: serverTimestamp(), translationTimestamp: serverTimestamp(), status: 'sent'
            };
            if (uploadedAttachments.length > 0) messageData.attachments = uploadedAttachments;

            const messagesRef = collection(db, 'chats', currentChatId, 'messages');
            await addDoc(messagesRef, messageData);
            await updateDoc(doc(db, 'chats', currentChatId), {
                lastMessage: originalText,
                lastMessageTimestamp: serverTimestamp(),
                messageCount: increment(1)
            });

        } catch (error) {
            console.error("Error sending message:", error);
            setInputValue(originalText);
            toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    // --- Sub-Components ---

    const filterUsers = (users: (UserProfile & { lastMessage?: string | null })[], searchTerm: string) => {
        if (!searchTerm.trim()) return users;
        const lowerSearch = searchTerm.toLowerCase();
        return users.filter(user =>
            user.displayName?.toLowerCase().includes(lowerSearch) ||
            String(user.mobile || '').toLowerCase().includes(lowerSearch) ||
            user.email?.toLowerCase().includes(lowerSearch)
        );
    };

    const AgentCard = ({ agent }: { agent: UserProfile & { lastMessage?: string | null } }) => {
        const getRoleLabel = () => {
            const role = (agent.role || '').toString().toLowerCase();
            if (role.includes('support')) return 'Support Agent';
            if (role.includes('admin')) return 'Admin';
            if (role === 'displaced_person' || role === 'beneficiary') return 'Beneficiary';
            if (role === 'driver' || role === 'pilot') return 'Driver';
            return 'User';
        };
        const isOnline = agent.availability === 'online' || agent.isOnline;
        return (
            <Card className="flex flex-col p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200">
                <div className="flex items-start gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                        <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
                            <AvatarImage src={agent.image || (agent as any).imageUrl || (agent as any).profileImage || (agent as any).photoURL || (agent as any).photoUrl || (agent as any).avatar} />
                            <AvatarFallback className="text-lg bg-gradient-to-br from-blue-100 to-blue-200">
                                {agent.displayName?.[0] || agent.firstName?.[0] || agent.role?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        {agent.role === 'support agent' && (
                            <span className={cn("absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white",
                                isOnline ? "bg-green-500" : "bg-yellow-500")}
                            />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-gray-900 truncate">
                            {agent.displayName || (agent.firstName ? `${agent.firstName} ${agent.lastName || ''}`.trim() : "User")}
                        </h3>
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                            {getRoleLabel()}
                        </p>
                        {agent.role === 'support agent' && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isOnline ? "● Online" : "○ Away"}
                            </p>
                        )}
                    </div>
                </div>
                {agent.lastMessage && (
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2 px-1">
                        {agent.lastMessage}
                    </p>
                )}
                <Button
                    onClick={() => {
                        setChatId(null);
                        setMessages([]);
                        setSupportAgent(agent);
                    }}
                    size="sm"
                    className={cn(
                        "w-full rounded-lg text-sm",
                        agent.role === 'support agent' && !isOnline
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                >
                    {agent.role === 'support agent' && !isOnline ? (
                        <>
                            <Clock className="w-3.5 h-3.5 mr-1.5" /> Join Wait List
                        </>
                    ) : (
                        <>
                            <Send className="w-3.5 h-3.5 mr-1.5" /> Start Chat
                        </>
                    )}
                </Button>
            </Card>
        );
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderChatInterface = () => {
        // Determine display details based on activeTab
        const isGroup = activeTab === 'group';
        const displayImage = isGroup ? undefined : (supportAgent?.image || (supportAgent as any)?.imageUrl || (supportAgent as any)?.profileImage || (supportAgent as any)?.photoURL || (supportAgent as any)?.photoUrl || (supportAgent as any)?.avatar); // Use undefined for group to trigger fallback icon
        const displayName = isGroup ? `${userProfile?.state || 'State'} Community Group` : (supportAgent?.displayName || (supportAgent?.firstName ? `${supportAgent.firstName} ${supportAgent.lastName || ''}`.trim() : 'Support Agent'));
        // Unused variable removed or kept if intended for future use, but lint complains
        // const displayRole = isGroup ? "Official Support Group" : "Support Agent"; 

        return (
            <Card className="h-[80vh] flex flex-col shadow-lg border-t-4 border-t-primary">
                <CardHeader className="flex-row items-center justify-between border-b p-4 bg-white">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => {
                            setSupportAgent(null);
                            setChatId(null);
                            setMessages([]);
                            setActiveTab("chat");
                        }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="relative">
                            <Avatar className="h-10 w-10 border">
                                <AvatarImage src={displayImage} />
                                <AvatarFallback>{isGroup ? <Users className="h-5 w-5" /> : displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            {!isGroup && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white"></span>}
                        </div>
                        <div>
                            <p className="font-semibold">{displayName}</p>
                            <p className="text-xs text-muted-foreground">{isGroup ? `${userProfile?.state} • ${(userProfile?.role as string) === 'displaced_person' ? 'Beneficiaries' : 'Residents'}` : "Online - Support Agent"}</p>
                        </div>
                    </div>
                    {!isGroup && (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => startCall('video')} title="Video Call">
                                <Video className="h-5 w-5 text-gray-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => startCall('voice')} title="Voice Call">
                                <Phone className="h-5 w-5 text-gray-600" />
                            </Button>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
                    {messages.length === 0 && !chatLoading && (
                        <div className="text-center text-muted-foreground mt-10">
                            <p>{isGroup ? "Welcome to the community group!" : `Start a conversation with ${displayName}`}</p>
                        </div>
                    )}
                    {messages.map(message => {
                        const isMe = message.senderId === user?.uid;
                        const resolvedSenderInfo = (() => {
                            const profile = isMe
                                ? { ...userProfile, image: userProfile?.image || user?.photoURL || '' }
                                : userData[message.senderId];
                            const info = participantInfo?.[message.senderId];

                            const firstName = profile?.firstName || '';
                            const lastName = profile?.lastName || '';
                            const fullName = (firstName && lastName) ? `${firstName} ${lastName}`.trim() : '';
                            const displayName = profile?.displayName || '';

                            return {
                                name: fullName || displayName || info?.name || 'User',
                                image: profile?.image || (profile as any)?.imageUrl || (profile as any)?.profileImage || (profile as any)?.photoURL || (profile as any)?.photoUrl || (profile as any)?.avatar || info?.avatar || ''
                            };
                        })();

                        return (
                            <div key={message.id} className={cn("flex items-start gap-2 mb-4", isMe ? "flex-row-reverse" : "flex-row")}>
                                <Avatar className="h-8 w-8 mt-1 border shadow-sm flex-shrink-0">
                                    <AvatarImage src={resolvedSenderInfo.image} />
                                    <AvatarFallback className="text-[10px] font-bold bg-slate-100">{resolvedSenderInfo.name?.[0] || '?'}</AvatarFallback>
                                </Avatar>

                                <div className={cn("flex flex-col max-w-[80%] gap-1", isMe ? "items-end" : "items-start")}>
                                    <span className="text-[11px] font-semibold text-slate-500 px-1">{isMe ? 'You' : resolvedSenderInfo.name}</span>
                                    <div className={cn("rounded-2xl px-4 py-2 shadow-sm",
                                        isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-gray-800 border rounded-bl-none")}>
                                        {message.messageType === 'call_status' ? (
                                            <p className="italic text-xs opacity-80">{message.content}</p>
                                        ) : (
                                            <>
                                                <p className="text-sm">{message.userTranslatedText || message.content}</p>
                                                {message.originalText !== message.content && (
                                                    <p className="text-[10px] opacity-70 mt-1 border-t pt-1">Original: {message.originalText}</p>
                                                )}
                                                {message.attachments?.map((att, i) => (
                                                    <div key={i} className="mt-2 rounded overflow-hidden">
                                                        {att.type === 'image' && <img src={att.url} alt="attachment" className="max-h-60 w-full object-cover" />}
                                                        {att.type === 'audio' && <audio src={att.url} controls className="w-full mt-1" />}
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        <div className="flex justify-end items-center gap-1 mt-1 opacity-70 text-[9px]">
                                            {message.timestamp && message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </CardContent>

                <CardFooter className="p-3 border-t bg-white">
                    <div className="relative flex-1 flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-gray-500"><Paperclip className="h-5 w-5" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-0" align="start">
                                <div className="flex flex-col">
                                    <Button variant="ghost" onClick={handleImageCapture} className="justify-start"><Camera className="mr-2 h-4 w-4" /> Camera</Button>
                                    <Button variant="ghost" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} className="justify-start">
                                        {isRecording ? <span className="text-red-500 flex items-center"><Pause className="mr-2 h-4 w-4" /> Stop</span> : <span className="flex items-center"><Mic className="mr-2 h-4 w-4" /> Voice</span>}
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Input
                            placeholder="Type a message..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            className="bg-gray-100 border-0 focus-visible:ring-1"
                        />
                        <Button onClick={handleSend} size="icon" className="bg-blue-600 hover:bg-blue-700 rounded-full h-10 w-10">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        )
    };

    // ... (Call UI render logic remains same)

    // If actively in a call, show the full screen call UI
    if (isInCall && chatId && (supportAgent || activeTab === 'group')) {
        // Create a channel name if one doesn't exist in state. 
        const channelName = supportAgent ? [user?.uid || '', supportAgent.uid].sort().join('_') : chatId;

        return (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
                <div className="container flex items-center justify-center h-full max-w-lg mx-auto p-4">
                    <CallInterface
                        callId={currentCallId || 'temp-id'}
                        chatId={chatId}
                        channelName={channelName}
                        recipientName={supportAgent ? `${supportAgent.firstName} ${supportAgent.lastName}` : "Community Group"}
                        recipientImage={supportAgent?.image || undefined}
                        userName={userProfile?.firstName || 'User'}
                        userImage={userProfile?.image}
                        callType={callType}
                        isIncoming={false}
                        onClose={() => {
                            setIsInCall(false);
                            setCurrentCallId(null);
                        }}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">

            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Get Assistance</h1>
                <p className="text-muted-foreground">Connect with our support teams via chat or phone for immediate assistance</p>
            </div>

            <Card className="border-0 shadow-sm bg-transparent">
                <CardHeader className="px-0 pb-4">
                    <CardTitle>What kind of assistance do you need?</CardTitle>
                    <CardDescription>Select the type of help you need for faster assistance</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-0">
                    {assistanceTypes.map((item, index) => (
                        <Card key={index} className="flex flex-row items-center p-6 gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <div className={cn("p-4 rounded-xl", item.color)}>
                                <item.icon className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">{item.title}</h3>
                                <p className="text-sm text-muted-foreground mt-1 leading-tight">{item.description}</p>
                            </div>
                        </Card>
                    ))}
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="bg-white rounded-3xl p-2 shadow-sm border flex justify-center gap-2 max-w-md mx-auto mb-8">
                    <TabsList className="w-full bg-transparent p-0 h-auto grid grid-cols-3 gap-2">
                        <TabsTrigger value="chat" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 h-10">
                            <MessageSquare className="mr-2 h-5 w-5" /> Live Chat
                        </TabsTrigger>
                        <TabsTrigger value="group" onClick={handleGroupChatSelect} className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 h-10">
                            <Users className="mr-2 h-5 w-5" /> Group Chat
                        </TabsTrigger>
                        <TabsTrigger value="call" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 h-10">
                            <Phone className="mr-2 h-5 w-5" /> Voice Call
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="group">
                    {/* Directly render chat interface for group, reusing the component logic but modified */}
                    {renderChatInterface()}
                </TabsContent>

                <TabsContent value="chat">
                    {!supportAgent ? (
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Connect with People in Your State</CardTitle>
                                <CardDescription>Chat with support agents, other users, or admins in {userProfile?.state}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {/* Category Tabs */}
                                <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as 'agents' | 'users' | 'admins')} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-6">
                                        <TabsTrigger value="agents">Support Agents</TabsTrigger>
                                        {/* <TabsTrigger value="users">Users</TabsTrigger> */}
                                        <TabsTrigger value="admins">Admins</TabsTrigger>
                                    </TabsList>

                                    {/* Support Agents Tab */}
                                    <TabsContent value="agents">
                                        <div className="mb-4">
                                            <Input
                                                placeholder="Search by name, phone, or email..."
                                                value={agentSearch}
                                                onChange={(e) => setAgentSearch(e.target.value)}
                                                className="max-w-md"
                                            />
                                        </div>
                                        {agentsLoading ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {[...Array(3)].map((_, i) => (
                                                    <Card key={i} className="flex flex-col items-center p-6">
                                                        <div className="h-20 w-20 bg-muted rounded-full animate-pulse mb-4" />
                                                        <div className="h-4 bg-muted rounded w-32 mb-2 animate-pulse" />
                                                        <div className="h-3 bg-muted rounded w-24 mb-4 animate-pulse" />
                                                        <div className="h-10 bg-muted rounded w-full animate-pulse" />
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : filterUsers(availableAgents, agentSearch).length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {filterUsers(availableAgents, agentSearch).map((agent) => (
                                                    <AgentCard key={agent.uid} agent={agent} />
                                                ))}
                                            </div>
                                        ) : agentSearch.trim() ? (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                                                <p className="text-muted-foreground">
                                                    No support agents match "{agentSearch}"
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                                <h3 className="text-lg font-semibold mb-2">No Support Agents Available</h3>
                                                <p className="text-muted-foreground">
                                                    All support agents in {userProfile?.state} are currently offline. Please try again later.
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    {/* Users Tab - Commented out as requested
                                    <TabsContent value="users">
                                        <div className="mb-4">
                                            <Input
                                                placeholder="Search by name, phone, or email..."
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                className="max-w-md"
                                            />
                                        </div>
                                        {usersLoading ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {[...Array(3)].map((_, i) => (
                                                    <Card key={i} className="flex flex-col items-center p-6">
                                                        <div className="h-20 w-20 bg-muted rounded-full animate-pulse mb-4" />
                                                        <div className="h-4 bg-muted rounded w-32 mb-2 animate-pulse" />
                                                        <div className="h-3 bg-muted rounded w-24 mb-4 animate-pulse" />
                                                        <div className="h-10 bg-muted rounded w-full animate-pulse" />
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : filterUsers(availableUsers, userSearch).length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {filterUsers(availableUsers, userSearch).map((otherUser) => (
                                                    <AgentCard key={otherUser.uid} agent={otherUser} />
                                                ))}
                                            </div>
                                        ) : userSearch.trim() ? (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                                                <p className="text-muted-foreground">
                                                    No users match "{userSearch}"
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                                <h3 className="text-lg font-semibold mb-2">No Users Available</h3>
                                                <p className="text-muted-foreground">
                                                    No other users found in {userProfile?.state}.
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>
                                    */}

                                    {/* Admins Tab */}
                                    <TabsContent value="admins">
                                        <div className="mb-4">
                                            <Input
                                                placeholder="Search by name, phone, or email..."
                                                value={adminSearch}
                                                onChange={(e) => setAdminSearch(e.target.value)}
                                                className="max-w-md"
                                            />
                                        </div>
                                        {adminsLoading ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {[...Array(3)].map((_, i) => (
                                                    <Card key={i} className="flex flex-col items-center p-6">
                                                        <div className="h-20 w-20 bg-muted rounded-full animate-pulse mb-4" />
                                                        <div className="h-4 bg-muted rounded w-32 mb-2 animate-pulse" />
                                                        <div className="h-3 bg-muted rounded w-24 mb-4 animate-pulse" />
                                                        <div className="h-10 bg-muted rounded w-full animate-pulse" />
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : filterUsers(availableAdmins, adminSearch).length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {filterUsers(availableAdmins, adminSearch).map((admin) => (
                                                    <AgentCard key={admin.uid} agent={admin} />
                                                ))}
                                            </div>
                                        ) : adminSearch.trim() ? (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                                                <p className="text-muted-foreground">
                                                    No admins match "{adminSearch}"
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                                <h3 className="text-lg font-semibold mb-2">No Admins Available</h3>
                                                <p className="text-muted-foreground">
                                                    No admins found in {userProfile?.state}.
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    ) : (
                        renderChatInterface()
                    )}
                </TabsContent>

                <TabsContent value="call">

                    {/* ORIGINAL VOICE CALL TAB CONTENT */}
                    <Card className="h-[calc(100vh-32rem)] flex flex-col items-center justify-center shadow-lg p-6 text-center">
                        <CardHeader>
                            <CardTitle>Voice & Video Call Support</CardTitle>
                            <CardDescription>Our support agents are ready to assist you via voice or video call.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-6">
                            <div className="flex gap-4">
                                <Button
                                    size="lg"
                                    onClick={() => startCall('voice')}
                                    disabled={!supportAgent && !availableAgents.length}
                                    className="px-8"
                                >
                                    <Phone className="mr-2 h-5 w-5" />
                                    Voice Call
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => startCall('video')}
                                    disabled={!supportAgent && !availableAgents.length}
                                    className="px-8"
                                >
                                    <Video className="mr-2 h-5 w-5" />
                                    Video Call
                                </Button>
                            </div>
                            {!supportAgent && availableAgents.length > 0 && (
                                <p className="text-sm text-muted-foreground">Select an agent in the Live Chat tab first, or click above to call the next available agent.</p>
                            )}
                        </CardContent>
                    </Card>

                    {callHistory.length > 0 && (
                        <Card className="mt-6">
                            <CardHeader>
                                <CardTitle>Call History</CardTitle>
                                <CardDescription>Your recent calls</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {callHistory.map((call) => (
                                        <div key={call.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${call.status === 'active' ? 'bg-green-500' :
                                                    call.status === 'ended' ? 'bg-blue-500' :
                                                        call.status === 'missed' ? 'bg-red-500' :
                                                            'bg-yellow-500'
                                                    }`} />
                                                <div>
                                                    <p className="font-medium">
                                                        {call.callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {call.startTime ? new Date(call.startTime).toLocaleString() : 'Unknown time'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={
                                                    call.status === 'active' ? 'default' :
                                                        call.status === 'ended' ? 'secondary' :
                                                            call.status === 'missed' ? 'destructive' :
                                                                'outline'
                                                }>
                                                    {call.status === 'active' ? 'Active' :
                                                        call.status === 'ended' ? 'Completed' :
                                                            call.status === 'missed' ? 'Missed' :
                                                                'Ringing'}
                                                </Badge>
                                                {call.duration && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {formatDuration(call.duration)} duration
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Footer Information */}
            <div className="pt-8 border-t text-center space-y-6">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-100 py-2 rounded-full inline-block px-6 mx-auto w-full max-w-3xl">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block"></span>
                    24/7 Emergency Support Available • Average response time: <span className="font-semibold text-blue-600">2 mins</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-100 p-2 rounded-lg text-red-600">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-red-900">Immediate Danger?</h4>
                                <p className="text-xs text-red-700">Contact local authorities immediately</p>
                            </div>
                        </div>
                        <Button variant="destructive" className="bg-red-600 hover:bg-red-700 font-bold">CALL NOW</Button>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                <HelpCircle className="h-6 w-6" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-blue-900">FAQs & Resources</h4>
                                <p className="text-xs text-blue-700">Find answers to common questions</p>
                            </div>
                        </div>
                        <Button variant="outline" className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold">Browse Help</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
