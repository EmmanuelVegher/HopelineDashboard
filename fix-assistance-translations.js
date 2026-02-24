const fs = require('fs');
const path = require('path');

const localesPath = '/Users/mac/hopelineWeb/src/locales';

// Proper Yoruba translations for the assistance section
const yoAssistance = {
    "assistance": {
        "title": "Gba Ìrànwọ́",
        "subtitle": "Sopọ pẹlu awọn ẹgbẹ atilẹyin wa nipasẹ iwiregbe tabi foonu fun iranlọwọ lẹsẹkẹsẹ",
        "whatKindTitle": "Iru ìrànwọ́ wo ni o nilo?",
        "whatKindDesc": "Yan iru iranlọwọ ti o nilo fun iranlọwọ yiyara",
        "types": {
            "psychological": {
                "title": "Atilẹyin Ọpọlọ",
                "desc": "Ilera ọpọlọ ati imọran ipalara"
            },
            "transportation": {
                "title": "Gbigbe",
                "desc": "Gbigbe ailewu si awọn ibi aabo tabi awọn ile-iwosan"
            },
            "legal": {
                "title": "Iranlọwọ Ofin",
                "desc": "Iranlọwọ ofin ati atilẹyin iwe aṣẹ"
            },
            "shelter": {
                "title": "Atilẹyin Ibi Aabo",
                "desc": "Iranlọwọ wiwa ati wọle si awọn ibi aabo"
            },
            "food": {
                "title": "Ounjẹ & Omi",
                "desc": "Pinpin ounjẹ pajawiri ati omi mimọ"
            },
            "medical": {
                "title": "Iranlọwọ Iṣoogun",
                "desc": "Itọju iṣoogun pajawiri ati awọn iṣẹ ilera"
            }
        },
        "tabs": {
            "liveChat": "Iwiregbe Laifẹ",
            "groupChat": "Iwiregbe Ẹgbẹ",
            "voiceCall": "Ipe Ohùn"
        },
        "chat": {
            "connectTitle": "Sopọ pẹlu Awọn eniyan ni Ipinle Rẹ",
            "connectDesc": "Sọrọ pẹlu awọn aṣoju atilẹyin, awọn olumulo miiran, tabi awọn alakoso ni {{state}}",
            "supportAgents": "Awọn Aṣoju Atilẹyin",
            "admins": "Awọn Alakoso",
            "searchPlaceholder": "Wa nipa orukọ, foonu, tabi imeeli...",
            "noResults": "Ko si Awọn abajade ti a rii",
            "noAgentsMatch": "Ko si aṣoju atilẹyin ti o baamu \"{{search}}\"",
            "noAgentsAvailable": "Ko si awọn aṣoju Atilẹyin ti o wa",
            "offlineAgents": "Gbogbo awọn aṣoju atilẹyin ni {{state}} wa ni aisinipo lọwọlọwọ. Jọwọ gbiyanju lẹẹkansii nigbamii.",
            "noAdminsMatch": "Ko si awọn alakoso ti o baamu \"{{search}}\"",
            "noAdminsAvailable": "Ko si awọn alakoso ti o wa",
            "noAdminsFound": "Ko si awọn alakoso ti a rii ni {{state}}."
        },
        "interface": {
            "communityGroup": "Ẹgbẹ Agbegbe",
            "supportAgent": "Aṣoju Atilẹyin",
            "onlineSupport": "Online - Aṣoju Atilẹyin",
            "beneficiaries": "Awọn anfani",
            "residents": "Awọn olugbe",
            "welcomeGroup": "Kaabo si ẹgbẹ agbegbe!",
            "startConversation": "Bẹrẹ ibaraẹnisọrọ pẹlu {{name}}",
            "you": "Iwọ",
            "original": "Atilẹba:",
            "typeMessage": "Kọ ifiranṣẹ kan...",
            "camera": "Kamẹra",
            "voice": "Ohùn",
            "stop": "Duro",
            "startChat": "Bẹrẹ Iwiregbe",
            "joinWaitList": "Darapọ mọ Akojọ Idaduro"
        },
        "roleLabels": {
            "supportAgent": "Aṣoju Atilẹyin",
            "admin": "Alakoso",
            "beneficiary": "Olufẹ",
            "driver": "Awakọ",
            "user": "Olumulo"
        },
        "errors": {
            "couldNotJoin": "Ko le darapọ mọ ẹgbẹ agbegbe",
            "couldNotDetermine": "Ko le pinnu ẹgbẹ agbegbe rẹ",
            "accessRestricted": "Wọle Ti Di Dina",
            "notParticipant": "O ko jẹ olukopa ninu iwiregbe yii.",
            "micAccess": "Ko le wọle si maikirofoni",
            "startCallFailed": "Ko ṣaṣeyọri lati bẹrẹ ipe",
            "sendFailed": "Ko ṣaṣeyọri lati firanṣẹ"
        },
        "call": {
            "voiceVideoSupport": "Atilẹyin Ipe Ohùn & Fidio",
            "videoBtn": "Ipe Fidio",
            "voiceBtn": "Ipe Ohùn",
            "ringing": "N pariwo...",
            "ended": "Ipe Ti Pari",
            "videoCallLabel": "Ipe fidio",
            "voiceCallLabel": "Ipe ohùn",
            "callHistory": "Itan Ipe",
            "recentCalls": "Awọn ipe laipẹ rẹ",
            "active": "Ṣiṣẹ",
            "completed": "Pari",
            "missed": "Padanu",
            "ringing": "N pariwo",
            "duration": "akoko"
        },
        "voiceVideoDesc": "Awọn aṣoju atilẹyin wa ṣetan lati ṣe iranlọwọ fun ọ nipasẹ ipe ohùn tabi fidio.",
        "voiceBtn": "Ipe Ohùn",
        "videoBtn": "Ipe Fidio",
        "selectAgentFirst": "Yan aṣoju kan ni taabu Iwiregbe Laifẹ ni akọkọ, tabi tẹ loke lati pe aṣoju ti o wa lọwọlọwọ.",
        "callHistory": "Itan Ipe",
        "recentCalls": "Awọn ipe laipẹ rẹ",
        "active": "Ṣiṣẹ",
        "completed": "Pari",
        "missed": "Padanu",
        "ringing": "N pariwo",
        "duration": "akoko"
    },
    "footer": {
        "supportAvailable": "Atilẹyin pajawiri 24/7 wa • Akoko idahun apapọ:",
        "mins": "iṣẹju 2",
        "immediateDanger": "Ewu Tọkasi?",
        "contactAuthorities": "Kan si awọn alaṣẹ agbegbe lẹsẹkẹsẹ",
        "callNow": "PE BAYI",
        "faqsTitle": "FAQ & Awọn Orisun",
        "faqsDesc": "Wa awọn idahun si awọn ibeere ti o wọpọ",
        "browseHelp": "Wo Iranlọwọ"
    }
};

