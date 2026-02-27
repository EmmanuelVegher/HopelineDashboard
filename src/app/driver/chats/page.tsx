"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    MessageSquare,
    Send,
    Search,
    Plus,
    Phone,
    Video,
    Paperclip,
    Mic,
    X,
    File as FileIcon,
    Square,
    Users as UsersIcon,
    ArrowLeft
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    // Timestamp is unused
    collection,
    addDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    orderBy,
    limit,
    arrayUnion,
    getDocs
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, auth, storage } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { MessageStatus } from "@/components/message-status";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthState } from "react-firebase-hooks/auth";
import { CallInterface } from "@/components/chat/call-interface";
import { generateChannelName } from "@/lib/agora";
import { useTranslation } from 'react-i18next';

interface ChatSession {
    id: string;
    participants: string[];
    participantInfo?: Record<string, { name: string, email: string, role?: string, avatar?: string }>;
    lastMessage: string;
    lastMessageTime: any;
    unreadCount: number;
    type?: 'p2p' | 'group';
    name?: string;
    lastMessageSenderId?: string;
    lastMessageSenderName?: string;
    userId?: string;
    fullName?: string;
    userImage?: string;
    userEmail?: string;
    status?: string;
    agentId?: string;
    agentName?: string;
    state?: string;
    isSystemGroup?: boolean;
    language?: string;
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
    messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'mixed' | 'media';
    status: 'sent' | 'delivered' | 'read';
    senderEmail?: string;
    originalText?: string;
    userTranslatedText?: string;
    agentTranslatedText?: string;
    attachments?: Attachment[];
    trainingType?: 'guide' | 'media' | 'text';
    guideContent?: string;
}

