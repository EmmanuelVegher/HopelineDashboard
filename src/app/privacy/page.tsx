"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, Share2, Info, ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PrivacyPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const sections = [
        {
            id: "collection",
            icon: Info,
            title: t("privacy.sections.collection.title"),
            description: t("privacy.sections.collection.description"),
            color: "text-blue-600",
            bgColor: "bg-blue-100",
        },
        {
            id: "usage",
            icon: Eye,
            title: t("privacy.sections.usage.title"),
            description: t("privacy.sections.usage.description"),
            color: "text-emerald-600",
            bgColor: "bg-emerald-100",
        },
        {
            id: "sharing",
            icon: Share2,
            title: t("privacy.sections.sharing.title"),
            description: t("privacy.sections.sharing.description"),
            color: "text-purple-600",
            bgColor: "bg-purple-100",
        },
        {
            id: "rights",
            icon: Lock,
            title: t("privacy.sections.rights.title"),
            description: t("privacy.sections.rights.description"),
            color: "text-amber-600",
            bgColor: "bg-amber-100",
        },
        {
            id: "contact",
            icon: Shield,
            title: t("privacy.sections.contact.title"),
            description: t("privacy.sections.contact.description"),
            color: "text-rose-600",
            bgColor: "bg-rose-100",
        },
    ];

    return (
        <div className="min-h-screen blob-container py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-8 hover:bg-white/50 backdrop-blur-sm"
                >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t("common.back")}
                </Button>

                <header className="text-center mb-16 animate-fade-in-up">
                    <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6">
                        <Shield className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-gradient-primary mb-4">
                        {t("privacy.title")}
                    </h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        {t("privacy.introduction")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-4">
                        {t("privacy.lastUpdated")}
                    </p>
                </header>

                <div className="space-y-6">
                    {sections.map((section, index) => (
                        <Card
                            key={section.id}
                            className="card-elevated border-l-4 overflow-hidden animate-fade-in-up"
                            style={{ animationDelay: `${index * 100}ms`, borderLeftColor: `hsl(var(--primary))` }}
                        >
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <div className={`${section.bgColor} p-3 rounded-xl`}>
                                    <section.icon className={`h-6 w-6 ${section.color}`} />
                                </div>
                                <CardTitle className="text-xl font-bold">{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed mb-4">
                                    {section.description}
                                </p>
                                {section.id === "rights" && (
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => navigate("/delete-account")}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {t("deleteAccount.title")}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    <Card className="bg-primary/5 border-primary/10 mt-12 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                        <CardContent className="p-8 text-center">
                            <p className="text-sm font-medium text-primary mb-0 uppercase tracking-wider">
                                Our Commitment
                            </p>
                            <p className="mt-4 text-lg text-foreground italic">
                                "{t("privacy.consent")}"
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <footer className="mt-16 text-center text-sm text-muted-foreground pb-8">
                    <p>© {new Date().getFullYear()} CARITAS HopeLine. All rights reserved.</p>
                </footer>
            </div>
        </div>
    );
}