// Igbo translations for assistance section
const igAssistance = {
    "assistance": {
        "title": "Nweta Enyemaka",
        "subtitle": "Soro ndị otu nkwado anyị kpakọrịta site na nkata ma ọ bụ ekwentị maka enyemaka ozugbo",
        "whatKindTitle": "Kedu ụdị enyemaka ị chọrọ?",
        "whatKindDesc": "Họrọ ụdị enyemaka ị chọrọ maka enyemaka ngwa ngwa",
        "types": {
            "psychological": {
                "title": "Nkwado Uche",
                "desc": "Ahụike uche na ndụmọdụ maka ọ bụ ihe ọjọọ mere"
            },
            "transportation": {
                "title": "Njem",
                "desc": "Njem nchekwa gaa n'ụlọ nchedo ma ọ bụ ụlọ ọgwụ"
            },
            "legal": {
                "title": "Enyemaka iwu",
                "desc": "Enyemaka iwu na nkwado akwụkwọ"
            },
            "shelter": {
                "title": "Nkwado Ebe obibi",
                "desc": "Enyemaka ịchọ na ịbanye n'ebe obibi nchekwa"
            },
            "food": {
                "title": "Nri & Mmiri",
                "desc": "Nkesa nri n'oge ihe mberede na mmiri ọcha"
            },
            "medical": {
                "title": "Enyemaka Ọgwụgwọ",
                "desc": "Ọgwụgwọ n'oge ihe mberede na ọrụ ahụike"
            }
        },
        "tabs": {
            "liveChat": "Nkata ozugbo",
            "groupChat": "Nkata otu",
            "voiceCall": "Oku olu"
        },
        "chat": {
            "connectTitle": "Soro ndị nọ na steeti gị kpakọrịta",
            "connectDesc": "Kparịta ụka na ndị ọrụ nkwado, ndị ọrụ ndị ọzọ, ma ọ bụ ndị nhazi na {{state}}",
            "supportAgents": "Ndị ọrụ nkwado",
            "admins": "Ndị nhazi",
            "searchPlaceholder": "Chọọ site na aha, ekwentị, ma ọ bụ email...",
            "noResults": "Ahụghị nsonaazụ ọ bụla",
            "noAgentsMatch": "Ọ nweghị onye ọrụ nkwado ruru \"{{search}}\"",
            "noAgentsAvailable": "Ndị ọrụ nkwado adịghị",
            "offlineAgents": "Ndị ọrụ nkwado niile nọ na {{state}} anọghị n'ịntanetị ugbu a. Biko gbalịa ọzọ ma emechaa.",
            "noAdminsMatch": "Ọ nweghị ndị nhazi ruru \"{{search}}\"",
            "noAdminsAvailable": "Ndị nhazi adịghị",
            "noAdminsFound": "Ahụghị ndị nhazi ọ bụla na {{state}}."
        },
        "interface": {
            "communityGroup": "Otu obodo",
            "supportAgent": "Onye ọrụ nkwado",
            "onlineSupport": "N'ịntanetị - Onye ọrụ nkwado",
            "beneficiaries": "Ndị nwetara uru",
            "residents": "Ndị bi ebe ahụ",
            "welcomeGroup": "Nabata na otu obodo!",
            "startConversation": "Malite mkparịta ụka na {{name}}",
            "you": "Gị",
            "original": "Nke mbụ:",
            "typeMessage": "Dee ozi...",
            "camera": "Igwefoto",
            "voice": "Olu",
            "stop": "Kwụsị",
            "startChat": "Malite nkata",
            "joinWaitList": "Soro na listi nchere"
        },
        "roleLabels": {
            "supportAgent": "Onye ọrụ nkwado",
            "admin": "Onye nhazi",
            "beneficiary": "Onye nwetara uru",
            "driver": "Ọkwọ ụgbọ",
            "user": "Onye ọrụ"
        },
        "errors": {
            "couldNotJoin": "Enweghị ike ịbanye na otu obodo",
            "couldNotDetermine": "Enweghị ike ịchọpụta otu obodo gị",
            "accessRestricted": "Enweghi Ohere Isi Nloghachi",
            "notParticipant": "Ị nọghị na ndị sonyere na nkata a.",
            "micAccess": "Enweghị ike ijanye maikirofọn",
            "startCallFailed": "Ọ dịghị mma ibido oku",
            "sendFailed": "Ọ dịghị mma izipu ozi"
        },
        "call": {
            "voiceVideoSupport": "Nkwado Oku Olu & Vidiyo",
            "videoBtn": "Oku Vidiyo",
            "voiceBtn": "Oku Olu",
            "ringing": "Na-agu ihe...",
            "ended": "Oku Agwụla",
            "videoCallLabel": "Oku vidiyo",
            "voiceCallLabel": "Oku olu",
            "callHistory": "Akụkọ Oku",
            "recentCalls": "Oku gị nke ọhụrụ",
            "active": "Na-arụkwa ọrụ",
            "completed": "Emechara",
            "missed": "Efufulara",
            "duration": "oge"
        },
        "voiceVideoDesc": "Ndị ọrụ nkwado anyị dị njikere inyere gị aka site na oku olu ma ọ bụ vidiyo.",
        "voiceBtn": "Oku Olu",
        "videoBtn": "Oku Vidiyo",
        "selectAgentFirst": "Họrọ onye nnochi anya na taabụ Nkata ozugbo izizi, ma ọ bụ pịa n'elu iji kpọọ onye nnochi anya dị n'ụzọ.",
        "callHistory": "Akụkọ Oku",
        "recentCalls": "Oku gị nke ọhụrụ",
        "active": "Na-arụkwa ọrụ",
        "completed": "Emechara",
        "missed": "Efufulara",
        "duration": "oge"
    },
    "footer": {
        "supportAvailable": "Nkwado mberede 24/7 dị • Oge nzaghachi nkezi:",
        "mins": "nkeji 2",
        "immediateDanger": "Ihe Ọjọọ Na-adị Ugbu a?",
        "contactAuthorities": "Kpọọ ndị ọchịchị mpaghara ozugbo",
        "callNow": "KPỌỌ UGBU A",
        "faqsTitle": "FAQ & Ngbanwe",
        "faqsDesc": "Chọọ azịza na ajụjụ a na-ajụkarị",
        "browseHelp": "Lee Enyemaka"
    }
};

