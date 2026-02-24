const fs = require('fs');
const path = require('path');

const localesPath = path.join('/Users/mac/hopelineWeb/src/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesPath, 'en.json'), 'utf8'));

const targetLocales = ['ha.json', 'ig.json', 'yo.json', 'pcm.json'];

// Helper to deep merge and translate
function backfill(source, target) {
    for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (!target[key]) target[key] = {};
            backfill(source[key], target[key]);
        } else {
            if (!target[key]) {
                target[key] = source[key]; // Default to English if not provided
            }
        }
    }
}

// Translations for Assistance Pages
const assistanceTranslations = {
    ha: {
        assistance: {
            title: "Nemi Taimako",
            subtitle: "Haɗa da ƙungiyoyin goyon bayanmu ta hanyar tattaunawa ko waya don taimakon gaggawa",
            whatKindTitle: "Wane irin taimako kake buƙata?",
            whatKindDesc: "Zaɓi nau'in taimakon da kake buƙata don saurin samun taimako",
            tabs: {
                liveChat: "Tattaunawar Kai Tsaye",
                groupChat: "Tattaunawar Rukunin",
                voiceCall: "Kiran Murya"
            },
            chat: {
                connectTitle: "Haɗa da Mutane a Jiharka",
                connectDesc: "Yi tattaunawa da jami'an tallafi, sauran masu amfani, ko admins a {{state}}",
                supportAgents: "Jami'an Tallafi",
                admins: "Admins",
                searchPlaceholder: "Nemi ta suna, waya, ko imel...",
                noResults: "Ba a Sami Sakamako Ba",
                noAgentsMatch: "Babu jami'in tallafi da ya dace da \"{{search}}\"",
                noAgentsAvailable: "Babu Jami'an Tallafi",
                offlineAgents: "Duk jami'an tallafi a {{state}} suna waje a halin yanzu. Da fatan za a sake gwadawa daga baya.",
                noAdminsMatch: "Babu admins da suka dace da \"{{search}}\"",
                noAdminsAvailable: "Babu Admins",
                noAdminsFound: "Ba a sami admins a {{state}} ba."
            },
            interface: {
                communityGroup: "Rukunin Al'umma",
                supportAgent: "Jami'in Tallafi",
                onlineSupport: "A Kan Layi - Jami'in Tallafi",
                beneficiaries: "Masu Amfana",
                residents: "Mazauna",
                welcomeGroup: "Barka da zuwa rukunin al'umma!",
                startConversation: "Fara tattaunawa da {{name}}",
                you: "Kai",
                original: "Asali:",
                typeMessage: "Rubuta saƙo...",
                camera: "Kamara",
                voice: "Murya",
                stop: "Tsaya",
                startChat: "Fara Tattaunawa",
                joinWaitList: "Shiga Jerin Jira"
            }
        }
    },
    ig: {
        assistance: {
            title: "Nweta Enyemaka",
            subtitle: "Soro ndị otu nkwado anyị kpakọrịta site na nkata ma ọ bụ ekwentị maka enyemaka ozugbo",
            whatKindTitle: "Kedu ụdị enyemaka ị chọrọ?",
            whatKindDesc: "Họrọ ụdị enyemaka ị chọrọ maka enyemaka ngwa ngwa",
            tabs: {
                liveChat: "Nkata ozugbo",
                groupChat: "Nkata otu",
                voiceCall: "Oku olu"
            },
            chat: {
                connectTitle: "Soro ndị nọ na steeti gị kpakọrịta",
                connectDesc: "Kparịta ụka na ndị ọrụ nkwado, ndị ọrụ ndị ọzọ, ma ọ bụ ndị nhazi na {{state}}",
                supportAgents: "Ndị ọrụ nkwado",
                admins: "Ndị nhazi",
                searchPlaceholder: "Chọọ site na aha, ekwentị, ma ọ bụ email...",
                noResults: "Ahụghị nsonaazụ ọ bụla",
                noAgentsMatch: "Ọ nweghị onye ọrụ nkwado ruru \"{{search}}\"",
                noAgentsAvailable: "Ndị ọrụ nkwado adịghị",
                offlineAgents: "Ndị ọrụ nkwado niile nọ na {{state}} anọghị n'ịntanetị ugbu a. Biko gbalịa ọzọ ma emechaa.",
                noAdminsMatch: "Ọ nweghị ndị nhazi ruru \"{{search}}\"",
                noAdminsAvailable: "Ndị nhazi adịghị",
                noAdminsFound: "Ahụghị ndị nhazi ọ bụla na {{state}}."
            },
            interface: {
                communityGroup: "Otu obodo",
                supportAgent: "Onye ọrụ nkwado",
                onlineSupport: "N'ịntanetị - Onye ọrụ nkwado",
                beneficiaries: "Ndị nwetara uru",
                residents: "Ndị bi ebe ahụ",
                welcomeGroup: "Nabata na otu obodo!",
                startConversation: "Mmalite mkparịta ụka na {{name}}",
                you: "Gị",
                original: "Nke mbu:",
                typeMessage: "Dee ozi...",
                camera: "Igwefoto",
                voice: "Olu",
                stop: "Kwụsị",
                startChat: "Malite nkata",
                joinWaitList: "Soro na listi nchere"
            }
        }
    },
    yo: {
        assistance: {
            title: "Gba Iranlọwọ",
            subtitle: "Sopọ pẹlu awọn ẹgbẹ atilẹyin wa nipasẹ iwiregbe tabi foonu fun iranlọwọ lẹsẹkẹsẹ",
            whatKindTitle: "Iru iranlọwọ wo ni o nilo?",
            whatKindDesc: "Yan iru iranlọwọ ti o nilo fun iranlọwọ yiyara",
            tabs: {
                liveChat: "Iwiregbe Live",
                groupChat: "Iwiregbe Ẹgbẹ",
                voiceCall: "Ipe ohùn"
            },
            chat: {
                connectTitle: "Sopọ pẹlu Awọn eniyan ni Ipinle Rẹ",
                connectDesc: "Sọrọ pẹlu awọn aṣoju atilẹyin, awọn olumulo miiran, tabi awọn alakoso ni {{state}}",
                supportAgents: "Awọn aṣoju Atilẹyin",
                admins: "Awọn alakoso",
                searchPlaceholder: "Wa nipa orukọ, foonu, tabi imeeli...",
                noResults: "Ko si Awọn abajade ti a rii",
                noAgentsMatch: "Ko si aṣoju atilẹyin ti o baamu \"{{search}}\"",
                noAgentsAvailable: "Ko si awọn aṣoju Atilẹyin ti o wa",
                offlineAgents: "Gbogbo awọn aṣoju atilẹyin ni {{state}} wa ni offline lọwọlọwọ. Jọwọ gbiyanju lẹẹkansii nigbamii.",
                noAdminsMatch: "Ko si awọn alakoso ti o baamu \"{{search}}\"",
                noAdminsAvailable: "Ko si awọn alakoso ti o wa",
                noAdminsFound: "Ko si awọn alakoso ti a rii ni {{state}}."
            },
            interface: {
                communityGroup: "Ẹgbẹ Agbegbe",
                supportAgent: "Aṣoju Atilẹyin",
                onlineSupport: "Online - Aṣoju Atilẹyin",
                beneficiaries: "Awọn anfani",
                residents: "Awọn olugbe",
                welcomeGroup: "Kaabo si ẹgbẹ agbegbe!",
                startConversation: "Bẹrẹ ibaraẹnisọrọ pẹlu {{name}}",
                you: "Iwọ",
                original: "Atilẹba:",
                typeMessage: "Kọ ifiranṣẹ kan...",
                camera: "Kamẹra",
                voice: "Ohùn",
                stop: "Duro",
                startChat: "Bẹrẹ Iwiregbe",
                joinWaitList: "Darapọ mọ Akojọ Idaduro"
            }
        }
    },
    pcm: {
        assistance: {
            title: "Get Help",
            subtitle: "Connect with our support team dem through chat or phone for quick help",
            whatKindTitle: "Which kind help you need?",
            whatKindDesc: "Select the kind of help you need make you get help fast",
            tabs: {
                liveChat: "Live Chat",
                groupChat: "Group Chat",
                voiceCall: "Voice Call"
            },
            chat: {
                connectTitle: "Connect with People for your State",
                connectDesc: "Chat with support agents, other users, or admins for {{state}}",
                supportAgents: "Support Agents",
                admins: "Admins",
                searchPlaceholder: "Search by name, phone, or email...",
                noResults: "No Results Found",
                noAgentsMatch: "No support agent match \"{{search}}\"",
                noAgentsAvailable: "No Support Agent dey",
                offlineAgents: "All support agents for {{state}} no dey online now. Abeg try again later.",
                noAdminsMatch: "No admin match \"{{search}}\"",
                noAdminsAvailable: "No Admin dey",
                noAdminsFound: "No admin dey for {{state}}."
            },
            interface: {
                communityGroup: "Community Group",
                supportAgent: "Support Agent",
                onlineSupport: "Online - Support Agent",
                beneficiaries: "Beneficiaries",
                residents: "Residents",
                welcomeGroup: "Welcome to the community group!",
                startConversation: "Start chat with {{name}}",
                you: "You",
                original: "Original:",
                typeMessage: "Type message...",
                camera: "Camera",
                voice: "Voice",
                stop: "Stop",
                startChat: "Start Chat",
                joinWaitList: "Join Wait List"
            }
        }
    }
};

targetLocales.forEach(file => {
    const filePath = path.join(localesPath, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const lang = file.split('.')[0];
    const langTranslations = assistanceTranslations[lang] || {};

    // Merge predefined translations first
    for (const section in langTranslations) {
        if (!content[section]) content[section] = {};
        backfill(langTranslations[section], content[section]);
    }

    // Then backfill any remaining missing keys from English
    backfill(en, content);

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Backfilled ${file}`);
});
