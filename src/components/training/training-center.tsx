"use client";

import { useState, useEffect } from "react";
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    BookOpen,
    FileText,
    Image as ImageIcon,
    File as FileIcon,
    Plus,
    Search,
    Video,
    GraduationCap,
    Info,
    CheckCircle,
    Clock,
    ChevronRight,
    Eye,
    LayoutDashboard,
    Settings,
    Loader2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { db, auth, storage } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, collection, addDoc, serverTimestamp, getDocs, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

interface TrainingModule {
    id: string;
    title: string;
    description: string;
    type: 'video' | 'text' | 'image' | 'document';
    category: 'Crisis Response' | 'Technical Support' | 'Security Protocols' | 'Onboarding';
    url?: string;
    thumbnail?: string;
    duration?: string;
    updatedAt: string;
    views: number;
    publishedBy?: string;
    content?: string;
}

interface TrainingCenterProps {
    canManage?: boolean;
    userProfile?: { firstName?: string; lastName?: string; role?: string; state?: string } | null;
}

export default function TrainingCenter({ canManage = false, userProfile }: TrainingCenterProps) {
    const { toast } = useToast();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [activeCategory, setActiveCategory] = useState("all");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [trainings, setTrainings] = useState<TrainingModule[]>([]);
    const [viewModule, setViewModule] = useState<TrainingModule | null>(null);

    // Form State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [file, setFile] = useState<File | null>(null);
    const [newModule, setNewModule] = useState({
        title: "",
        description: "",
        type: "video" as TrainingModule['type'],
        category: "Crisis Response" as TrainingModule['category'],
        url: "",
        content: "",
        targetedRoles: ["user", "support-agent", "admin"]
    });

    // Fetch Trainings Real-time
    useEffect(() => {
        // Only setup listener if we have an authenticated user
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
                setTrainings([]);
                return;
            }

            const q = query(collection(db, "trainingMaterials"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        ...d,
                        updatedAt: d.updatedAt?.toDate().toLocaleDateString() || 'N/A'
                    } as TrainingModule;
                });
                setTrainings(data);
            }, (error) => {
                console.error("Error fetching trainings:", error);
                if (error.code === 'permission-denied') {
                    // Silent fail if permission denied (e.g. during auth transition)
                    // The UI will just show no trainings or a loading state
                }
            });

            return () => unsubscribe();
        });

        return () => unsubscribeAuth();
    }, []);

    const handleCreateModule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        let downloadURL = newModule.url;

        try {
            // Handle File Upload
            if (file && (newModule.type === 'video' || newModule.type === 'image' || newModule.type === 'document')) {
                const storageRef = ref(storage, `training-content/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(storageRef, file);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (error) => reject(error),
                        async () => {
                            downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve();
                        }
                    );
                });
            }

            await addDoc(collection(db, "trainingMaterials"), {
                ...newModule,
                url: downloadURL,
                views: 0,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                publishedBy: userProfile?.firstName || t('training.admin')
            });

            // Automated Messaging Logic (Similar to original)
            try {
                const adminRole = userProfile?.role?.toLowerCase() || '';
                const isSuperAdmin = adminRole.includes('super');
                const adminState = userProfile?.state;

                let systemGroupsQuery;
                if (isSuperAdmin) {
                    systemGroupsQuery = query(
                        collection(db, 'chats'),
                        where('isSystemGroup', '==', true),
                        where('targetRole', 'in', ['user', 'beneficiary'])
                    );
                } else if (adminState) {
                    systemGroupsQuery = query(
                        collection(db, 'chats'),
                        where('isSystemGroup', '==', true),
                        where('state', '==', adminState),
                        where('targetRole', 'in', ['user', 'beneficiary'])
                    );
                }

                if (systemGroupsQuery) {
                    const groupSnap = await getDocs(systemGroupsQuery);
                    const currentIsoTime = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS");
                    const adminId = auth.currentUser?.uid;

                    const isMedia = ['video', 'image', 'document'].includes(newModule.type) && downloadURL;
                    const isGuide = newModule.type === 'text';
                    const messageContent = `${t('training.notifications.newModuleTitle')}\n\n${t('training.notifications.titleLabel')} ${newModule.title}\n${t('training.notifications.descriptionLabel')} ${newModule.description}`;

                    for (const groupDoc of groupSnap.docs) {
                        const messagesRef = collection(db, 'chats', groupDoc.id, 'messages');
                        await addDoc(messagesRef, {
                            content: messageContent,
                            messageType: isMedia ? "media" : "text",
                            trainingType: isGuide ? 'guide' : (isMedia ? 'media' : 'text'),
                            guideContent: isGuide ? newModule.content : null,
                            originalText: messageContent,
                            receiverId: groupDoc.id,
                            senderId: adminId || "system",
                            senderEmail: auth.currentUser?.email || "",
                            timestamp: currentIsoTime,
                            status: 'sent',
                            ...(isMedia && {
                                attachments: [{
                                    url: downloadURL,
                                    type: newModule.type === 'document' ? 'file' : newModule.type,
                                    filename: newModule.title,
                                    size: 0
                                }]
                            })
                        });

                        await updateDoc(doc(db, 'chats', groupDoc.id), {
                            lastMessage: `${t('training.trainingPrefix')} ${newModule.title}`,
                            lastMessageTimestamp: serverTimestamp(),
                            unreadCount: 0
                        });
                    }
                }
            } catch (notifyError) {
                console.error("Failed to send training notifications:", notifyError);
            }

            toast({ title: t('training.toasts.published'), description: t('training.toasts.publishedDesc') });
            setIsCreateModalOpen(false);
            setNewModule({
                title: "",
                description: "",
                type: "video",
                category: "Crisis Response",
                url: "",
                content: "",
                targetedRoles: ["user", "support-agent", "admin"]
            });
            setFile(null);
            setUploadProgress(0);
        } catch (error) {
            console.error("Failed to publish training:", error);
            toast({ title: t('training.toasts.publishFailed'), description: t('training.toasts.publishFailedDesc'), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewModule = async (module: TrainingModule) => {
        setViewModule(module);
        try {
            await updateDoc(doc(db, "trainingMaterials", module.id), {
                views: (module.views || 0) + 1
            });
        } catch (err) {
            console.error("Error updating views:", err);
        }
    };

    const handleDeleteModule = async (id: string) => {
        if (!confirm(t('training.alerts.deleteConfirm'))) return;
        try {
            await deleteDoc(doc(db, "trainingMaterials", id));
            toast({ title: t('training.toasts.deleted'), description: t('training.toasts.deletedDesc') });
        } catch (error) {
            console.error("Error deleting module:", error);
            toast({ title: t('training.toasts.error'), description: t('training.toasts.deleteFailed'), variant: "destructive" });
        }
    };

    const getReadTime = (module: TrainingModule) => {
        if (module.duration) return module.duration;
        if (module.type === 'video') return t('training.readTime.videoDefault');
        if (module.type === 'text' && module.content) {
            const words = module.content.split(/\s+/).length;
            const minutes = Math.max(1, Math.ceil(words / 200));
            return t('training.readTime.textCalculated', { minutes: minutes });
        }
        return t('training.readTime.default');
    };

    const getYouTubeEmbedUrl = (url: string) => {
        if (!url) return null;
        let videoId = '';
        if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
            videoId = url.split('embed/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/v/')) {
            videoId = url.split('/v/')[1]?.split('?')[0];
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    };

    const getIcon = (type: TrainingModule['type']) => {
        switch (type) {
            case 'video': return <Video className="h-5 w-5 text-red-500" />;
            case 'image': return <ImageIcon className="h-5 w-5 text-blue-500" />;
            case 'text': return <FileText className="h-5 w-5 text-green-500" />;
            case 'document': return <FileIcon className="h-5 w-5 text-orange-500" />;
            default: return <BookOpen className="h-5 w-5" />;
        }
    };

    const filteredTrainings = trainings.filter(t =>
        (activeTab === "all" || t.type === activeTab) &&
        (activeCategory === "all" || t.category === activeCategory) &&
        (t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const categories = [
        { name: "Crisis Response", title: t('training.categoryOptions.Crisis Response'), icon: Info },
        { name: "Technical Support", title: t('training.categoryOptions.Technical Support'), icon: Settings },
        { name: "Security Protocols", title: t('training.categoryOptions.Security Protocols'), icon: CheckCircle },
        { name: "Onboarding", title: t('training.categoryOptions.Onboarding'), icon: BookOpen }
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-blue-600" />
                        {t('training.title')}
                    </h1>
                    <p className="text-muted-foreground">{t('training.subtitle')}</p>
                </div>
                {canManage && (
                    <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="h-4 w-4" />
                        {t('training.newModule')}
                    </Button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <Card className="w-full lg:w-64 h-fit sticky top-4">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            {t('training.categories')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-1">
                        <Button
                            variant={activeCategory === "all" ? "secondary" : "ghost"}
                            className="justify-start gap-2 h-9 font-normal"
                            onClick={() => setActiveCategory("all")}
                        >
                            <LayoutDashboard className="h-4 w-4" /> {t('training.allCategories')}
                        </Button>
                        {categories.map((cat) => (
                            <Button
                                key={cat.name}
                                variant={activeCategory === cat.name ? "secondary" : "ghost"}
                                className={`justify-start gap-2 h-9 font-normal ${activeCategory === cat.name ? 'text-black font-bold' : 'text-slate-600'}`}
                                onClick={() => setActiveCategory(cat.name)}
                            >
                                <cat.icon className="h-4 w-4" /> {cat.title}
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                <div className="flex-1 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                        <Tabs defaultValue="all" className="w-full sm:w-fit" onValueChange={setActiveTab}>
                            <TabsList>
                                <TabsTrigger value="all">{t('training.tabs.all')}</TabsTrigger>
                                <TabsTrigger value="video">{t('training.tabs.videos')}</TabsTrigger>
                                <TabsTrigger value="image">{t('training.tabs.images')}</TabsTrigger>
                                <TabsTrigger value="text">{t('training.tabs.guides')}</TabsTrigger>
                                <TabsTrigger value="document">{t('training.tabs.documents')}</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('training.searchPlaceholder')}
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredTrainings.map((module) => (
                            <Card key={module.id} className="group hover:shadow-md transition-all border-l-4 border-l-blue-600 overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                                {getIcon(module.type)}
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight text-black">
                                                {module.category}
                                            </Badge>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                                            {module.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-6">
                                            {module.description}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {getReadTime(module)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />
                                                    {t('training.views', { count: module.views })}
                                                </span>
                                            </div>
                                            <span>{t('training.updated', { date: module.updatedAt })}</span>
                                        </div>
                                    </div>
                                    <div className="border-t p-4 bg-gray-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {canManage && (
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteModule(module.id)} className="h-8 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    {t('training.buttons.delete')}
                                                </Button>
                                            )}
                                        </div>
                                        <Button size="sm" className="gap-1 h-8" onClick={() => handleViewModule(module)}>
                                            {module.type === 'video' ? t('training.buttons.watchNow') : module.type === 'text' ? t('training.buttons.readGuide') : t('training.buttons.viewContent')}
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {filteredTrainings.length === 0 && (
                        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed">
                            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-gray-900">{t('training.empty.title')}</h3>
                            <p className="text-muted-foreground">{t('training.empty.subtitle')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Training Modal */}
            {canManage && (
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>{t('training.modal.title')}</DialogTitle>
                            <DialogDescription>
                                {t('training.modal.description')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateModule} className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="title" className="text-right">{t('training.modal.form.titleLabel')}</Label>
                                <Input
                                    id="title"
                                    className="col-span-3"
                                    value={newModule.title}
                                    onChange={(e) => setNewModule({ ...newModule, title: e.target.value })}
                                    placeholder={t('training.modal.form.titlePlaceholder')}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="category" className="text-right">{t('training.modal.form.categoryLabel')}</Label>
                                <Select
                                    value={newModule.category}
                                    onValueChange={(v: any) => setNewModule({ ...newModule, category: v })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('training.modal.form.categoryPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Crisis Response">{t('training.categoryOptions.Crisis Response')}</SelectItem>
                                        <SelectItem value="Technical Support">{t('training.categoryOptions.Technical Support')}</SelectItem>
                                        <SelectItem value="Security Protocols">{t('training.categoryOptions.Security Protocols')}</SelectItem>
                                        <SelectItem value="Onboarding">{t('training.categoryOptions.Onboarding')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="type" className="text-right">{t('training.modal.form.typeLabel')}</Label>
                                <Tabs
                                    value={newModule.type}
                                    onValueChange={(v: any) => setNewModule({ ...newModule, type: v })}
                                    className="col-span-3"
                                >
                                    <TabsList className="grid w-full grid-cols-4">
                                        <TabsTrigger value="video">{t('training.modal.form.typeOptions.video')}</TabsTrigger>
                                        <TabsTrigger value="image">{t('training.modal.form.typeOptions.image')}</TabsTrigger>
                                        <TabsTrigger value="text">{t('training.modal.form.typeOptions.text')}</TabsTrigger>
                                        <TabsTrigger value="document">{t('training.modal.form.typeOptions.document')}</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="media" className="text-right">{t('training.modal.form.mediaLabel')}</Label>
                                <div className="col-span-3 space-y-2">
                                    {(newModule.type === 'video' || newModule.type === 'image' || newModule.type === 'document') && (
                                        <Input
                                            id="media"
                                            type="file"
                                            accept={newModule.type === 'video' ? "video/*" : newModule.type === 'image' ? "image/*" : ".pdf,.doc,.docx"}
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        />
                                    )}
                                    {newModule.type === 'video' && !file && (
                                        <Input
                                            id="url"
                                            value={newModule.url}
                                            onChange={(e) => setNewModule({ ...newModule, url: e.target.value })}
                                            placeholder={t('training.modal.form.urlPlaceholder')}
                                        />
                                    )}
                                    {uploadProgress > 0 && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {newModule.type === 'text' && (
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label htmlFor="content" className="text-right pt-2">{t('training.modal.form.contentLabel')}</Label>
                                    <Textarea
                                        id="content"
                                        className="col-span-3 h-40 font-mono text-sm"
                                        value={newModule.content}
                                        onChange={(e) => setNewModule({ ...newModule, content: e.target.value })}
                                        placeholder={t('training.modal.form.contentPlaceholder')}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="description" className="text-right pt-2">{t('training.modal.form.summaryLabel')}</Label>
                                <Textarea
                                    id="description"
                                    className="col-span-3 h-20"
                                    value={newModule.description}
                                    onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
                                    placeholder={t('training.modal.form.summaryPlaceholder')}
                                    required
                                />
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg flex gap-3 border border-orange-100 dark:border-orange-900/50">
                                <Info className="h-5 w-5 text-orange-600 shrink-0" />
                                <p className="text-[11px] text-orange-800 dark:text-orange-300">
                                    {t('training.modal.systemNote')}
                                </p>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>{t('training.buttons.cancel')}</Button>
                                <Button type="submit" disabled={isSubmitting} className="gap-2">
                                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t('training.buttons.publish')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* View Module Dialog */}
            <Dialog open={!!viewModule} onOpenChange={(open) => !open && setViewModule(null)}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{viewModule?.category}</Badge>
                            <Badge variant="secondary" className="uppercase text-[10px]">{viewModule?.type}</Badge>
                        </div>
                        <DialogTitle className="text-2xl">{viewModule?.title}</DialogTitle>
                        <DialogDescription>{viewModule?.description}</DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {viewModule?.type === 'video' && viewModule.url && (
                            <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                                {viewModule.url.includes('youtube') || viewModule.url.includes('youtu.be') ? (
                                    <iframe
                                        src={getYouTubeEmbedUrl(viewModule.url) || ''}
                                        className="w-full h-full"
                                        allowFullScreen
                                        title="Video Player"
                                    />
                                ) : (
                                    <video src={viewModule.url} controls className="w-full h-full" />
                                )}
                            </div>
                        )}

                        {viewModule?.type === 'image' && viewModule.url && (
                            <div className="w-full rounded-lg overflow-hidden border">
                                <img src={viewModule.url} alt={viewModule.title} className="w-full h-auto" />
                            </div>
                        )}

                        {viewModule?.type === 'text' && (
                            <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border whitespace-pre-wrap">
                                {viewModule.content || t('training.viewer.noContent')}
                            </div>
                        )}

                        {viewModule?.type === 'document' && viewModule.url && (
                            <div className="space-y-4">
                                <div className="aspect-[4/5] w-full bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border relative group">
                                    {(() => {
                                        const cleanUrl = viewModule.url.split('?')[0].toLowerCase();
                                        const isPDF = cleanUrl.endsWith('.pdf');
                                        const isOffice = cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx') ||
                                            cleanUrl.endsWith('.xls') || cleanUrl.endsWith('.xlsx') ||
                                            cleanUrl.endsWith('.ppt') || cleanUrl.endsWith('.pptx');

                                        if (isPDF) {
                                            return (
                                                <iframe
                                                    src={`${viewModule.url}#toolbar=0`}
                                                    className="w-full h-full border-0"
                                                    title="PDF Preview"
                                                />
                                            );
                                        } else if (isOffice) {
                                            return (
                                                <iframe
                                                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewModule.url)}&embedded=true`}
                                                    className="w-full h-full border-0"
                                                    title="Document Preview"
                                                />
                                            );
                                        } else {
                                            return (
                                                <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
                                                    <FileIcon className="h-16 w-16 text-blue-500 opacity-20" />
                                                    <p className="text-sm text-muted-foreground text-center">
                                                        {t('training.viewer.previewNotAvailable')}<br />
                                                        {t('training.viewer.pleaseDownload')}
                                                    </p>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                                <div className="flex justify-center">
                                    <Button asChild variant="outline" className="gap-2">
                                        <a href={viewModule.url} target="_blank" rel="noopener noreferrer">
                                            <FileIcon className="h-4 w-4" />
                                            {t('training.buttons.openDownload')}
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
                            <span>{t('training.viewer.author', { author: viewModule?.publishedBy || 'Admin' })}</span>
                            <span>{t('training.viewer.lastUpdated', { date: viewModule?.updatedAt })}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