// Hausa — update with proper translations (overwrite the section)
const haAssistance = {
    "assistance": {
        "title": "Nemi Taimako",
        "subtitle": "Haɗa da ƙungiyoyin goyon bayanmu ta hanyar tattaunawa ko waya don taimakon gaggawa",
        "whatKindTitle": "Wane irin taimako kake buƙata?",
        "whatKindDesc": "Zaɓi nau'in taimakon da kake buƙata don saurin samun taimako",
        "types": {
            "psychological": {
                "title": "Taimakon Hankali",
                "desc": "Lafiyar kwakwalwa da shawarwarin tashin hankali"
            },
            "transportation": {
                "title": "Sufuri",
                "desc": "Sufuri mai aminci zuwa gidaje ko asibiti"
            },
            "legal": {
                "title": "Taimakon Shari'a",
                "desc": "Taimakon shari'a da takardu"
            },
            "shelter": {
                "title": "Taimakon Gida",
                "desc": "Taimako don samun gida mai lafiya"
            },
            "food": {
                "title": "Abinci & Ruwa",
                "desc": "Rarraba abinci na gaggawa da ruwa mai tsabta"
            },
            "medical": {
                "title": "Taimakon Likita",
                "desc": "Kula da gaggawa na likita da lafiya"
            }
        },
        "tabs": {
            "liveChat": "Tattaunawar Kai Tsaye",
            "groupChat": "Tattaunawar Rukunin",
            "voiceCall": "Kiran Murya"
        },
        "chat": {
            "connectTitle": "Haɗa da Mutane a Jiharka",
            "connectDesc": "Yi tattaunawa da jami'an tallafi, sauran masu amfani, ko admins a {{state}}",
            "supportAgents": "Jami'an Tallafi",
            "admins": "Admins",
            "searchPlaceholder": "Nemi ta suna, waya, ko imel...",
            "noResults": "Ba a Sami Sakamako Ba",
            "noAgentsMatch": "Babu jami'in tallafi da ya dace da \"{{search}}\"",
            "noAgentsAvailable": "Babu Jami'an Tallafi",
            "offlineAgents": "Duk jami'an tallafi a {{state}} suna waje a halin yanzu. Da fatan za a sake gwadawa daga baya.",
            "noAdminsMatch": "Babu admins da suka dace da \"{{search}}\"",
            "noAdminsAvailable": "Babu Admins",
            "noAdminsFound": "Ba a sami admins a {{state}} ba."
        },
        "interface": {
            "communityGroup": "Rukunin Al'umma",
            "supportAgent": "Jami'in Tallafi",
            "onlineSupport": "A Kan Layi - Jami'in Tallafi",
            "beneficiaries": "Masu Amfana",
            "residents": "Mazauna",
            "welcomeGroup": "Barka da zuwa rukunin al'umma!",
            "startConversation": "Fara tattaunawa da {{name}}",
            "you": "Kai",
            "original": "Asali:",
            "typeMessage": "Rubuta saƙo...",
            "camera": "Kamara",
            "voice": "Murya",
            "stop": "Tsaya",
            "startChat": "Fara Tattaunawa",
            "joinWaitList": "Shiga Jerin Jira"
        },
        "roleLabels": {
            "supportAgent": "Jami'in Tallafi",
            "admin": "Admin",
            "beneficiary": "Mai Amfani",
            "driver": "Direban",
            "user": "Mai Amfani"
        },
        "errors": {
            "couldNotJoin": "Ba a iya shiga rukunin al'umma ba",
            "couldNotDetermine": "Ba a iya gano rukunin al'ummarku ba",
            "accessRestricted": "An Hana Samun Damar",
            "notParticipant": "Ba kai ɓangare na wannan tattaunawar ba.",
            "micAccess": "Ba a iya samun damar makirofon ba",
            "startCallFailed": "An kasa fara kiran waya",
            "sendFailed": "An kasa aika saƙo"
        },
        "call": {
            "voiceVideoSupport": "Goyon Bayan Kiran Murya & Bidiyo",
            "videoBtn": "Kiran Bidiyo",
            "voiceBtn": "Kiran Murya",
            "ringing": "Yana buga...",
            "ended": "Kiran Ya Ƙare",
            "videoCallLabel": "Kiran bidiyo",
            "voiceCallLabel": "Kiran murya",
            "callHistory": "Tarihin Kira",
            "recentCalls": "Kirayen da ka yi kwanannan",
            "active": "Yana Aiki",
            "completed": "An Gama",
            "missed": "An Rasa",
            "duration": "tsawon lokaci"
        },
        "voiceVideoDesc": "Jami'an tallafinmu suna shirye don taimakon ku ta hanyar kiran murya ko bidiyo.",
        "voiceBtn": "Kiran Murya",
        "videoBtn": "Kiran Bidiyo",
        "selectAgentFirst": "Zaɓi jami'i a tab na Tattaunawar Kai Tsaye da farko, ko danna sama don kiran jami'i na gaba.",
        "callHistory": "Tarihin Kira",
        "recentCalls": "Kirayen da ka yi kwanannan",
        "active": "Yana Aiki",
        "completed": "An Gama",
        "missed": "An Rasa",
        "duration": "tsawon lokaci"
    },
    "footer": {
        "supportAvailable": "Goyon Bayan Gaggawa 24/7 • Matsakaicin lokacin amsa:",
        "mins": "minti 2",
        "immediateDanger": "Xaɗari Yanzu?",
        "contactAuthorities": "Tuntubi hukumomin yankin nan take",
        "callNow": "KIRA YANZU",
        "faqsTitle": "FAQ & Albarkatu",
        "faqsDesc": "Sami amsoshi ga tambayoyin da aka fi yawan yi",
        "browseHelp": "Bincika Taimako"
    }
};

