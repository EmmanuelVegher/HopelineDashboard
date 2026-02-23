"use client";

import { useState, useEffect, useRef } from "react";
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import {
    MessageSquare,
    Send,
    Globe,
    Loader2,
    Search,
    Plus,
    Phone,
    Video,
    Paperclip,
    Mic,
    X,
    File as FileIcon,
    Image as ImageIcon,
    Film,
    Square,
    Users as UsersIcon
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { collection, addDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, limit } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, auth, functions, storage } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useToast } from "@/hooks/use-toast";
import { MessageStatus } from "@/components/message-status"; // Restored correct import
import { useAdminData } from "@/contexts/AdminDataProvider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CallInterface } from "@/components/chat/call-interface"; // Restored correct path
import { generateChannelName } from "@/lib/agora"; // Restored missing import
// import { NIGERIA_STATES } from "@/lib/nigeria-geography"; // Restored for completeness if needed later

const SYSTEM_ROLES = ['Beneficiary', 'Driver', 'Support Agent', 'User'];

interface ChatSession {
    id: string;
    participants: string[];
    participantInfo?: Record<string, { name: string, email: string, role?: string, avatar?: string }>; // Enhanced type
    lastMessage: string;
    lastMessageTime: any; // Can be Timestamp or Date
    unreadCount: number;
    type?: 'p2p' | 'group'; // Distinguish between direct and group chats
    name?: string; // For group chats
    userId?: string; // For P2P deep linking/display
    fullName?: string; // Restored missing property
    userImage?: string; // For P2P display
    userEmail?: string; // For P2P display
    status?: string; // status of p2p chat request
    agentId?: string; // agent handling the chat
    agentName?: string; // agent name
    state?: string; // For group chats
    isSystemGroup?: boolean; // For official groups
    language?: string; // User preferred language
}

interface Attachment {
    url: string;
    type: 'image' | 'video' | 'audio' | 'file';
    filename: string;
    size: number;
}

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: any;
    messageType: 'text' | 'image' | 'video' | 'audio' | 'file';
    status: 'sent' | 'delivered' | 'read';
    senderEmail?: string;
    originalText?: string;
    userTranslatedText?: string;
    agentTranslatedText?: string;
    attachments?: Attachment[];
    trainingType?: 'guide' | 'media' | 'text';
    guideContent?: string;
}