export default function DriverChatsPage() {
    const { t } = useTranslation();
    const [user] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<Record<string, { firstName: string, lastName: string, image?: string, imageUrl?: string, profileImage?: string, photoURL?: string, photoUrl?: string, avatar?: string }>>({});
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [chatTab, setChatTab] = useState<'p2p' | 'group'>('p2p');
    // searchParams is unused for now
    // const [searchParams] = useSearchParams();
    // targetedUserId is currently unused but kept for parity if needed
    // const targetedUserId = searchParams.get('userId');

    // Media State
    const [isRecording, setIsRecording] = useState(false);
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

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Fetch Driver Profile
    useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUserProfile({
                        ...data,
                        image: data.image || data.imageUrl || data.profileImage || data.photoURL || data.photoUrl || data.avatar || ''
                    });
                }
            };
            fetchProfile();
        }
    }, [user]);

    // Fetch All Users in same state for DM
    useEffect(() => {
        if (userProfile?.state) {
            const q = query(
                collection(db, 'users'),
                where('state', '==', userProfile.state),
                limit(100)
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllUsers(users);

                // Also update userData map for name resolution
                const newUserData: Record<string, any> = {};
                users.forEach((u: any) => {
                    newUserData[u.id] = {
                        firstName: u.firstName || '',
                        lastName: u.lastName || '',
                        image: u.image || u.imageUrl || u.profileImage || u.photoURL || u.photoUrl || u.avatar || ''
                    };
                });
                setUserData(prev => ({ ...prev, ...newUserData }));
            }, (error) => {
                console.error("Users listener error:", error);
            });
            return () => unsubscribe();
        }
    }, [userProfile?.state]);

    // Fetch missing participant data
    useEffect(() => {
        if (!chatSessions.length) return;

        const missingUserIds = new Set<string>();
        chatSessions.forEach(session => {
            session.participants.forEach(id => {
                if (!userData[id] && id !== user?.uid) {
                    missingUserIds.add(id);
                }
            });
        });

        if (missingUserIds.size > 0) {
            missingUserIds.forEach(async (id) => {
                // Prevent duplicate requests for the same ID in this cycle
                if (userData[id]) return;

                try {
                    const docSnap = await getDoc(doc(db, 'users', id));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserData(prev => ({
                            ...prev,
                            [id]: {
                                firstName: data.firstName || '',
                                lastName: data.lastName || '',
                                image: data.image || data.imageUrl || data.profileImage || data.photoURL || data.photoUrl || data.avatar || ''
                            }
                        }));
                    }
                } catch (e) {
                    console.error(`Error fetching missing user ${id}:`, e);
                }
            });
        }
    }, [chatSessions, user?.uid, userData]);

    // Ensure State Groups Exist and Join
    useEffect(() => {
        const ensureStateGroups = async () => {
            if (!userProfile?.state || !user?.uid) return;

            const stateToInit = userProfile.state;
            const rolesToEnsure = ['driver', 'beneficiary', 'user'];

            for (const role of rolesToEnsure) {
                const localizedRole = t(`roles.${role.toLowerCase()}`) || role;
                const groupName = `${stateToInit} ${localizedRole}`;
                const groupId = `group_${stateToInit.toLowerCase().replace(/\s+/g, '_')}_${role.toLowerCase().replace(/\s+/g, '_')}`;

                const docRef = doc(db, 'chats', groupId);

                try {
                    // Try to join directly. Rule 114/115 allows adding oneself to participants.
                    await updateDoc(docRef, {
                        participants: arrayUnion(user.uid),
                        [`participantInfo.${user.uid}`]: {
                            name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || t('roles.driver'),
                            role: userProfile.role || 'driver',
                            email: user.email || '',
                            avatar: userProfile.image || userProfile.imageUrl || userProfile.profileImage || userProfile.photoURL || userProfile.photoUrl || userProfile.avatar || ''
                        },
                        updatedAt: serverTimestamp()
                    });
                } catch (e: any) {
                    // If error is not-found, the group doesn't exist yet, so create it
                    if (e.code === 'not-found') {
                        try {
                            await setDoc(docRef, {
                                id: groupId,
                                name: groupName,
                                type: 'group',
                                isSystemGroup: true,
                                targetRole: role,
                                state: stateToInit,
                                participants: [user.uid],
                                participantInfo: {
                                    [user.uid]: {
                                        name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || t('roles.driver'),
                                        role: userProfile.role || 'driver',
                                        email: user.email || ''
                                    }
                                },
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                                lastMessage: t('driver.chats.welcomeMessage', { groupName }),
                                lastMessageTime: serverTimestamp(),
                                unreadCount: 0,
                                status: 'active'
                            });
                        } catch (err) {
                            console.error(`Error creating group ${groupId}:`, err);
                        }
                    } else {
                        console.error(`Error joining group ${groupId}:`, e);
                    }
                }
            }
        };

        ensureStateGroups();
    }, [userProfile, user?.uid]);

    // Fetch chat sessions
    useEffect(() => {
        if (!user?.uid || !userProfile) return;

        setLoading(true);
        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
            setChatSessions(sessions);
            setLoading(false);
        }, (error) => {
            console.error("Chat sessions listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid, userProfile]);

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
                msgs.push({ ...doc.data(), id: doc.id } as Message);
            });

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

            snapshot.docs.forEach(async (doc) => {
                const data = doc.data() as Message;
                if (data.senderId !== user?.uid && data.status !== 'read') {
                    await updateDoc(doc.ref, { status: 'read' });
                }
            });
        }, (error) => {
            console.error("Message listener error:", error);
            if (error.code === 'permission-denied') {
                toast({ title: t('driver.chats.accessRestricted'), description: t('driver.chats.accessRestrictedDesc'), variant: "destructive" });
            }
        });

        return () => unsubscribe();
    }, [selectedChatId, user?.uid, toast]);

    const handleAttachmentClick = (acceptType: string) => {
        setFileAccept(acceptType);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast({ title: t('driver.chats.fileTooLarge'), description: t('driver.chats.fileTooLargeDesc'), variant: "destructive" });
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
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                    setAttachment(audioFile);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsRecording(true);
                timerRef.current = setInterval(() => { }, 1000);
            } catch (error) {
                console.error("Mic error:", error);
                toast({ title: t('driver.chats.error'), description: t('driver.chats.micError'), variant: "destructive" });
            }
        }
    };

    const handleCall = async () => {
        if (!selectedChatId || !user) return;
        const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);
        if (!selectedChat) return;

        try {
            const isGroup = selectedChat.type === 'group';
            const channelName = isGroup ? selectedChat.id : generateChannelName(user.uid, selectedChat.userId || '');
            const recipients = isGroup ? (selectedChat.participants || []).filter(id => id !== user.uid) : (selectedChat.userId ? [selectedChat.userId] : []);

            if (recipients.length === 0) {
                toast({ title: t('driver.chats.callFailed'), description: t('driver.chats.noParticipants'), variant: "destructive" });
                return;
            }

            const callerName = `${userProfile.firstName} ${userProfile.lastName}`;
            const callerAvatar = userProfile.image || userProfile.imageUrl || userProfile.profileImage || userProfile.photoURL || userProfile.photoUrl || userProfile.avatar || '';

            const callDoc = await addDoc(collection(db, 'calls'), {
                userId: recipients[0],
                agentId: user.uid,
                userName: selectedChat.fullName || t('common.user'),
                userImage: selectedChat.userImage || '',
                agentName: callerName,
                agentImage: callerAvatar,
                callerName: callerName,
                callerAvatar: callerAvatar,
                callType: 'voice',
                chatId: selectedChatId,
                channelName: channelName,
                callerId: user.uid,
                receiverId: isGroup ? selectedChat.id : recipients[0],
                status: 'ringing',
                startTime: serverTimestamp(),
                isGroupCall: isGroup,
                participants: isGroup ? (selectedChat.participants || []) : [user.uid, recipients[0]]
            });

            // ✅ Log call initiation to chat
            const callEmoji = '📞';
            const callText = t('driver.chats.voiceCall');

            await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
                content: `${callEmoji} ${callText}`,
                messageType: 'call',
                callType: 'voice',
                callId: callDoc.id,
                originalText: callText,
                agentTranslatedText: `${callEmoji} ${callText}`,
                userTranslatedText: `${callEmoji} ${callText}`,
                receiverId: isGroup ? selectedChat.id : recipients[0],
                senderEmail: user?.email || '',
                senderId: user?.uid,
                timestamp: serverTimestamp(),
                status: 'sent'
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
                lastMessage: `${callEmoji} ${callText}`,
                lastMessageTimestamp: serverTimestamp()
            });

            setActiveCall({
                callId: callDoc.id,
                chatId: selectedChatId,
                channelName: channelName,
                recipientName: selectedChat.fullName || t('common.user'),
                recipientImage: selectedChat.userImage,
                callType: 'voice',
                isIncoming: false
            });
        } catch (error) {
            console.error('Call error:', error);
            toast({ title: t('driver.chats.callFailed'), description: t('driver.chats.callInitiateError'), variant: "destructive" });
        }
    };

    const handleVideoCall = async () => {
        if (!selectedChatId || !user) return;
        const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);
        if (!selectedChat) return;

        try {
            const isGroup = selectedChat.type === 'group';
            const channelName = isGroup ? selectedChat.id : generateChannelName(user.uid, selectedChat.userId || '');
            const recipients = isGroup ? (selectedChat.participants || []).filter(id => id !== user.uid) : (selectedChat.userId ? [selectedChat.userId] : []);

            if (recipients.length === 0) {
                toast({ title: t('driver.chats.callFailed'), description: t('driver.chats.noParticipants'), variant: "destructive" });
                return;
            }

            const callerName = `${userProfile.firstName} ${userProfile.lastName}`;
            const callerAvatar = userProfile.image || userProfile.imageUrl || userProfile.profileImage || userProfile.photoURL || userProfile.photoUrl || userProfile.avatar || '';

            const callDoc = await addDoc(collection(db, 'calls'), {
                userId: recipients[0],
                agentId: user.uid,
                userName: selectedChat.fullName || t('common.user'),
                userImage: selectedChat.userImage || '',
                agentName: callerName,
                agentImage: callerAvatar,
                callerName: callerName,
                callerAvatar: callerAvatar,
                callType: 'video',
                chatId: selectedChatId,
                channelName: channelName,
                callerId: user.uid,
                receiverId: isGroup ? selectedChat.id : recipients[0],
                status: 'ringing',
                startTime: serverTimestamp(),
                isGroupCall: isGroup,
                participants: isGroup ? (selectedChat.participants || []) : [user.uid, recipients[0]]
            });

            // ✅ Log call initiation to chat
            const callEmoji = '📹';
            const callText = t('driver.chats.videoCall');

            await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
                content: `${callEmoji} ${callText}`,
                messageType: 'call',
                callType: 'video',
                callId: callDoc.id,
                originalText: callText,
                agentTranslatedText: `${callEmoji} ${callText}`,
                userTranslatedText: `${callEmoji} ${callText}`,
                receiverId: isGroup ? selectedChat.id : recipients[0],
                senderEmail: user?.email || '',
                senderId: user?.uid,
                timestamp: serverTimestamp(),
                status: 'sent'
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
                lastMessage: `${callEmoji} ${callText}`,
                lastMessageTimestamp: serverTimestamp()
            });

            setActiveCall({
                callId: callDoc.id,
                chatId: selectedChatId,
                channelName: channelName,
                recipientName: selectedChat.fullName || t('common.user'),
                recipientImage: selectedChat.userImage,
                callType: 'video',
                isIncoming: false
            });
        } catch (error) {
            console.error('Video call error:', error);
            toast({ title: t('driver.chats.callFailed'), description: t('driver.chats.videoCallInitiateError'), variant: "destructive" });
        }
    };

    const handleSendMessage = async () => {
        if ((!inputValue.trim() && !attachment) || !selectedChatId || sending) return;

        setSending(true);
        const originalText = inputValue;
        setInputValue('');

        let attachments: Attachment[] = [];

        try {
            if (attachment) {
                const storageRef = ref(storage, `chat-attachments/${selectedChatId}/${Date.now()}_${attachment.name}`);
                const uploadTask = uploadBytesResumable(storageRef, attachment);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        reject,
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            attachments.push({
                                url: downloadURL,
                                type: attachment.type.startsWith('image/') ? 'image' : attachment.type.startsWith('video/') ? 'video' : attachment.type.startsWith('audio/') ? 'audio' : 'file',
                                filename: attachment.name,
                                size: attachment.size
                            });
                            setUploadProgress(0);
                            resolve();
                        }
                    );
                });
                setAttachment(null);
            }

            const currentIsoTime = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS");
            const selectedChat = chatSessions.find(chat => chat.id === selectedChatId);

            await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
                content: originalText,
                messageType: attachments.length > 0 ? (originalText ? "mixed" : "media") : "text",
                originalText: originalText,
                receiverId: selectedChat?.userId || selectedChatId,
                senderEmail: user?.email || "",
                senderId: user?.uid,
                timestamp: currentIsoTime,
                translationTimestamp: serverTimestamp(),
                status: 'sent',
                ...(attachments.length > 0 && { attachments })
            });

            await updateDoc(doc(db, 'chats', selectedChatId), {
                lastMessage: attachments.length > 0 ? (originalText || (attachments[0].type === 'audio' ? t('driver.chats.voiceMessage') : t('driver.chats.attachment'))) : originalText,
                lastMessageTimestamp: serverTimestamp(),
                lastMessageSenderId: user?.uid,
                lastMessageSenderName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || t('roles.driver'),
                unreadCount: 0
            });
        } catch (error) {
            console.error("Send error:", error);
            setInputValue(originalText);
            toast({ title: t('driver.chats.error'), description: t('driver.chats.sendError'), variant: "destructive" });
        } finally {
            setSending(false);
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
                    toast({ title: t('driver.chats.notAGuide'), description: t('driver.chats.notAGuideDesc') });
                }
            } else {
                toast({ title: t('driver.chats.notFound'), description: t('driver.chats.guideNotFoundDesc') });
            }
        } catch (error) {
            console.error("Error fetching legacy guide:", error);
            toast({ title: t('driver.chats.error'), description: t('driver.chats.loadGuideError') });
        }
    };

    const startNewChat = async (targetUser: any) => {
        const adminId = user?.uid;
        if (!adminId) return;

        try {
            const chatId = adminId < targetUser.id ? `${adminId}_${targetUser.id}` : `${targetUser.id}_${adminId}`;
            const chatDocRef = doc(db, 'chats', chatId);
            const chatDocSnap = await getDoc(chatDocRef);

            if (!chatDocSnap.exists()) {
                await setDoc(chatDocRef, {
                    agentId: adminId,
                    agentName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Driver',
                    userId: targetUser.id,
                    userEmail: targetUser.email || '',
                    userImage: targetUser.image || targetUser.imageUrl || targetUser.profileImage || targetUser.photoURL || targetUser.photoUrl || targetUser.avatar || '',
                    status: 'active',
                    createdAt: serverTimestamp(),
                    lastMessage: t('driver.chats.conversationStarted'),
                    lastMessageTimestamp: serverTimestamp(),
                    unreadCount: 0,
                    type: 'p2p',
                    participants: [adminId, targetUser.id],
                    participantInfo: {
                        [adminId]: { email: user.email || '', name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Driver', role: userProfile.role || 'driver', avatar: userProfile.image || userProfile.imageUrl || userProfile.profileImage || userProfile.photoURL || userProfile.photoUrl || userProfile.avatar || '' },
                        [targetUser.id]: { email: targetUser.email || '', name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.displayName || 'User', role: targetUser.role || 'user', avatar: targetUser.image || targetUser.imageUrl || targetUser.profileImage || targetUser.photoURL || targetUser.photoUrl || targetUser.avatar || '' }
                    }
                });
            }

            setSelectedChatId(chatId);
            setIsNewChatOpen(false);
            toast({ title: t('driver.chats.chatStarted'), description: t('driver.chats.chatStartedDesc', { firstName: targetUser.firstName }) });
        } catch (error) {
            console.error("New chat error:", error);
            toast({ title: t('driver.chats.error'), description: t('driver.chats.startChatError'), variant: "destructive" });
        }
    };

    const filteredUsers = allUsers.filter(u =>
        u.id !== user?.uid &&
        (`${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()))
    );

    const sessionsWithNames = chatSessions
        .filter(s => (s.type || 'p2p') === chatTab)
        .map(session => {
            const isGroup = session.type === 'group';
            const otherParticipantId = session.participants.find(id => id !== user?.uid);

            // Resolve identities by cross-referencing participantInfo and userData
            const resolveIdentity = (id: string) => {
                const info = session.participantInfo?.[id];
                const data = userData[id];
                return {
                    name: data ? `${data.firstName} ${data.lastName}`.trim() : (info?.name || t('common.user')),
                    image: data?.image || data?.imageUrl || data?.profileImage || data?.photoURL || data?.photoUrl || data?.avatar || info?.avatar || ''
                };
            };

            const mainIdentity = isGroup ? { name: session.name || 'Group Chat', image: session.userImage } : resolveIdentity(otherParticipantId || '');

            // Resolve last message sender
            let lastSenderName = session.lastMessageSenderName;
            if (!lastSenderName && session.lastMessageSenderId) {
                lastSenderName = resolveIdentity(session.lastMessageSenderId).name;
            }

            return {
                ...session,
                fullName: mainIdentity.name,
                userImage: mainIdentity.image,
                resolvedLastSenderName: lastSenderName
            };
        })
        .sort((a, b) => {
            const getT = (t: any) => {
                if (!t) return 0;
                if (t instanceof Date) return t.getTime();
                if (typeof t.toDate === 'function') return t.toDate().getTime();
                return new Date(t).getTime();
            };
            return getT(b.lastMessageTime) - getT(a.lastMessageTime);
        });

    const selectedChat = sessionsWithNames.find(c => c.id === selectedChatId);

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-blue-600" />
                        {t('driver.chats.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t('driver.chats.subtitle', { state: userProfile?.state })}</p>
                </div>
                <div className="flex items-center gap-4">
                    <Tabs value={chatTab} onValueChange={(v) => setChatTab(v as any)} className="w-full sm:w-[300px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="p2p">{t('driver.chats.directMessages')}</TabsTrigger>
                            <TabsTrigger value="group">{t('driver.chats.groupChats')}</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button variant="outline" size="icon" onClick={() => setIsNewChatOpen(true)}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
                {/* Chat List Sidebar */}
                <Card className={`w-80 flex flex-col overflow-hidden ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                    <CardHeader className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder={t('driver.chats.searchChats')} className="pl-8 h-9" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            {loading ? (
                                <div className="p-4 space-y-4">
                                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            ) : sessionsWithNames.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    <p>{t('driver.chats.noConversations')}</p>
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
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={chat.userImage} />
                                                    <AvatarFallback>{chat.fullName?.[0] || '?'}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h3 className="font-semibold text-sm truncate">{chat.fullName}</h3>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {(() => {
                                                                const t = chat.lastMessageTime;
                                                                const date = t?.toDate?.() || (t instanceof Date ? t : new Date(t));
                                                                return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate italic">
                                                        {chat.resolvedLastSenderName ? (
                                                            <span className="font-semibold not-italic mr-1">{chat.resolvedLastSenderName === `${userProfile?.firstName} ${userProfile?.lastName}` ? t('driver.chats.you') : chat.resolvedLastSenderName.split(' ')[0]}:</span>
                                                        ) : ''}
                                                        {chat.lastMessage}
                                                    </p>

                                                    {chat.participantInfo && (
                                                        <div className="flex items-center gap-2 mt-1.5 overflow-hidden">
                                                            <div className="flex -space-x-1.5">
                                                                {Object.entries(chat.participantInfo).slice(0, 4).map(([id, info]: [string, any]) => {
                                                                    const resolvedImage = userData[id]?.image || userData[id]?.imageUrl || userData[id]?.profileImage || userData[id]?.photoURL || userData[id]?.photoUrl || userData[id]?.avatar || info.avatar;
                                                                    const resolvedName = userData[id] ? `${userData[id].firstName} ${userData[id].lastName}` : info.name;

                                                                    return (
                                                                        <Avatar key={id} title={resolvedName} className="h-5 w-5 border border-white ring-1 ring-slate-100">
                                                                            <AvatarImage src={resolvedImage} />
                                                                            <AvatarFallback className="text-[8px] bg-slate-100 font-bold">{resolvedName?.[0] || '?'}</AvatarFallback>
                                                                        </Avatar>
                                                                    );
                                                                })}
                                                                {Object.keys(chat.participantInfo).length > 4 && (
                                                                    <div className="h-5 w-5 rounded-full bg-slate-100 border border-white ring-1 ring-slate-100 flex items-center justify-center text-[8px] text-muted-foreground font-medium">
                                                                        +{Object.keys(chat.participantInfo).length - 4}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[9px] text-muted-foreground truncate font-medium">
                                                                    {Object.values(chat.participantInfo).map((p: any) => p.name).join(', ')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Chat Window */}
                <Card className={`flex-1 flex flex-col overflow-hidden ${!selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                    {selectedChat ? (
                        <>
                            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedChatId(null)}>
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <Avatar>
                                        <AvatarImage src={selectedChat.userImage} />
                                        <AvatarFallback>{selectedChat.type === 'group' ? <UsersIcon className="h-5 w-5" /> : selectedChat.fullName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-sm">{selectedChat.fullName}</h3>
                                        <Badge variant="outline" className="text-[10px] h-4 py-0">{selectedChat.type === 'group' ? t('driver.chats.communityGroupBadge') : t('driver.chats.directMessageBadge')}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={handleCall}><Phone className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={handleVideoCall}><Video className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50/30">
                                <ScrollArea className="h-full p-4">
                                    <div className="space-y-4">
                                        {messages.map((msg) => {
                                            const isMe = msg.senderId === user?.uid;
                                            const resolvedSenderInfo = (() => {
                                                const profile = isMe ? userProfile : userData[msg.senderId];
                                                const info = selectedChat.participantInfo?.[msg.senderId];

                                                return {
                                                    name: profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : (info?.name || t('common.user')),
                                                    image: profile?.image || profile?.imageUrl || profile?.profileImage || profile?.photoURL || profile?.photoUrl || profile?.avatar || info?.avatar || ''
                                                };
                                            })();

                                            return (
                                                <div key={msg.id} className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 mb-4`}>
                                                    <Avatar className="h-8 w-8 mt-1 border shadow-sm flex-shrink-0">
                                                        <AvatarImage src={resolvedSenderInfo.image} />
                                                        <AvatarFallback className="text-[10px] font-bold bg-slate-100">{resolvedSenderInfo.name?.[0] || '?'}</AvatarFallback>
                                                    </Avatar>

                                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] gap-1`}>
                                                        <span className="text-[11px] font-semibold text-slate-500 px-1">{isMe ? t('driver.chats.you') : resolvedSenderInfo.name}</span>
                                                        <div className={`rounded-2xl p-3 shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-900 border rounded-tl-none'}`}>
                                                            {msg.attachments && msg.attachments.map((a, i) => (
                                                                <div key={i} className="mb-2 rounded overflow-hidden">
                                                                    {a.type === 'image' && <img src={a.url} className="max-h-60 w-full object-cover" />}
                                                                    {a.type === 'audio' && <audio src={a.url} controls className="w-full h-8 scale-90 origin-left" />}
                                                                    {a.type === 'video' && <video src={a.url} controls className="max-h-60 w-full object-cover" />}
                                                                    {a.type === 'file' && <div className="p-2 bg-slate-50 rounded border flex items-center gap-2"><FileIcon className="h-4 w-4 text-blue-500" /><span className="text-xs truncate">{a.filename}</span></div>}
                                                                </div>
                                                            ))}
                                                            {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                                                            {(msg.trainingType === 'guide' || (msg.content?.toLowerCase().includes('training') || msg.content?.toLowerCase().includes('horarwa')) && !msg.attachments?.length && !msg.content.includes('http')) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="mt-2 w-full bg-white/10 hover:bg-white/20 border-white/20 text-white"
                                                                    onClick={() => handleReadMore(msg)}
                                                                >
                                                                    {t('driver.chats.readMoreGuides')}
                                                                </Button>
                                                            )}
                                                            <div className="flex justify-end items-center gap-1 mt-1 opacity-70">
                                                                <span className="text-[10px]">
                                                                    {(() => {
                                                                        const t = msg.timestamp;
                                                                        const date = t?.toDate?.() || (t instanceof Date ? t : new Date(t));
                                                                        return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                    })()}
                                                                </span>
                                                                {msg.senderId === user?.uid && <MessageStatus status={msg.status} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <div className="p-3 border-t bg-white">
                                <div className="flex flex-col gap-2">
                                    {attachment && (
                                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border text-xs">
                                            <span className="truncate">{attachment.name}</span>
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleRemoveAttachment}><X className="h-3 w-3" /></Button>
                                        </div>
                                    )}
                                    {uploadProgress > 0 && (
                                        <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                            <div className="bg-blue-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400"><Paperclip className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => handleAttachmentClick("image/*")}>{t('driver.chats.image')}</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAttachmentClick("video/*")}>{t('driver.chats.video')}</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAttachmentClick("audio/*")}>{t('driver.chats.audio')}</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAttachmentClick(".pdf,.doc,.docx")}>{t('driver.chats.document')}</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Input
                                            placeholder={t('driver.chats.messagePlaceholder')}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            className="h-10 rounded-full border-slate-200 bg-slate-50 focus:bg-white"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-9 w-9 ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                                            onClick={handleVoiceRecord}
                                        >
                                            {isRecording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept={fileAccept}
                                            className="hidden"
                                        />
                                        <Button size="icon" className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 shadow-md" onClick={handleSendMessage} disabled={(!inputValue.trim() && !attachment) || sending}>
                                            <Send className="h-4 w-4 text-white" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="h-8 w-8 opacity-20" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('driver.chats.emptyInboxTitle')}</h3>
                            <p className="max-w-[250px] mb-4 text-sm">{t('driver.chats.emptyInboxDesc')}</p>
                            <Button className="rounded-full px-6" onClick={() => setIsNewChatOpen(true)}>{t('driver.chats.newConversation')}</Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* New Chat Dialog */}
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('driver.chats.startConversation')}</DialogTitle>
                        <DialogDescription>{t('driver.chats.findUsersInState', { state: userProfile?.state })}</DialogDescription>
                    </DialogHeader>
                    <div className="relative my-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder={t('driver.chats.searchNameOrRole')} className="pl-9" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} />
                    </div>
                    <ScrollArea className="h-72 border rounded-xl">
                        <div className="p-2 space-y-1">
                            {filteredUsers.length === 0 ? (
                                <p className="text-center text-xs text-muted-foreground py-10">{t('driver.chats.noUsersFound')}</p>
                            ) : (
                                filteredUsers.map(u => (
                                    <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors" onClick={() => startNewChat(u)}>
                                        <Avatar className="h-8 w-8"><AvatarImage src={u.image} /><AvatarFallback>{u.firstName[0]}</AvatarFallback></Avatar>
                                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.firstName} {u.lastName}</p><p className="text-[10px] text-muted-foreground uppercase">{t(`roles.${u.role?.toLowerCase()}`) || u.role}</p></div>
                                        <Plus className="h-4 w-4 text-slate-300" />
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

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
                        <DialogTitle>{selectedGuide?.title || t('driver.chats.trainingGuide')}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 mt-4 pr-4">
                        <div className="text-sm whitespace-pre-wrap text-slate-700 pb-4">
                            {selectedGuide?.content}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={() => setSelectedGuide(null)}>{t('driver.chats.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Inlined ArrowLeft as it was missing from standard lucide-react in some environments
// but I added it to the imports above just in case.
