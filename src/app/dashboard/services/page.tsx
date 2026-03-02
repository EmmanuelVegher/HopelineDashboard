"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    Droplets,
    HeartHandshake,
    Stethoscope,
    ArrowRight,
    Phone,
    MessageSquare,
    BookOpen,
    AlertTriangle,
    Users,
    Home
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import type { DisplacedPerson, Shelter } from "@/lib/data";

// ─── WhatsApp Config (Option 1: Deep Link) ───────────────────────────────────
const WHATSAPP_NUMBER = "447397136870"; // +44 7397 136870
const WHATSAPP_DEFAULT_TEXT = encodeURIComponent("Hello Hopeline Support, I need assistance.");

function openWhatsApp(customText?: string) {
    const text = customText ? encodeURIComponent(customText) : WHATSAPP_DEFAULT_TEXT;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener,noreferrer");
}

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceCard {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    bgColor: string;
    borderColor: string;
    iconColor: string;
    contact?: string;
    contactLabel?: string;
    whatsappText?: string;
    chatLink?: string;
    available: boolean;
}

export default function ServicesPage() {
    const { t } = useTranslation();
    const [displacedRecord, setDisplacedRecord] = useState<DisplacedPerson | null>(null);
    const [assignedShelter, setAssignedShelter] = useState<Shelter | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) { setLoading(false); return; }

        const fetchRecord = async () => {
            try {
                const q = query(collection(db, "displacedPersons"), where("userId", "==", currentUser.uid));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const record = { id: snap.docs[0].id, ...snap.docs[0].data() } as DisplacedPerson;
                    setDisplacedRecord(record);
                    if (record.assignedShelterId) {
                        const shelterDoc = await getDoc(doc(db, "shelters", record.assignedShelterId));
                        if (shelterDoc.exists()) {
                            setAssignedShelter({ id: shelterDoc.id, ...shelterDoc.data() } as Shelter);
                        }
                    }
                }
            } catch (e) {
                console.error("Error fetching services record:", e);
            }
            setLoading(false);
        };

        fetchRecord();
    }, []);

    const services: ServiceCard[] = [
        {
            id: "gbv",
            title: "GBV Support",
            description: "Gender-Based Violence support including counselling, psychosocial support, and safe referral pathways for survivors.",
            icon: HeartHandshake,
            bgColor: "bg-rose-50",
            borderColor: "border-rose-200",
            iconColor: "text-rose-600",
            contact: "0800-GBV-HELP",
            contactLabel: "GBV Hotline",
            whatsappText: "Hello Hopeline, I need GBV support services.",
            chatLink: "/dashboard/assistance",
            available: true
        },
        {
            id: "wash",
            title: "WASH Services",
            description: "Water, Sanitation & Hygiene services. Report issues with water supply, latrines, or hygiene kits at your shelter.",
            icon: Droplets,
            bgColor: "bg-blue-50",
            borderColor: "border-blue-200",
            iconColor: "text-blue-600",
            whatsappText: "Hello Hopeline, I need help with WASH services (water/sanitation/hygiene).",
            chatLink: "/dashboard/assistance",
            available: true
        },
        {
            id: "protection",
            title: "Protection & Legal Aid",
            description: "Protection services including documentation support, legal aid referrals, and general protection assessments.",
            icon: Shield,
            bgColor: "bg-purple-50",
            borderColor: "border-purple-200",
            iconColor: "text-purple-600",
            whatsappText: "Hello Hopeline, I need protection or legal aid support.",
            chatLink: "/dashboard/assistance",
            available: true
        },
        {
            id: "medical",
            title: "Medical Assistance",
            description: "Primary health care, medical referrals, chronic illness support, and mental health services.",
            icon: Stethoscope,
            bgColor: "bg-green-50",
            borderColor: "border-green-200",
            iconColor: "text-green-600",
            contact: "0800-MED-AID",
            contactLabel: "Medical Hotline",
            whatsappText: "Hello Hopeline, I need medical assistance.",
            chatLink: "/dashboard/assistance",
            available: true
        },
        {
            id: "education",
            title: "Education & Training",
            description: "Educational resources, skills training, and livelihood opportunities to help you rebuild.",
            icon: BookOpen,
            bgColor: "bg-amber-50",
            borderColor: "border-amber-200",
            iconColor: "text-amber-600",
            whatsappText: "Hello Hopeline, I need information about education and training programs.",
            chatLink: "/dashboard/assistance",
            available: true
        },
        {
            id: "community",
            title: "Community Support",
            description: "Community representatives, group sessions, and social cohesion programs.",
            icon: Users,
            bgColor: "bg-teal-50",
            borderColor: "border-teal-200",
            iconColor: "text-teal-600",
            whatsappText: "Hello Hopeline, I need community support services.",
            chatLink: "/dashboard/assistance",
            available: true
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Services & Support</h1>
                    <p className="text-muted-foreground mt-1">Access humanitarian services available at your shelter.</p>
                </div>

                {/* ── Option 1: WhatsApp Deep Link Banner ───────────────────── */}
                <Card className="bg-[#25D366]/10 border-[#25D366]/40 shadow-sm">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="bg-[#25D366] p-2.5 rounded-full shrink-0">
                                <WhatsAppIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-[#075E54] text-sm">Chat via WhatsApp</p>
                                <p className="text-xs text-gray-600">Connect directly with a Hopeline support agent on WhatsApp — fastest way to get help.</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => openWhatsApp()}
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold w-full sm:w-auto shrink-0 gap-2"
                        >
                            <WhatsAppIcon className="h-4 w-4" />
                            Chat on WhatsApp
                        </Button>
                    </CardContent>
                </Card>
                {/* ─────────────────────────────────────────────────────────── */}

                {/* Assigned Shelter Context Banner */}
                {!loading && assignedShelter && (
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-full">
                                <Home className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-green-800">Your Shelter: {assignedShelter.name}</p>
                                <p className="text-xs text-green-700">{assignedShelter.location || assignedShelter.state} · {assignedShelter.organization}</p>
                            </div>
                            {displacedRecord?.allocatedResources?.bedNumber && (
                                <Badge className="ml-auto bg-green-200 text-green-800 border-0">
                                    Bed: {displacedRecord.allocatedResources.bedNumber}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                )}

                {!loading && !assignedShelter && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-sm text-amber-800">
                                You are not yet assigned to a shelter. Services are available once assigned. Please{" "}
                                <Link to="/dashboard/assistance" className="font-semibold underline">contact support</Link> for help.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Services Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {services.map((service) => {
                        const Icon = service.icon;
                        return (
                            <Card
                                key={service.id}
                                className={`${service.bgColor} ${service.borderColor} border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col`}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="p-2.5 rounded-xl bg-white/70 shadow-sm">
                                            <Icon className={`h-6 w-6 ${service.iconColor}`} />
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] bg-white/70">Available</Badge>
                                    </div>
                                    <CardTitle className="text-base mt-3">{service.title}</CardTitle>
                                    <CardDescription className="text-xs leading-relaxed">{service.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0 mt-auto space-y-2">
                                    {service.contact && (
                                        <a href={`tel:${service.contact.replace(/-/g, '')}`} className="flex items-center gap-2 text-xs font-medium hover:opacity-80">
                                            <Phone className="h-3.5 w-3.5" />
                                            <span>{service.contactLabel}: <strong>{service.contact}</strong></span>
                                        </a>
                                    )}
                                    {/* WhatsApp quick contact per service */}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full bg-white/80 hover:bg-[#25D366]/10 border-[#25D366]/40 text-xs h-8 gap-1.5"
                                        onClick={() => openWhatsApp(service.whatsappText)}
                                    >
                                        <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                                        WhatsApp Support
                                    </Button>
                                    {service.chatLink && (
                                        <Link to={service.chatLink}>
                                            <Button size="sm" variant="outline" className="w-full bg-white/80 hover:bg-white text-xs h-8">
                                                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                                In-App Chat
                                                <ArrowRight className="h-3 w-3 ml-auto" />
                                            </Button>
                                        </Link>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Emergency CTA */}
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
                            <div>
                                <p className="font-bold text-red-800">In immediate danger?</p>
                                <p className="text-sm text-red-700">Trigger an emergency SOS alert or reach us on WhatsApp.</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button
                                onClick={() => openWhatsApp("EMERGENCY: I need immediate help!")}
                                className="bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold gap-2"
                            >
                                <WhatsAppIcon className="h-4 w-4" />
                                WhatsApp Now
                            </Button>
                            <Link to="/sos">
                                <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto font-bold">
                                    HELP ME!!!
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
