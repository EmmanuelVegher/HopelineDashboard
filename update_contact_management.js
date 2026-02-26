const fs = require('fs');

const translations = {
    ha: {
        title: "Sarrafa Lambobin Tuntuɓe",
        subtitle: "Ƙara, gyara, ko share lambobin USSD da na gaggawa da ake nuna wa masu amfani.",
        addNew: "Ƙara Lamba Sabuwa",
        deleteConfirm: "Shin kuna so ku share wannan lambar tuntuɓe?",
        table: {
            heads: {
                serviceName: "Sunan Sabis",
                numberCode: "Lamba / Lambar USSD",
                state: "Jiha",
                actions: "Ayyuka"
            },
            nationwide: "A Duk Ƙasar",
            noContacts: "Ba a sami lambobin tuntuɓe ba."
        },
        permissionError: {
            title: "An ƙi Izini",
            description: "Ba ku da izinin sarrafa lambobin tuntuɓe. Don Allah duba dokokin tsaro na Firestore ku."
        },
        form: {
            addTitle: "Ƙara Sabuwar Lambar Tuntuɓe",
            editTitle: "Gyara Lambar Tuntuɓe",
            addDesc: "Ƙara lambar USSD ko lambar gaggawa sabuwa.",
            editDesc: "Sabunta bayanan wannan tuntuɓe.",
            serviceName: "Sunan Sabis",
            servicePlaceholder: "misali, Gaggawar SOS ko 'yan sanda",
            numberCode: "Lamba ko Lambar USSD",
            numberPlaceholder: "misali, *347*100# ko 112",
            state: "Jiha",
            statePlaceholder: "Zaɓi Jiha (Ba dole ba)",
            allStates: "Duk Jihohi (A Duk Ƙasar)",
            adminLocked: "Admin an kulle shi zuwa jiharsa.",
            cancel: "Soke",
            save: "Ajiye Lamba",
            saving: "Ana ajiyewa...",
            edit: "Gyara",
            deleteBtn: "Share"
        },
        toasts: {
            success: "An yi nasara",
            error: "Kuskure",
            added: "An ƙara lambar tuntuɓe cikin nasara.",
            updated: "An sabunta lambar tuntuɓe cikin nasara.",
            deleted: "An share lambar tuntuɓe.",
            saveError: "Ba a iya ajiye lambar tuntuɓe ba.",
            deleteError: "Ba a iya share lambar ba.",
            missingFields: "Bayanai sun ɓace",
            missingFieldsDesc: "Don Allah ku samar da suna da lamba/lambar USSD."
        }
    },
    ig: {
        title: "Njikwa Nọmba Kọntaktị",
        subtitle: "Tinye, dezie, ma o buru hichapụ koodu USSD na nọmba ihe mberede ndị egosipụtara n'ihe ndị ọrụ.",
        addNew: "Tinye Nọmba Ọhụrụ",
        deleteConfirm: "I n'ezie chefuo nọmba kọntaktị a?",
        table: {
            heads: {
                serviceName: "Aha Ọrụ",
                numberCode: "Nọmba / Koodu",
                state: "Steeti",
                actions: "Omume"
            },
            nationwide: "Mba Niile",
            noContacts: "Enweghị ọnụ ọgụgụ kọntaktị."
        },
        permissionError: {
            title: "Ikike Anọghị",
            description: "I nweghị ikike ijikwa nọmba kọntaktị. Biko lelee iwu nchedo Firestore gị."
        },
        form: {
            addTitle: "Tinye Nọmba Kọntaktị Ọhụrụ",
            editTitle: "Dezie Nọmba Kọntaktị",
            addDesc: "Tinye koodu USSD ọhụrụ ma o buru nọmba ihe mberede.",
            editDesc: "Melite nkọwa maka kọntaktị a.",
            serviceName: "Aha Ọrụ",
            servicePlaceholder: "dịka, SOS Ihe Mberede ma o buru Ndị Uwe Ojii",
            numberCode: "Nọmba ma o buru Koodu",
            numberPlaceholder: "dịka, *347*100# ma o buru 112",
            state: "Steeti",
            statePlaceholder: "Họrọ Steeti (O dịghị mkpa)",
            allStates: "Steeti Niile (Mba Niile)",
            adminLocked: "Admin etinyerela n'steeti ya.",
            cancel: "Kagbuo",
            save: "Chekwa Nọmba",
            saving: "Na-echekwa...",
            edit: "Dezie",
            deleteBtn: "Hichapụ"
        },
        toasts: {
            success: "O Dị Mma",
            error: "Njehie",
            added: "Etinyela nọmba kọntaktị nke ọma.",
            updated: "Emelitela nọmba kọntaktị nke ọma.",
            deleted: "Ehichapụla nọmba kọntaktị.",
            saveError: "Enweghị ike ichekwa nọmba kọntaktị.",
            deleteError: "Enweghị ike ihichapụ nọmba.",
            missingFields: "Ọnọdụ Dịghị",
            missingFieldsDesc: "Biko nye aha na nọmba/koodu."
        }
    },
    yo: {
        title: "Isakoso Nomba Ibanisoro",
        subtitle: "Safikun, satunse, tabi pa koodu USSD ati nomba ipadabosi ti o n han fun awon olumulo.",
        addNew: "Safikun Nomba Tuntun",
        deleteConfirm: "Se o daju pe o fe pa nomba ibanisoro yii?",
        table: {
            heads: {
                serviceName: "Oruko Iseo",
                numberCode: "Nomba / Koodu",
                state: "Ipinle",
                actions: "Awon Igbese"
            },
            nationwide: "Orilede Gbogbo",
            noContacts: "Ko si nomba ibanisoro ti a ri."
        },
        permissionError: {
            title: "Ase Ko",
            description: "O ko ni ase lati sakoso nomba ibanisoro. Jowo sayewo awon ofin aabo Firestore re."
        },
        form: {
            addTitle: "Safikun Nomba Ibanisoro Tuntun",
            editTitle: "Satunse Nomba Ibanisoro",
            addDesc: "Safikun koodu USSD tuntun tabi nomba ipadabosi.",
            editDesc: "Se atunse fun alaye ibanisoro yii.",
            serviceName: "Oruko Iseo",
            servicePlaceholder: "fun apere, SOS Ipadabosi tabi Olopaa",
            numberCode: "Nomba tabi Koodu",
            numberPlaceholder: "fun apere, *347*100# tabi 112",
            state: "Ipinle",
            statePlaceholder: "Yan Ipinle (Ko Pon dandan)",
            allStates: "Gbogbo Ipinle (Orilede Gbogbo)",
            adminLocked: "Admin ti wa ni titiipa si ipinle ti a yan.",
            cancel: "Fagile",
            save: "Toju Nomba",
            saving: "N toju...",
            edit: "Satunse",
            deleteBtn: "Pa"
        },
        toasts: {
            success: "Aseyori",
            error: "Asise",
            added: "Nomba ibanisoro ti safikun pelu aseyori.",
            updated: "Nomba ibanisoro ti satunse pelu aseyori.",
            deleted: "Nomba ibanisoro ti pare.",
            saveError: "Ko seese lati toju nomba ibanisoro.",
            deleteError: "Ko seese lati pa nomba.",
            missingFields: "Alaye Aipe",
            missingFieldsDesc: "Jowo pese oruko ati nomba/koodu."
        }
    },
    pcm: {
        title: "Manage Contact Numbers",
        subtitle: "Add, edit, or remove USSD codes and emergency numbers wey dey show for user pages.",
        addNew: "Add New Number",
        deleteConfirm: "You sure say you wan delete dis contact number?",
        table: {
            heads: {
                serviceName: "Service Name",
                numberCode: "Number / Code",
                state: "State",
                actions: "Actions"
            },
            nationwide: "All Over Nigeria",
            noContacts: "No contact number dey here."
        },
        permissionError: {
            title: "Permission Denied",
            description: "You no get permission to manage contact numbers. Abeg check your Firestore security rules."
        },
        form: {
            addTitle: "Add New Contact Number",
            editTitle: "Edit Contact Number",
            addDesc: "Add new USSD code or emergency number.",
            editDesc: "Update the details for dis contact.",
            serviceName: "Service Name",
            servicePlaceholder: "e.g., Emergency SOS or Police",
            numberCode: "Number or Code",
            numberPlaceholder: "e.g., *347*100# or 112",
            state: "State",
            statePlaceholder: "Select State (Optional)",
            allStates: "All States (Nationwide)",
            adminLocked: "Admin locked to im assigned state.",
            cancel: "Cancel",
            save: "Save Number",
            saving: "Saving...",
            edit: "Edit",
            deleteBtn: "Delete"
        },
        toasts: {
            success: "E Work!",
            error: "Error",
            added: "Contact number don add well well.",
            updated: "Contact number don update well well.",
            deleted: "Contact number don delete.",
            saveError: "Dem no fit save the contact number.",
            deleteError: "Dem no fit delete the number.",
            missingFields: "Fields Dey Missing",
            missingFieldsDesc: "Abeg provide both name and number/code."
        }
    }
};

const localeFiles = ['ha', 'ig', 'yo', 'pcm'];

localeFiles.forEach(lang => {
    const filePath = `/Users/mac/hopelineWeb/src/locales/${lang}.json`;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.admin) data.admin = {};
    data.admin.contactManagement = translations[lang];
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated ${lang}.json`);
});

console.log('Done!');