export default function AdminChatsPage() {
    const { users: allUsers, adminProfile } = useAdminData();
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [privateChats, setPrivateChats] = useState<ChatSession[]>([]);
    const [systemChats, setSystemChats] = useState<ChatSession[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<Record<string, { firstName: string, lastName: string, image?: string }>>({});
    const [fetchedUsers, setFetchedUsers] = useState<Set<string>>(new Set());
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [chatTab, setChatTab] = useState<'p2p' | 'group'>('p2p');
    const [searchParams] = useSearchParams();
    const targetedUserId = searchParams.get('userId');

    // Media State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileAccept, setFileAccept] = useState("image/*,video/*,audio/*,.pdf,.doc,.docx");

    // Call State
    const [activeCall, setActiveCall] = useState<{
        callId: string;
        chatId: string;
        channelName: string;
        recipientName: string;
        recipientImage?: string;
        callType: 'video' | 'voice';
        isIncoming: boolean;
    } | null>(null);

    const [selectedGuide, setSelectedGuide] = useState<{ title: string, content: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const { toast } = useToast();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);


    // 1. Ensure Role-Based Groups Exist for the Admin's Scope
    useEffect(() => {
        const ensureStateGroups = async () => {
            if (!adminProfile || !auth.currentUser?.uid) return;

            const stateToInit = adminProfile.state || 'Federal'; // Fallback for Super Admin without state

            for (const role of SYSTEM_ROLES) {
                const groupName = `${stateToInit} ${role}`;
                const groupId = `group_${stateToInit.toLowerCase().replace(/\s+/g, '_')}_${role.toLowerCase().replace(/\s+/g, '_')}`;

                const docRef = doc(db, 'chats', groupId);

                try {
                    const docSnap = await getDoc(docRef);
                    if (!docSnap.exists()) {
                        await setDoc(docRef, {
                            id: groupId,
                            name: groupName,
                            type: 'group',
                            isSystemGroup: true,
                            targetRole: role.toLowerCase(),
                            state: stateToInit,
                            participants: [auth.currentUser?.uid],
                            participantInfo: {
                                [auth.currentUser?.uid!]: {
                                    name: adminProfile.firstName + ' ' + adminProfile.lastName || 'System',
                                    role: adminProfile.role || 'system'
                                }
                            },
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastMessage: `Welcome to the ${groupName} official channel.`,
                            lastMessageTime: serverTimestamp(),
                            unreadCount: 0,
                            status: 'active'
                        });
                        console.log(`Initialized system group: ${groupName}`);
                    }
                } catch (e) {
                    console.error("Error ensuring group:", e);
                }
            }
        };

        ensureStateGroups();
    }, [adminProfile, auth.currentUser?.uid]);

    // Fetching chat sessions (Merged P2P and System Groups)
    useEffect(() => {
        const adminId = auth.currentUser?.uid;
        if (!adminId || !adminProfile) return;

        setLoading(true);

        const p2pQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', adminId)
            // orderBy('lastMessageTime', 'desc') // Removed to avoid index issues, sorting done client-side
        );

        let systemQuery;
        const isSuperAdmin = adminProfile.role?.toLowerCase() === 'super-admin' || adminProfile.role?.toLowerCase() === 'super admin';

        if (isSuperAdmin) {
            systemQuery = query(
                collection(db, 'chats'),
                where('isSystemGroup', '==', true)
                // orderBy('lastMessageTime', 'desc')
            );
        } else if (adminProfile.state) {
            systemQuery = query(
                collection(db, 'chats'),
                where('isSystemGroup', '==', true),
                where('state', '==', adminProfile.state)
                // orderBy('lastMessageTime', 'desc')
            );
        }

        const unsubP2P = onSnapshot(p2pQuery, (snapshot) => {
            const p2pSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
            setPrivateChats(p2pSessions);
        }, (error) => {
            console.error("Admin p2p chats listener error:", error);
        });

        let unsubSystem = () => { };
        if (systemQuery) {
            unsubSystem = onSnapshot(systemQuery, (snapshot) => {
                const sysSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
                setSystemChats(sysSessions);
            }, (error) => {
                console.error("Admin system chats listener error:", error);
            });
        }

        setLoading(false);

        return () => {
            unsubP2P();
            unsubSystem();
        };
    }, [adminProfile, auth.currentUser?.uid]);

    useEffect(() => {
        const uniqueMap = new Map<string, ChatSession>();

        // Add all from privateChats
        privateChats.forEach(chat => uniqueMap.set(chat.id, chat));
        // Add all from systemChats (overwriting if exists, but they should be same data)
        systemChats.forEach(chat => uniqueMap.set(chat.id, chat));

        const unique = Array.from(uniqueMap.values());

        unique.sort((a, b) => {
            const tA = (a.lastMessageTime instanceof Date ? a.lastMessageTime.getTime() : (a.lastMessageTime as any)?.toDate?.().getTime()) || 0;
            const tB = (b.lastMessageTime instanceof Date ? b.lastMessageTime.getTime() : (b.lastMessageTime as any)?.toDate?.().getTime()) || 0;
            return tB - tA;
        });
        setChatSessions(unique);
    }, [privateChats, systemChats]);

    // Handle Deep Linking from Beneficiary Cards
    useEffect(() => {
        if (targetedUserId && chatSessions.length > 0) {
            const session = chatSessions.find(s => s.userId === targetedUserId);
            if (session) {
                setSelectedChatId(session.id);
            }
        }
    }, [targetedUserId, chatSessions]);

    // Fetch user data for chat items
    useEffect(() => {
        const adminId = auth.currentUser?.uid;
        const userIds = [...new Set([...chatSessions.map(c => c.userId), adminId])]
            .filter((id): id is string => !!id);

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
                console.error(`Error fetching user ${userId}:`, error);
            }
            return { userId, firstName: '', lastName: '', image: undefined };
        });

        Promise.all(fetchPromises).then((results) => {
            setUserData(prev => {
                const newData = { ...prev };
                results.forEach(r => {
                    if (r) {
                        newData[r.userId] = {
                            firstName: r.firstName,
                            lastName: r.lastName,
                            image: r.image
                        };
                    }
                });
                return newData;
            });
            setFetchedUsers(prev => {
                const newSet = new Set(prev);
                results.forEach(r => {
                    if (r) newSet.add(r.userId);
                });
                return newSet;
            });
        });
    }, [chatSessions, fetchedUsers]);

    // Load messages for selected chat
    useEffect(() => {
        if (!selectedChatId) {
            setMessages([]);
            return;
        }

        const messagesQuery = query(
            collection(db, 'chats', selectedChatId, 'messages')
            // orderBy('timestamp', 'asc') // Removed: Mixed types (Timestamp vs String) break sort order
        );

        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs: Message[] = [];
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                msgs.push({ ...data, id: doc.id } as Message);
            });

            // Client-side sort to handle mixed types
            msgs.sort((a, b) => {
                const getTime = (t: any) => {
                    if (!t) return 0;
                    if (typeof t.toDate === 'function') return t.toDate().getTime();
                    if (t instanceof Date) return t.getTime();
                    return new Date(t).getTime();
                };
                return getTime(a.timestamp) - getTime(b.timestamp);
            });

            setMessages(msgs);

            // Mark as read
            const adminId = auth.currentUser?.uid;
            if (adminId) {
                snapshot.docs.forEach(async (doc) => {
                    const data = doc.data() as Message;
                    if (data.senderId !== adminId && data.status !== 'read') {
                        await updateDoc(doc.ref, { status: 'read' });
                    }
                });
            }
        }, (error) => {
            console.error("Admin messages listener error:", error);
        });

        return () => unsubscribe();
    }, [selectedChatId]);

    const handleAttachmentClick = (acceptType: string) => {
        setFileAccept(acceptType);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (e.g., max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                toast({ title: "File too large", description: "Max file size is 10MB", variant: "destructive" });
                return;
            }
            setAttachment(file);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleVoiceRecord = async () => {
        if (isRecording) {
            // Stop recording
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                    setAttachment(audioFile);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsRecording(true);
                timerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);

            } catch (error) {
                console.error("Error accessing microphone:", error);
                toast({ title: "Error", description: "Could not access microphone", variant: "destructive" });
            }
        }
    };

    const handleCall = async () => {
        if (!selectedChatId || !auth.currentUser) return;
        const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);
        if (!selectedChat) return;

        try {
            const isGroup = selectedChat.type === 'group' || !selectedChat.userId;
            const channelName = isGroup
                ? selectedChat.id
                : generateChannelName(auth.currentUser.uid, selectedChat.userId || '');

            const recipients = isGroup
                ? (selectedChat.participants || []).filter(id => id !== auth.currentUser?.uid)
                : selectedChat.userId ? [selectedChat.userId] : [];

            if (recipients.length === 0) {
                toast({ title: "Call Failed", description: "No participants to call", variant: "destructive" });
                return;
            }

            const adminName = adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : 'Admin';
            const adminAvatar = adminProfile?.image || '';

            // Create call document for each recipient
            const callPromises = recipients.map(recipientId => {
                return addDoc(collection(db, 'calls'), {
                    userId: recipientId,
                    agentId: auth.currentUser?.uid,
                    userName: selectedChat.fullName || 'Unknown User',
                    userImage: selectedChat.userImage || '',
                    agentName: adminName,
                    agentImage: adminAvatar,
                    callerName: adminName,
                    callerAvatar: adminAvatar,
                    callType: 'voice',
                    chatId: selectedChatId,
                    channelName: channelName,
                    callerId: auth.currentUser?.uid,
                    receiverId: isGroup ? selectedChat.id : recipientId,
                    status: 'ringing',
                    startTime: serverTimestamp(),
                    acceptedAt: null,
                    endTime: null,
                    duration: 0,
                    language: 'en',
                    location: '',
                    priority: 'normal',
                    isGroupCall: isGroup,
                    participants: isGroup ? (selectedChat.participants || []) : [auth.currentUser?.uid, recipientId]
                });
            });

            const callRefs = await Promise.all(callPromises);
            const mainCallRef = callRefs[0];

            // ✅ Log call initiation to chat
            const callEmoji = '📞';
            const callText = 'Voice call';

            await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
                content: `${callEmoji} ${callText}`,
                messageType: 'call',
                callType: 'voice',
                callId: mainCallRef.id,
                originalText: callText,
                agentTranslatedText: `${callEmoji} ${callText}`,
                userTranslatedText: `${callEmoji} ${callText}`,
                receiverId: isGroup ? selectedChat.id : recipients[0],
                senderEmail: auth.currentUser?.email || '',
                senderId: auth.currentUser?.uid,
                timestamp: serverTimestamp(),
                status: 'sent'
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
                lastMessage: `${callEmoji} ${callText}`,
                lastMessageTimestamp: serverTimestamp()
            });

            setActiveCall({
                callId: mainCallRef.id,
                chatId: selectedChatId,
                channelName: channelName,
                recipientName: selectedChat.fullName || 'Unknown User',
                recipientImage: selectedChat.userImage,
                callType: 'voice',
                isIncoming: false
            });
        } catch (error) {
            console.error('Error initiating call:', error);
            toast({
                title: "Call Failed",
                description: "Failed to initiate call. Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleVideoCall = async () => {
        if (!selectedChatId || !auth.currentUser) return;
        const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);
        if (!selectedChat) return;

        try {
            const isGroup = selectedChat.type === 'group' || !selectedChat.userId;
            const channelName = isGroup
                ? selectedChat.id
                : generateChannelName(auth.currentUser.uid, selectedChat.userId || '');

            const recipients = isGroup
                ? (selectedChat.participants || []).filter(id => id !== auth.currentUser?.uid)
                : selectedChat.userId ? [selectedChat.userId] : [];

            if (recipients.length === 0) {
                toast({ title: "Call Failed", description: "No participants to call", variant: "destructive" });
                return;
            }

            const adminName = adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : 'Admin';
            const adminAvatar = adminProfile?.image || '';

            const callPromises = recipients.map(recipientId => {
                return addDoc(collection(db, 'calls'), {
                    userId: recipientId,
                    agentId: auth.currentUser?.uid,
                    userName: selectedChat.fullName || 'Unknown User',
                    userImage: selectedChat.userImage || '',
                    agentName: adminName,
                    agentImage: adminAvatar,
                    callerName: adminName,
                    callerAvatar: adminAvatar,
                    callType: 'video',
                    chatId: selectedChatId,
                    channelName: channelName,
                    callerId: auth.currentUser?.uid,
                    receiverId: isGroup ? selectedChat.id : recipientId,
                    status: 'ringing',
                    startTime: serverTimestamp(),
                    acceptedAt: null,
                    endTime: null,
                    duration: 0,
                    language: 'en',
                    location: '',
                    priority: 'normal',
                    isGroupCall: isGroup,
                    participants: isGroup ? (selectedChat.participants || []) : [auth.currentUser?.uid, recipientId]
                });
            });

            const callRefs = await Promise.all(callPromises);
            const mainCallRef = callRefs[0];

            // ✅ Log call initiation to chat
            const callEmoji = '📹';
            const callText = 'Video call';

            await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
                content: `${callEmoji} ${callText}`,
                messageType: 'call',
                callType: 'video',
                callId: mainCallRef.id,
                originalText: callText,
                agentTranslatedText: `${callEmoji} ${callText}`,
                userTranslatedText: `${callEmoji} ${callText}`,
                receiverId: isGroup ? selectedChat.id : recipients[0],
                senderEmail: auth.currentUser?.email || '',
                senderId: auth.currentUser?.uid,
                timestamp: serverTimestamp(),
                status: 'sent'
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
                lastMessage: `${callEmoji} ${callText}`,
                lastMessageTimestamp: serverTimestamp()
            });

            setActiveCall({
                callId: mainCallRef.id,
                chatId: selectedChatId,
                channelName: channelName,
                recipientName: selectedChat.fullName || 'Unknown User',
                recipientImage: selectedChat.userImage,
                callType: 'video',
                isIncoming: false
            });
        } catch (error) {
            console.error('Error initiating video call:', error);
            toast({
                title: "Call Failed",
                description: "Failed to initiate video call. Please try again.",
                variant: "destructive"
            });
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSendMessage = async () => {
        if ((!inputValue.trim() && !attachment) || !selectedChatId || sending) return;

        const adminId = auth.currentUser?.uid;
        if (!adminId) return;

        const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);
        if (!selectedChat) return;

        setSending(true);
        const originalText = inputValue;
        setInputValue('');

        let attachments: Attachment[] = [];

        try {
            // Handle Attachment Upload
            if (attachment) {
                const storageRef = ref(storage, `chat-attachments/${selectedChatId}/${Date.now()}_${attachment.name}`);
                const uploadTask = uploadBytesResumable(storageRef, attachment);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (error) => {
                            console.error("Upload failed:", error);
                            reject(error);
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            let type: Attachment['type'] = 'file';
                            if (attachment.type.startsWith('image/')) type = 'image';
                            else if (attachment.type.startsWith('video/')) type = 'video';
                            else if (attachment.type.startsWith('audio/')) type = 'audio';

                            attachments.push({
                                url: downloadURL,
                                type: type,
                                filename: attachment.name,
                                size: attachment.size
                            });
                            resolve();
                        }
                    );
                });

                // Reset attachment state
                setAttachment(null);
                setUploadProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }

            let userLanguage = 'English';
            let userTranslatedText = originalText;

            if (selectedChat.userId) {
                const userDoc = await getDoc(doc(db, 'users', selectedChat.userId));
                const userProfile = userDoc.exists() ? userDoc.data() : null;
                userLanguage = userProfile?.language || 'English';

                if (userLanguage !== 'English' && originalText) {
                    try {
                        const translateFunction = httpsCallable(functions, 'translateText');
                        const result = await translateFunction({ text: originalText, targetLanguage: userLanguage });
                        userTranslatedText = (result.data as any).translatedText;
                    } catch (err) {
                        console.error("Translation error:", err);
                    }
                }
            }

            const messagesRef = collection(db, 'chats', selectedChatId, 'messages');

            // Use date-fns to format as Local ISO string (no Z) to match Mobile App
            // Format: yyyy-MM-ddTHH:mm:ss.SSS
            const currentIsoTime = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS");

            await addDoc(messagesRef, {
                content: originalText,
                messageType: attachments.length > 0 ? (originalText ? "mixed" : "media") : "text",
                originalText: originalText,
                userTranslatedText: userTranslatedText,
                agentTranslatedText: originalText,
                receiverId: selectedChat.userId || selectedChat.id,
                senderEmail: auth.currentUser?.email || "",
                senderId: adminId,
                timestamp: currentIsoTime, // Matches Mobile App Local ISO String format
                translationTimestamp: serverTimestamp(), // Added to match Mobile App schema
                status: 'sent',
                ...(attachments.length > 0 && { attachments })
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
                lastMessage: attachments.length > 0 ? (originalText || (attachments[0].type === 'audio' ? 'Voice Message' : 'Attachment')) : originalText,
                lastMessageTimestamp: serverTimestamp(), // Parent chat sorting still uses serverTimestamp/Timestamp objects effectively
                unreadCount: 0
            });

        } catch (error) {
            console.error("Error sending message:", error);
            toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
            // Restore input if failed
            if (originalText) setInputValue(originalText);
        } finally {
            setSending(false); // Fixed: Should be false to re-enable button
        }
    };

    const handleReadMore = async (msg: Message) => {
        if (msg.guideContent) {
            setSelectedGuide({
                title: msg.content.split('\n')[0].replace('📚 *', '').replace('*', ''),
                content: msg.guideContent
            });
            return;
        }

        // Retroactive lookup by title
        try {
            const titleMatch = msg.content.match(/\*Title:\* (.*)/);
            if (!titleMatch) return;
            const title = titleMatch[1].trim();

            const q = query(collection(db, "trainingMaterials"), where("title", "==", title), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const guideDoc = querySnapshot.docs[0].data();
                if (guideDoc.type === 'text') {
                    setSelectedGuide({
                        title: guideDoc.title,
                        content: guideDoc.content
                    });
                } else {
                    toast({ title: "Not a guide", description: "This training is a video or document." });
                }
            } else {
                toast({ title: "Not found", description: "This guide content is no longer available." });
            }
        } catch (error) {
            console.error("Error fetching legacy guide:", error);
            toast({ title: "Error", description: "Failed to load guide content." });
        }
    };

    const startNewChat = async (user: any) => {
        const adminId = auth.currentUser?.uid;
        if (!adminId) return;

        try {
            console.log("AdminChatsPage: startNewChat called with user:", user);
            console.log("AdminChatsPage: current adminProfile:", adminProfile);
            console.log("AdminChatsPage: current adminId:", adminId);

            // Deterministic Chat ID
            // Simple comparison for strings (adminId and user.id)
            const chatId = adminId < user.id ? `${adminId}_${user.id}` : `${user.id}_${adminId}`;
            const chatDocRef = doc(db, 'chats', chatId);
            const chatDocSnap = await getDoc(chatDocRef);

            if (chatDocSnap.exists()) {
                const chatData = chatDocSnap.data();
                // If it's a waiting chat or doesn't have an agent, assign yourself
                if (chatData.status === 'waiting' || !chatData.agentId) {
                    await updateDoc(chatDocRef, {
                        agentId: adminId,
                        agentName: adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : 'Admin',
                        status: 'active',
                        participants: chatData.participants ? [...chatData.participants, adminId] : [adminId, user.id],
                        participantInfo: {
                            ...chatData.participantInfo,
                            [adminId]: {
                                email: auth.currentUser?.email || '',
                                name: adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : 'Admin',
                                role: adminProfile?.role || 'Admin'
                            }
                        },
                        type: 'p2p'
                    });
                }
            } else {
                console.log("AdminChatsPage: Creating new chat document with ID:", chatId);
                console.log("AdminChatsPage: Participants:", [adminId, user.id]);
                // Create new unified chat document
                await setDoc(chatDocRef, {
                    agentId: adminId,
                    agentName: adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : 'Admin',
                    userId: user.id,
                    userEmail: user.email || '',
                    userImage: user.image || '',
                    userLanguage: user.language || 'English',
                    status: 'active',
                    createdAt: serverTimestamp(),
                    lastMessage: 'Conversation started',
                    lastMessageTimestamp: serverTimestamp(),
                    unreadCount: 0,
                    type: 'p2p',
                    participants: [adminId, user.id],
                    participantInfo: {
                        [adminId]: {
                            email: auth.currentUser?.email || '',
                            name: adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : 'Admin',
                            role: adminProfile?.role || 'Admin'
                        },
                        [user.id]: {
                            email: user.email || '',
                            name: `${user.firstName} ${user.lastName}`.trim(),
                            role: user.role || 'user'
                        }
                    }
                });
            }

            setSelectedChatId(chatId);
            setIsNewChatOpen(false);

            // Add optmistic entry to userData to ensure name shows up immediately
            setUserData(prev => ({
                ...prev,
                [user.id]: {
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    image: user.image
                }
            }));

            toast({ title: "Chat Started", description: `You can now message ${user.firstName}` });
        } catch (error) {
            console.error("Error creating chat:", error);
            toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
        }
    };

    const filteredUsers = allUsers?.filter(u =>
        u.id !== auth.currentUser?.uid &&
        (`${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()))
    ) || [];

    const adminId = auth.currentUser?.uid;
    const isSuperAdmin = adminProfile?.role?.toLowerCase() === 'super-admin' || adminProfile?.role?.toLowerCase() === 'super admin';

    const sessionsWithNames = chatSessions
        .filter(session => {
            // Filter by chatTab (DM vs Group)
            const sessionType = session.type || 'p2p';
            if (sessionType !== chatTab) return false;

            if (isSuperAdmin) {
                // Super Admin: Only see chats they are part of, OR chats that are waiting
                return session.status === 'waiting' || (session.participants && session.participants.includes(adminId || '')) || sessionType === 'group';
            }
            if (sessionType === 'group') {
                return session.participants?.includes(adminId || '');
            }
            return true;
        })
        .map(session => {
            const sessionType = session.type || 'p2p';
            const isGroup = sessionType === 'group';
            // Fix: Check session.userId before indexing userData
            const user = (!isGroup && session.userId) ? userData[session.userId] : null;
            return {
                ...session,
                fullName: isGroup ? (session.name || 'Group Chat') : (user ? `${user.firstName} ${user.lastName}`.trim() : 'Loading...'),
                userImage: isGroup ? session.userImage : (user?.image || session.userImage)
            };
        })
        .sort((a, b) => {
            const tA = (a.lastMessageTime instanceof Date ? a.lastMessageTime.getTime() : (a.lastMessageTime as any)?.toDate?.().getTime()) || 0;
            const tB = (b.lastMessageTime instanceof Date ? b.lastMessageTime.getTime() : (b.lastMessageTime as any)?.toDate?.().getTime()) || 0;
            return tB - tA;
        });

    const selectedChat = sessionsWithNames.find(chat => chat.id === selectedChatId);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-blue-600" />
                        Admin Chat
                    </h1>
                    <p className="text-sm text-muted-foreground">Communicate with support agents and users</p>
                </div>
                <div className="flex items-center gap-4">
                    <Tabs value={chatTab} onValueChange={(v) => setChatTab(v as 'p2p' | 'group')} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="p2p">Direct Messages</TabsTrigger>
                            <TabsTrigger value="group">Group Chats</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button variant="outline" size="icon" onClick={() => setIsNewChatOpen(true)}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Chat List Sidebar */}
                <Card className="w-80 flex flex-col overflow-hidden">
                    <CardHeader className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search messages..." className="pl-8 h-9" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            {loading ? (
                                <div className="p-4 space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex gap-3 items-center">
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                            <div className="space-y-2 flex-1">
                                                <Skeleton className="h-4 w-1/2" />
                                                <Skeleton className="h-3 w-3/4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : chatSessions.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <p>No active conversations</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {sessionsWithNames.map((chat) => (
                                        <div
                                            key={chat.id}
                                            className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedChatId === chat.id ? 'bg-blue-50/50 border-r-4 border-blue-600' : ''}`}
                                            onClick={() => setSelectedChatId(chat.id)}
                                        >
                                            <div className="flex gap-3">
                                                <Avatar>
                                                    <AvatarImage src={chat.userImage} />
                                                    <AvatarFallback>{chat.fullName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h3 className={`font-semibold text-sm truncate ${selectedChatId === chat.id ? 'text-blue-900' : 'text-slate-900'}`}>
                                                            {chat.fullName} {chat.isSystemGroup && <Badge variant="secondary" className="ml-1 text-[10px] h-4">Official</Badge>}
                                                        </h3>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                                            {(chat.lastMessageTime instanceof Date
                                                                ? chat.lastMessageTime
                                                                : (chat.lastMessageTime as any)?.toDate?.() || new Date()
                                                            ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                                                </div>
                                                {chat.unreadCount > 0 && (
                                                    <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center rounded-full p-0">
                                                        {chat.unreadCount}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Chat Window */}
                <Card className="flex-1 flex flex-col overflow-hidden">
                    {selectedChat ? (
                        <>
                            <CardHeader className="py-4 border-b flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={selectedChat.userImage} />
                                        <AvatarFallback>{selectedChat.type === 'group' ? <UsersIcon className="h-5 w-5" /> : selectedChat.fullName[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold">{selectedChat.fullName}</h3>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            {selectedChat.type === 'group' ? (
                                                <>
                                                    <Badge variant="outline" className="text-[9px] uppercase h-4 px-1">Group Chat</Badge>
                                                    {selectedChat.state && <span>• {selectedChat.state} Region</span>}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                                    Active now
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="gap-1 hidden sm:flex">
                                        <Globe className="h-3 w-3" />
                                        {selectedChat.language}
                                    </Badge>
                                    <Button variant="ghost" size="icon" onClick={handleCall}>
                                        <Phone className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={handleVideoCall}>
                                        <Video className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden p-0 relative">
                                <ScrollArea className="h-full p-4">
                                    <div className="space-y-4">
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[80%] rounded-lg p-3 ${msg.senderId === auth.currentUser?.uid
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-100 text-slate-900 border'
                                                    }`}>
                                                    {/* Render Attachments */}
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="space-y-2 mb-2">
                                                            {msg.attachments.map((attachment, idx) => (
                                                                <div key={idx} className="overflow-hidden rounded-md">
                                                                    {attachment.type === 'image' ? (
                                                                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                                                            <img src={attachment.url} alt={attachment.filename} className="max-w-full h-auto max-h-60 object-cover" />
                                                                        </a>
                                                                    ) : attachment.type === 'video' ? (
                                                                        <video src={attachment.url} controls className="max-w-full h-auto max-h-60" />
                                                                    ) : attachment.type === 'audio' ? (
                                                                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border">
                                                                            <audio src={attachment.url} controls className="h-8 max-w-[200px]" />
                                                                        </div>
                                                                    ) : (
                                                                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 rounded border hover:bg-slate-100">
                                                                            <FileIcon className="h-4 w-4 text-blue-500" />
                                                                            <span className="text-xs truncate max-w-[150px] text-blue-600 underline">{attachment.filename}</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                                                    {(msg.trainingType === 'guide' || (msg.content?.includes('📚 *New Training Module Published*') && !msg.attachments?.length && !msg.content.includes('http'))) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="mt-2 w-full bg-white/10 hover:bg-white/20 border-white/20 text-white"
                                                            onClick={() => handleReadMore(msg)}
                                                        >
                                                            Read More Guides
                                                        </Button>
                                                    )}
                                                    {msg.userTranslatedText && msg.userTranslatedText !== msg.content && msg.senderId === auth.currentUser?.uid && (
                                                        <p className="text-[10px] opacity-70 mt-1 italic border-t border-white/20 pt-1">
                                                            Translated: {msg.userTranslatedText}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-end gap-1 mt-1">
                                                        <span className="text-[10px] opacity-50">
                                                            {(() => {
                                                                if (!msg.timestamp) return 'sending...';
                                                                let date;
                                                                if (typeof msg.timestamp?.toDate === 'function') {
                                                                    date = msg.timestamp.toDate();
                                                                } else if (msg.timestamp instanceof Date) {
                                                                    date = msg.timestamp;
                                                                } else {
                                                                    date = new Date(msg.timestamp); // Handle string/number
                                                                }

                                                                return !isNaN(date.getTime())
                                                                    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                    : '';
                                                            })()}
                                                        </span>
                                                        {msg.senderId === auth.currentUser?.uid && (
                                                            <MessageStatus status={msg.status} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <div className="p-4 border-t bg-slate-50/50">
                                {/* Hidden File Input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept={fileAccept}
                                />

                                {/* Attachment Preview */}
                                {attachment && (
                                    <div className="mb-2 p-2 bg-white rounded-md border flex items-center justify-between shadow-sm animate-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {attachment.type.startsWith('image/') ? (
                                                <ImageIcon className="h-4 w-4 text-purple-500" />
                                            ) : attachment.type.startsWith('video/') ? (
                                                <Film className="h-4 w-4 text-blue-500" />
                                            ) : attachment.type.startsWith('audio/') ? (
                                                <Mic className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <FileIcon className="h-4 w-4 text-slate-500" />
                                            )}
                                            <span className="text-xs truncate max-w-[200px] font-medium">{attachment.name}</span>
                                            <span className="text-[10px] text-muted-foreground">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRemoveAttachment}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}

                                {/* Recording Indicator */}
                                {isRecording && (
                                    <div className="mb-2 p-2 bg-red-50 text-red-600 rounded-md border border-red-100 flex items-center justify-between animate-pulse">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 bg-red-600 rounded-full animate-ping" />
                                            <span className="text-xs font-semibold">Recording Voice Note... {formatTime(recordingTime)}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-100" onClick={handleVoiceRecord}>
                                            <Square className="h-3 w-3 fill-current" />
                                        </Button>
                                    </div>
                                )}

                                {uploadProgress > 0 && uploadProgress < 100 && (
                                    <div className="mb-2 w-full bg-slate-200 rounded-full h-1.5 dark:bg-slate-700">
                                        <div
                                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                )}

                                <div className="relative flex-1">
                                    <Input
                                        placeholder={isRecording ? "Recording..." : "Type a message..."}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        disabled={sending || isRecording}
                                        className="pl-10 pr-20"
                                    />
                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    disabled={isRecording || sending}
                                                >
                                                    <Paperclip className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => handleAttachmentClick("image/*")}>
                                                    <ImageIcon className="mr-2 h-4 w-4" />
                                                    <span>Image</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAttachmentClick("video/*")}>
                                                    <Film className="mr-2 h-4 w-4" />
                                                    <span>Video</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAttachmentClick("audio/*")}>
                                                    <Mic className="mr-2 h-4 w-4" />
                                                    <span>Audio File</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleAttachmentClick(".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document")}>
                                                    <FileIcon className="mr-2 h-4 w-4" />
                                                    <span>Document</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-8 w-8 ${isRecording ? 'text-red-500 hover:text-red-600 bg-red-50' : 'text-muted-foreground hover:text-foreground'}`}
                                            onClick={handleVoiceRecord}
                                            disabled={sending || (!!attachment && !isRecording)}
                                        >
                                            {isRecording ? <Square className="h-3 w-3 fill-current" /> : <Mic className="h-4 w-4" />}
                                        </Button>
                                        <Button size="icon" onClick={handleSendMessage} disabled={(!inputValue.trim() && !attachment) || sending || isRecording} className="h-8 w-8 rounded-full">
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                            <p>Select a conversation to start chatting</p>
                            <Button variant="link" onClick={() => setIsNewChatOpen(true)}>Or start a new one</Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* New Chat Dialog */}
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Conversation</DialogTitle>
                        <DialogDescription>Search for a user or support agent to start a chat.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or email..."
                                className="pl-9"
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-[300px] border rounded-md p-2">
                            <div className="space-y-1">
                                {filteredUsers.length === 0 ? (
                                    <p className="text-center text-xs text-muted-foreground py-8">No matching users found</p>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition-colors"
                                            onClick={() => startNewChat(user)}
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.image} />
                                                <AvatarFallback>{user.firstName[0]}</AvatarFallback>
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
            {/* Active Call Interface */}
            {activeCall && (
                <CallInterface
                    callId={activeCall.callId}
                    chatId={activeCall.chatId}
                    channelName={activeCall.channelName}
                    recipientName={activeCall.recipientName}
                    recipientImage={activeCall.recipientImage}
                    callType={activeCall.callType}
                    isIncoming={activeCall.isIncoming}
                    onClose={() => setActiveCall(null)}
                />
            )}

            {/* Guide Content Dialog */}
            <Dialog open={!!selectedGuide} onOpenChange={(open) => !open && setSelectedGuide(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{selectedGuide?.title || 'Training Guide'}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 mt-4 pr-4">
                        <div className="text-sm whitespace-pre-wrap text-slate-700 pb-4">
                            {selectedGuide?.content}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={() => setSelectedGuide(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
} // End AdminChatsPage
