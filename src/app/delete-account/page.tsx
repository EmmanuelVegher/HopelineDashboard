"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trash2, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function DeleteAccountPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [reason, setReason] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmed) return;

        setIsSubmitting(true);
        // Simulate API call for deletion request
        try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            setSubmitted(true);
            toast({
                title: t("deleteAccount.successTitle"),
                description: t("deleteAccount.successMessage"),
            });
        } catch (error) {
            toast({
                title: t("deleteAccount.errorTitle"),
                description: t("deleteAccount.errorMessage"),
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen blob-container flex items-center justify-center p-4">
                <Card className="max-w-md w-full card-elevated animate-fade-in-up">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Send className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold">{t("deleteAccount.successTitle")}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground">
                        <p className="mb-6">{t("deleteAccount.successMessage")}</p>
                        <Button onClick={() => navigate("/dashboard")} className="w-full">
                            {t("common.backToDashboard") || "Back to Dashboard"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen blob-container py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-8 hover:bg-white/50 backdrop-blur-sm"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("common.back")}
                </Button>

                <header className="text-center mb-12 animate-fade-in-up">
                    <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-2xl mb-6">
                        <Trash2 className="h-10 w-10 text-red-600" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-red-600 mb-4">
                        {t("deleteAccount.title")}
                    </h1>
                    <p className="text-muted-foreground">
                        {t("deleteAccount.subtitle")}
                    </p>
                </header>

                <Card className="card-elevated border-t-4 border-t-red-600 animate-fade-in-up">
                    <CardContent className="pt-6">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex gap-4 items-start">
                            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 leading-relaxed font-medium">
                                {t("deleteAccount.warning")}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="reason">{t("deleteAccount.reasonLabel")}</Label>
                                <Textarea
                                    id="reason"
                                    placeholder={t("deleteAccount.reasonPlaceholder")}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="min-h-[120px] bg-white/50"
                                />
                            </div>

                            <div className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl">
                                <Checkbox
                                    id="confirm"
                                    checked={confirmed}
                                    onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                                    className="mt-1"
                                />
                                <Label
                                    htmlFor="confirm"
                                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                                >
                                    {t("deleteAccount.confirmCheckbox")}
                                </Label>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <Button
                                    type="submit"
                                    disabled={!confirmed || isSubmitting}
                                    variant="destructive"
                                    className="flex-1 h-12 text-lg font-semibold shadow-lg shadow-red-200"
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <span className="animate-spin">◌</span> {t("common.submitting") || "Submitting..."}
                                        </span>
                                    ) : (
                                        t("deleteAccount.submitButton")
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate(-1)}
                                    className="flex-1 h-12 text-lg font-semibold"
                                >
                                    {t("deleteAccount.cancelButton")}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
