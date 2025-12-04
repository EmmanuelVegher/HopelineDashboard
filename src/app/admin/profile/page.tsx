"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Edit, Save, X, Calendar, Globe, User, Mail, Shield, Clock, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type AdminUser } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface ValidationErrors {
    firstName?: string;
    lastName?: string;
    mobile?: string;
    gender?: string;
    language?: string;
    image?: string;
}

interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}

const RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export default function AdminProfilePage() {
    const [currentUserProfile, setCurrentUserProfile] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        mobile: '',
        gender: '',
        language: '',
        image: ''
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [retryCount, setRetryCount] = useState(0);
    const { toast } = useToast();

    // Enhanced Unicode surrogate validation
    const validateUnicodeSurrogates = useCallback((str: string): boolean => {
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code >= 0xD800 && code <= 0xDFFF) {
                // Check for valid surrogate pair
                if (i + 1 < str.length) {
                    const nextCode = str.charCodeAt(i + 1);
                    if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                        i++; // Valid surrogate pair, skip next character
                    } else {
                        return false; // Lone high surrogate
                    }
                } else {
                    return false; // Lone surrogate at end of string
                }
            }
        }
        return true;
    }, []);

    // Comprehensive form validation
    const validateForm = useCallback((): ValidationErrors => {
        const errors: ValidationErrors = {};

        // Required fields
        if (!editForm.firstName.trim()) {
            errors.firstName = "First name is required";
        } else if (editForm.firstName.length > 50) {
            errors.firstName = "First name must be less than 50 characters";
        } else if (!validateUnicodeSurrogates(editForm.firstName)) {
            errors.firstName = "First name contains invalid characters";
        }

        if (!editForm.lastName.trim()) {
            errors.lastName = "Last name is required";
        } else if (editForm.lastName.length > 50) {
            errors.lastName = "Last name must be less than 50 characters";
        } else if (!validateUnicodeSurrogates(editForm.lastName)) {
            errors.lastName = "Last name contains invalid characters";
        }

        // Phone validation (optional but format check if provided)
        if (editForm.mobile && !/^\+?[1-9]\d{1,14}$/.test(editForm.mobile.replace(/\s+/g, ''))) {
            errors.mobile = "Please enter a valid phone number";
        }

        // Gender validation
        if (!editForm.gender) {
            errors.gender = "Please select a gender";
        }

        // Language validation
        if (!editForm.language) {
            errors.language = "Please select a language";
        }

        return errors;
    }, [editForm, validateUnicodeSurrogates]);

    // File validation
    const validateImageFile = useCallback((file: File): string | null => {
        if (file.size > MAX_FILE_SIZE) {
            return "Image file size must be less than 5MB";
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return "Only image files (JPEG, PNG, GIF, WebP) are allowed";
        }

        return null;
    }, []);

    // Sanitize filename for storage
    const sanitizeFileName = useCallback((fileName: string): string => {
        return fileName
            .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
            .replace(/_{2,}/g, '_') // Replace multiple underscores with single
            .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
            .toLowerCase();
    }, []);

    // Retry utility with exponential backoff
    const retryWithBackoff = useCallback(<T,>(
        operation: () => Promise<T>,
        config: RetryConfig = RETRY_CONFIG
    ): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
            let lastError: Error;
            let attempt = 0;

            const executeAttempt = async () => {
                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    lastError = error as Error;

                    // Don't retry on validation errors or client errors
                    if (error instanceof Error && (
                        error.message.includes('validation') ||
                        error.message.includes('Invalid') ||
                        error.message.includes('required')
                    )) {
                        reject(error);
                        return;
                    }

                    if (attempt < config.maxRetries) {
                        attempt++;
                        const delay = Math.min(
                            config.baseDelay * Math.pow(2, attempt - 1),
                            config.maxDelay
                        );
                        setRetryCount(attempt);
                        setTimeout(executeAttempt, delay);
                    } else {
                        reject(lastError);
                    }
                }
            };

            executeAttempt();
        });
    }, []);

    useEffect(() => {
        const fetchCurrentUserProfile = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const profileData = { id: userDoc.id, ...userDoc.data() } as AdminUser;
                        setCurrentUserProfile(profileData);
                        setEditForm({
                            firstName: profileData.firstName || '',
                            lastName: profileData.lastName || '',
                            mobile: profileData.mobile || '',
                            gender: profileData.gender || '',
                            language: profileData.language || '',
                            image: profileData.image || ''
                        });
                        setImagePreview(profileData.image || null);
                    }
                } catch (error) {
                    console.error("Error fetching current user profile:", error);
                    toast({
                        title: "Error Loading Profile",
                        description: "Could not load your profile information. Please refresh the page.",
                        variant: "destructive"
                    });
                }
            }
            setLoading(false);
        };
        fetchCurrentUserProfile();
    }, [toast]);

    // Enhanced blob URL cleanup
    useEffect(() => {
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, []);

    const handleEdit = () => {
        if (currentUserProfile) {
            setEditForm({
                firstName: currentUserProfile.firstName || '',
                lastName: currentUserProfile.lastName || '',
                mobile: currentUserProfile.mobile || '',
                gender: currentUserProfile.gender || '',
                language: currentUserProfile.language || '',
                image: currentUserProfile.image || ''
            });
            setImagePreview(currentUserProfile.image || null);
        }
        setIsEditing(true);
        setValidationErrors({});
    };

    const handleCancel = () => {
        setIsEditing(false);
        setImageFile(null);
        setImagePreview(null);
        setUploadProgress(null);
        setValidationErrors({});
        setRetryCount(0);
        if (currentUserProfile) {
            setEditForm({
                firstName: currentUserProfile.firstName || '',
                lastName: currentUserProfile.lastName || '',
                mobile: currentUserProfile.mobile || '',
                gender: currentUserProfile.gender || '',
                language: currentUserProfile.language || '',
                image: currentUserProfile.image || ''
            });
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file
            const validationError = validateImageFile(file);
            if (validationError) {
                setValidationErrors(prev => ({ ...prev, image: validationError }));
                toast({
                    title: "Invalid Image File",
                    description: validationError,
                    variant: "destructive"
                });
                return;
            }

            setImageFile(file);
            setValidationErrors(prev => ({ ...prev, image: undefined }));

            // Cleanup previous blob URL
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }

            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
        }
    };

    const handleImageRemove = () => {
        setImageFile(null);
        setImagePreview(null);
        setEditForm(prev => ({ ...prev, image: '' }));
        setValidationErrors(prev => ({ ...prev, image: undefined }));
    };

    const uploadImageWithRetry = useCallback(async (file: File): Promise<string> => {
        return retryWithBackoff(async () => {
            const sanitizedFileName = sanitizeFileName(file.name);
            const storageRef = ref(storage, `profile-images/${Date.now()}_${sanitizedFileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            return new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        console.error("Upload failed:", error);
                        reject(new Error(`Image upload failed: ${error.message}`));
                    },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(downloadURL);
                        } catch (error) {
                            console.error("Failed to get download URL:", error);
                            reject(new Error("Failed to get image URL after upload"));
                        }
                    }
                );
            });
        });
    }, [retryWithBackoff, sanitizeFileName]);

    const updateProfileWithRetry = useCallback(async (updateData: any): Promise<void> => {
        return retryWithBackoff(async () => {
            const userRef = doc(db, "users", currentUserProfile!.id);
            await updateDoc(userRef, updateData);
        });
    }, [retryWithBackoff, currentUserProfile]);

    const handleSave = async () => {
        if (!currentUserProfile) return;

        // Validate form
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            toast({
                title: "Validation Error",
                description: "Please fix the errors in the form before saving.",
                variant: "destructive"
            });
            return;
        }

        setSaving(true);
        setRetryCount(0);
        let imageUrl = editForm.image;

        try {
            console.log("Starting profile save process");

            // Upload image if provided
            if (imageFile) {
                console.log("Uploading image file:", imageFile.name, "size:", imageFile.size);
                try {
                    imageUrl = await uploadImageWithRetry(imageFile);
                    console.log("Image uploaded successfully, URL:", imageUrl);
                } catch (uploadError) {
                    console.error("Image upload error:", uploadError);
                    toast({
                        title: "Image Upload Failed",
                        description: uploadError instanceof Error ? uploadError.message : "Could not upload profile image. Please try again.",
                        variant: "destructive"
                    });
                    return; // Don't proceed with profile update if image upload fails
                }
            }

            const updateData = {
                firstName: editForm.firstName.trim(),
                lastName: editForm.lastName.trim(),
                mobile: editForm.mobile.trim(),
                gender: editForm.gender,
                language: editForm.language,
                image: imageUrl
            };

            console.log("Attempting to update Firestore with data:", updateData);

            // Validate Unicode surrogates in all string fields
            for (const [key, value] of Object.entries(updateData)) {
                if (typeof value === 'string' && !validateUnicodeSurrogates(value)) {
                    console.error(`Invalid Unicode surrogate found in ${key}:`, value);
                    throw new Error(`Invalid Unicode characters in ${key}`);
                }
            }

            try {
                await updateProfileWithRetry(updateData);
                console.log("Firestore update successful");
            } catch (dbError) {
                console.error("Database update error:", dbError);
                toast({
                    title: "Database Error",
                    description: dbError instanceof Error ? dbError.message : "Could not update profile in database. Please try again.",
                    variant: "destructive"
                });
                return;
            }

            // Update local state
            setCurrentUserProfile({
                ...currentUserProfile,
                firstName: editForm.firstName.trim(),
                lastName: editForm.lastName.trim(),
                mobile: editForm.mobile.trim(),
                gender: editForm.gender,
                language: editForm.language,
                image: imageUrl
            });

            setIsEditing(false);
            setImageFile(null);
            setImagePreview(null);
            setUploadProgress(null);
            setValidationErrors({});
            setRetryCount(0);

            toast({
                title: "Profile Updated",
                description: "Your profile has been successfully updated.",
            });
        } catch (error) {
            console.error("Error updating profile:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            if (errorMessage.includes('Unicode') || errorMessage.includes('validation')) {
                toast({
                    title: "Validation Error",
                    description: errorMessage,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Update Failed",
                    description: `Could not update your profile: ${errorMessage}. Please try again.`,
                    variant: "destructive",
                });
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Admin Profile</h1>
                        <p className="text-muted-foreground">Loading your profile information...</p>
                    </div>
                </div>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                        <div className="animate-pulse space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                                <div className="space-y-2">
                                    <div className="h-6 bg-gray-200 rounded w-48"></div>
                                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Admin Profile</h1>
                <p className="text-muted-foreground">View and manage your account details</p>
            </div>

            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                                <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                                Profile Information
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                Your account details and profile information.
                            </CardDescription>
                        </div>
                        {!isEditing && (
                            <Button onClick={handleEdit} variant="outline" size="sm">
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Profile
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {currentUserProfile ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Avatar className="h-16 w-16">
                                        {isEditing && imagePreview ? (
                                            <img
                                                src={imagePreview}
                                                alt="Profile preview"
                                                className="object-cover w-full h-full rounded-full"
                                            />
                                        ) : currentUserProfile?.image ? (
                                            <img
                                                src={currentUserProfile.image}
                                                alt="Profile"
                                                className="object-cover w-full h-full rounded-full"
                                            />
                                        ) : (
                                            <AvatarFallback className="text-lg">
                                                {isEditing ? editForm.firstName?.[0] || '' : currentUserProfile?.firstName?.[0] || ''}
                                                {isEditing ? editForm.lastName?.[0] || '' : currentUserProfile?.lastName?.[0] || ''}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    {isEditing && (
                                        <div className="absolute -bottom-2 -right-2">
                                            <label htmlFor="profile-image" className="cursor-pointer">
                                                <div className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-full shadow-lg">
                                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                    </svg>
                                                </div>
                                            </label>
                                            <input
                                                id="profile-image"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold">
                                        {isEditing ? `${editForm.firstName} ${editForm.lastName}` : `${currentUserProfile?.firstName || ''} ${currentUserProfile?.lastName || ''}`}
                                    </h3>
                                    <p className="text-muted-foreground">{currentUserProfile?.email}</p>
                                    <Badge variant="secondary" className="mt-1">{currentUserProfile?.role}</Badge>
                                    {isEditing && imagePreview && (
                                        <div className="mt-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleImageRemove}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Remove Image
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {uploadProgress !== null && (
                                <div className="mt-4">
                                    <Label className="text-sm font-medium">Upload Progress</Label>
                                    <Progress value={uploadProgress} className="mt-1" />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {uploadProgress !== null ? Math.round(uploadProgress) : 0}% uploaded
                                        {retryCount > 0 && ` (Retry ${retryCount}/${RETRY_CONFIG.maxRetries})`}
                                    </p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <Label className="text-sm font-medium">Email</Label>
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <Label className="text-sm font-medium">Role</Label>
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.role}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <Label className="text-sm font-medium">Display Name</Label>
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.displayName || 'Not set'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <Label className="text-sm font-medium">Account Status</Label>
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.accountStatus || 'Active'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-medium">First Name *</Label>
                                        {isEditing ? (
                                            <>
                                                <Input
                                                    value={editForm.firstName}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                                                    className={`mt-1 ${validationErrors.firstName ? 'border-red-500' : ''}`}
                                                    maxLength={50}
                                                />
                                                {validationErrors.firstName && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        {validationErrors.firstName}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.firstName || 'Not set'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">Last Name *</Label>
                                        {isEditing ? (
                                            <>
                                                <Input
                                                    value={editForm.lastName}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                                                    className={`mt-1 ${validationErrors.lastName ? 'border-red-500' : ''}`}
                                                    maxLength={50}
                                                />
                                                {validationErrors.lastName && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        {validationErrors.lastName}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.lastName || 'Not set'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">Gender *</Label>
                                        {isEditing ? (
                                            <>
                                                <Select
                                                    value={editForm.gender}
                                                    onValueChange={(value) => setEditForm(prev => ({ ...prev, gender: value }))}
                                                >
                                                    <SelectTrigger className={`mt-1 ${validationErrors.gender ? 'border-red-500' : ''}`}>
                                                        <SelectValue placeholder="Select gender" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Male">Male</SelectItem>
                                                        <SelectItem value="Female">Female</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {validationErrors.gender && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        {validationErrors.gender}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.gender || 'Not set'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">Phone</Label>
                                        {isEditing ? (
                                            <>
                                                <PhoneInput
                                                    value={editForm.mobile}
                                                    onChange={(value) => setEditForm(prev => ({ ...prev, mobile: value }))}
                                                    className={`mt-1 ${validationErrors.mobile ? 'border-red-500' : ''}`}
                                                />
                                                {validationErrors.mobile && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        {validationErrors.mobile}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{currentUserProfile?.mobile || 'Not set'}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <Label className="text-sm font-medium">Language *</Label>
                                            {isEditing ? (
                                                <>
                                                    <Select
                                                        value={editForm.language}
                                                        onValueChange={(value) => setEditForm(prev => ({ ...prev, language: value }))}
                                                    >
                                                        <SelectTrigger className={`mt-1 ${validationErrors.language ? 'border-red-500' : ''}`}>
                                                            <SelectValue placeholder="Select language" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="English">English</SelectItem>
                                                            <SelectItem value="Hausa">Hausa</SelectItem>
                                                            <SelectItem value="Igbo">Igbo</SelectItem>
                                                            <SelectItem value="Yoruba">Yoruba</SelectItem>
                                                            <SelectItem value="Nigerian Pidgin">Nigerian Pidgin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {validationErrors.language && (
                                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {validationErrors.language}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">{currentUserProfile?.language || 'Not set'}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <Label className="text-sm font-medium">Member Since</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {currentUserProfile?.createdAt ?
                                                    new Date(currentUserProfile.createdAt.seconds * 1000).toLocaleDateString() :
                                                    'Not available'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">User ID</Label>
                                        <p className="text-xs text-muted-foreground font-mono">{currentUserProfile?.uid || currentUserProfile?.id}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {currentUserProfile?.isOnline ? (
                                            <Wifi className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <WifiOff className="h-4 w-4 text-red-500" />
                                        )}
                                        <div>
                                            <Label className="text-sm font-medium">Online Status</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {currentUserProfile?.isOnline ? 'Online' : 'Offline'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {isEditing && (
                                <div className="flex gap-2 pt-4 border-t">
                                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                                        {saving ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                {retryCount > 0 ? `Retrying... (${retryCount}/${RETRY_CONFIG.maxRetries})` : 'Saving...'}
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                    <Button onClick={handleCancel} variant="outline" disabled={saving}>
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Unable to load profile information.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}