// PCM translations for assistance section
const pcmAssistance = {
    "assistance": {
        "title": "Get Help",
        "subtitle": "Connect with our support team dem through chat or phone for quick help",
        "whatKindTitle": "Which kind help you need?",
        "whatKindDesc": "Select the kind of help you need make you get help fast",
        "types": {
            "psychological": {
                "title": "Mind Support",
                "desc": "Mental health and trauma talk-talk"
            },
            "transportation": {
                "title": "Transport",
                "desc": "Safe transport go shelter or hospital"
            },
            "legal": {
                "title": "Legal Help",
                "desc": "Legal help and document support"
            },
            "shelter": {
                "title": "Shelter Support",
                "desc": "Help to find and enter safe shelter"
            },
            "food": {
                "title": "Food & Water",
                "desc": "Emergency food sharing and clean water"
            },
            "medical": {
                "title": "Medical Help",
                "desc": "Emergency medical care and health services"
            }
        },
        "tabs": {
            "liveChat": "Live Chat",
            "groupChat": "Group Chat",
            "voiceCall": "Voice Call"
        },
        "chat": {
            "connectTitle": "Connect with People for your State",
            "connectDesc": "Chat with support agents, other users, or admins for {{state}}",
            "supportAgents": "Support Agents",
            "admins": "Admins",
            "searchPlaceholder": "Search by name, phone, or email...",
            "noResults": "No Results Found",
            "noAgentsMatch": "No support agent match \"{{search}}\"",
            "noAgentsAvailable": "No Support Agent Dey",
            "offlineAgents": "All support agents for {{state}} no dey online now. Abeg try again later.",
            "noAdminsMatch": "No admin match \"{{search}}\"",
            "noAdminsAvailable": "No Admin Dey",
            "noAdminsFound": "No admin dey for {{state}}."
        },
        "interface": {
            "communityGroup": "Community Group",
            "supportAgent": "Support Agent",
            "onlineSupport": "Online - Support Agent",
            "beneficiaries": "Beneficiaries",
            "residents": "Residents",
            "welcomeGroup": "Welcome to the community group!",
            "startConversation": "Start chat with {{name}}",
            "you": "You",
            "original": "Original:",
            "typeMessage": "Type message...",
            "camera": "Camera",
            "voice": "Voice",
            "stop": "Stop",
            "startChat": "Start Chat",
            "joinWaitList": "Join Wait List"
        },
        "roleLabels": {
            "supportAgent": "Support Agent",
            "admin": "Admin",
            "beneficiary": "Beneficiary",
            "driver": "Driver",
            "user": "User"
        },
        "errors": {
            "couldNotJoin": "E no fit join community group",
            "couldNotDetermine": "E no fit find your community group",
            "accessRestricted": "Access Don Block",
            "notParticipant": "You no be part of this chat.",
            "micAccess": "E no fit access microphone",
            "startCallFailed": "E no fit start call",
            "sendFailed": "E no fit send message"
        },
        "call": {
            "voiceVideoSupport": "Voice & Video Call Support",
            "videoBtn": "Video Call",
            "voiceBtn": "Voice Call",
            "ringing": "E dey ring...",
            "ended": "Call Don End",
            "videoCallLabel": "Video call",
            "voiceCallLabel": "Voice call",
            "callHistory": "Call History",
            "recentCalls": "Your recent calls",
            "active": "Active",
            "completed": "Completed",
            "missed": "Missed",
            "duration": "duration"
        },
        "voiceVideoDesc": "Our support agents ready to help you through voice or video call.",
        "voiceBtn": "Voice Call",
        "videoBtn": "Video Call",
        "selectAgentFirst": "Select agent for Live Chat tab first, or click above to call the next available agent.",
        "callHistory": "Call History",
        "recentCalls": "Your recent calls",
        "active": "Active",
        "completed": "Completed",
        "missed": "Missed",
        "duration": "duration"
    },
    "footer": {
        "supportAvailable": "24/7 Emergency Support Dey • Average response time:",
        "mins": "2 minutes",
        "immediateDanger": "You dey Danger?",
        "contactAuthorities": "Call local authority immediately",
        "callNow": "CALL NOW",
        "faqsTitle": "FAQs & Resources",
        "faqsDesc": "Find answer to common questions",
        "browseHelp": "Browse Help"
    }
};

const files = {
    'yo.json': yoAssistance,
    'ig.json': igAssistance,
    'ha.json': haAssistance,
    'pcm.json': pcmAssistance
};

for (const [filename, translations] of Object.entries(files)) {
    const filePath = path.join(localesPath, filename);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Overwrite sections with proper translations
    for (const [section, data] of Object.entries(translations)) {
        content[section] = { ...(content[section] || {}), ...data };
        // Deep merge for nested objects
        for (const [key, val] of Object.entries(data)) {
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                content[section][key] = { ...(content[section][key] || {}), ...val };
                // One more level deep
                for (const [k2, v2] of Object.entries(val)) {
                    if (typeof v2 === 'object' && v2 !== null && !Array.isArray(v2)) {
                        content[section][key][k2] = { ...(content[section][key][k2] || {}), ...v2 };
                    } else {
                        content[section][key][k2] = v2;
                    }
                }
            } else {
                content[section][key] = val;
            }
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Updated ${filename}`);
}

console.log('Done!');
