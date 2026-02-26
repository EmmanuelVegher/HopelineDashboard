const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'locales');
const files = ['ha.json', 'ig.json', 'yo.json', 'pcm.json'];

const translations = {
  ha: {
    "title": "Gudanar da Wurin Zama",
    "subtitle": "Kula da gudanar da damar wurin zama, ayyuka, da albarkatu",
    "refreshData": "Sake Watsa Bayanai",
    "addNewShelter": "Ƙara Sabon Wurin Zama",
    "cards": {
      "totalCapacity": "Jimillar Ƙarfi",
      "occupied": "wanda aka mamaye",
      "availableSpaces": "Ramin Da Ake Da Su",
      "available": "mai samuwa",
      "activeShelters": "Wuraren zama masu aiki",
      "ofTotal": "cikin {total} gaba ɗaya",
      "emergencyRequests": "Buƙatun Gaggawa",
      "pendingResponse": "jiran amsa"
    },
    "tabs": {
      "overview": "Bayanin Wurin Zama",
      "map": "Kula da Rayuwa & Shinge",
      "capacity": "Gudanar da Ƙarfi",
      "capacityMobile": "Ƙarfi",
      "media": "Kayayyakin Fasaha",
      "operations": "Ayyuka"
    },
    "map": {
      "title": "Shingen Wurin Zama & Kula da Rayuwa",
      "desc": "Yanayin lokaci da Kula da kewaye don duk wuraren zama masu aiki",
      "perimeter": "Kewaye Wurin Zama",
      "operational": "Aiki",
      "occupancy": "Zama:"
    },
    "overview": {
      "permissionDenied": "An Hana Izini",
      "permissionDeniedDesc": "Ba ka da damar ganin bayanan wurin zama. Da fatan za a duba dokokin tsaro na Firestore don ba da dama ga masu gudanarwa su karanta tarin 'shelters'.",
      "noShelters": "Ba a sami wuraren zama a cikin ma'adanar bayanai ba.",
      "requests": "Buƙatun",
      "totalCapacity": "Jimillar Ƙarfi",
      "occupied": "Wanda aka mamaye",
      "available": "Mai samuwa",
      "manager": "Manaja:",
      "viewDetails": "Duba Cikakken Bayani",
      "contact": "Tuntuɓa",
      "manage": "Gudanarwa"
    },
    "media": {
      "droneView": "Ganin Drone",
      "photos": "Hotuna",
      "droneFootage": "Bidiyon Sama da Drone",
      "youtubeStream": "Bidiyon YouTube",
      "openYoutube": "Buɗe YouTube",
      "infrastructurePhotos": "Hotunan Gine-ginen Wurin Zama",
      "noMedia": "Babu kayayyakin fasaha masu samuwa",
      "addMedia": "Ƙara Kayayyakin Fasaha",
      "lastInspection": "Binciken wuri na ƙarshe:",
      "fullReport": "Cikakken Rahoto",
      "noAssets": "Ba A Dora Kayayyakin Fasaha Ba",
      "noAssetsDesc": "Ana iya ƙara bidiyon drone da manyan hotunan wuri ta hanyar maɓallin 'Gudanarwa' a cikin Bayanin Wurin Zama."
    },
    "capacity": {
      "title": "Gudanar da Ƙarfi",
      "desc": "Duba cikakken bayanin ƙarfi da gudanar da sarari a wurin zama.",
      "occupied": "Wanda aka mamaye",
      "available": "Mai samuwa",
      "total": "Jimilla",
      "occupancy": "Zama",
      "manage": "Gudanarwa",
      "table": {
        "shelter": "Wurin Zama",
        "status": "Matsayi",
        "occupied": "Wanda aka mamaye",
        "available": "Mai samuwa",
        "total": "Jimilla",
        "occupancy": "Zama",
        "actions": "Ayyuka"
      }
    },
    "operations": {
      "title": "Ayyukan Wurin Zama",
      "desc": "Kula da yanayin aiki, buƙatu, da tuntuɓar manajoji.",
      "manager": "Manaja",
      "contact": "Tuntuɓa",
      "emergencyRequests": "Buƙatun Gaggawa",
      "occupancyTrend": "Yanayin Zama",
      "lastUpdate": "Sabuntawar Ƙarshe",
      "call": "Kira",
      "manage": "Gudanarwa",
      "table": {
        "shelter": "Wurin Zama",
        "manager": "Manaja",
        "contact": "Tuntuɓa",
        "emergencyRequests": "Buƙatun Gaggawa",
        "occupancyTrend": "Yanayin Zama",
        "lastUpdate": "Sabuntawar Ƙarshe",
        "actions": "Ayyuka"
      }
    },
    "dialogs": {
      "manageShelter": "Gudanar da Wurin Zama",
      "addShelter": "Ƙara Sabon Wurin Zama",
      "manageDesc": "Sabunta bayanan wannan wurin zama.",
      "addDesc": "Cika bayanan sabon wurin zama.",
      "contactManager": "Tuntuɓi Manajan Wurin Zama",
      "contactDesc": "Tutuɓi manajan wurin zama don maganganun gaggawa ko daidaitawa."
    },
    "contact": {
      "shelterManager": "Manajan Wurin Zama",
      "contactNumber": "Lambar Tuntuba",
      "callNow": "Kira Yanzu",
      "close": "Rufe"
    },
    "form": {
      "shelterName": "Sunan Wurin Zama",
      "organization": "Ƙungiya",
      "location": "Wuri",
      "state": "Jiha",
      "selectState": "Zaɓi Jiha",
      "totalCapacity": "Jimillar Ƙarfi",
      "availableCapacity": "Ƙarfin Da Ake Da Shi",
      "emergencyRequests": "Buƙatun Gaggawa",
      "facilities": "Kayayyakin Aiki (raba da wakafi)",
      "facilitiesPlaceholder": "misali. Lafiya, Abinci, Ruwa",
      "security": "Bayanan Tsaro",
      "securityPlaceholder": "Bayyana matakan tsaro...",
      "managerName": "Sunan Manaja",
      "phone": "Lambar Tuntuba",
      "image": "Hoton Wurin Zama",
      "noImage": "Babu Hoto",
      "uploading": "Ana dorawa...",
      "changeImage": "Sauya Hoto",
      "uploadImage": "Dora Hoton Wurin Zama",
      "imageRecommend": "An ba da shawarar 800x600px ko sama. Matsakaici 5MB.",
      "geofence": "Shinge (Kusurwa 4)",
      "corner": "Kusurwa",
      "latitude": "Latitude",
      "longitude": "Longitude",
      "kmlIntegration": "Haɗin KML na Kewayen Taswirar Google",
      "kmlPlaceholder": "misali. https://www.google.com/maps/d/u/0/kml?mid=...",
      "kmlDesc": "Don amfani da taswirar ka ta Google, sanya ta a bayyane kuma yi amfani da reshen fitowar KML. Tsarin misali:",
      "mediaAssets": "Kayayyakin Fasaha",
      "droneVideo": "Hanyar Bidiyon Drone",
      "dronePlaceholder": "misali. https://storage.googleapis.com/videos/drone-view.mp4",
      "photoGallery": "Tarin Hotuna (hanyoyin raba wakafi)",
      "photoPlaceholder": "hanya1, hanya2, hanya3",
      "cancel": "Soke",
      "saving": "Ajiye...",
      "save": "Ajiye Wurin Zama",
      "imageUploaded": "An yi nasarar dora hoton wurin zama.",
      "uploadFailed": "Ba a iya dora hoto ba.",
      "updated": "An yi nasarar sabunta wurin zama.",
      "created": "An yi nasarar kirkirar wurin zama.",
      "saveError": "Ba a iya ajiye wurin zama. Duba damar Firestore."
    },
    "status": {
      "operational": "Aiki",
      "full": "Cikakke",
      "emergencyOnly": "Gaggawa Kawai"
    },
    "trend": {
      "increasing": "Yana karuwa",
      "decreasing": "Yana raguwa",
      "stable": "Tsaye"
    }
  },
  ig: {
    "title": "Nchịkwa Ebe Obibi",
    "subtitle": "Nyochaa ma jikwaa ikike ebe obibi, arụmọrụ, na akụrụngwa",
    "refreshData": "Nyeghachi Data",
    "addNewShelter": "Tinye Ebe Obibi Ọhụrụ",
    "cards": {
      "totalCapacity": "Ngụkọta Ikike",
      "occupied": "ebi",
      "availableSpaces": "Oghere Ndị Dị Nnọọ",
      "available": "dịnụ",
      "activeShelters": "Ebe Obibi Na-arụ Ọrụ",
      "ofTotal": "nke {total} ngụkọta",
      "emergencyRequests": "Arịrịọ Mberede",
      "pendingResponse": "na-echere nzaghachi"
    },
    "tabs": {
      "overview": "Nchịkọta Ebe Obibi",
      "map": "Nsochi Dị Ndụ & Ogige",
      "capacity": "Nchịkwa Ikike",
      "capacityMobile": "Ikike",
      "media": "Akụkụ Mgbasa ozi",
      "operations": "Ọrụ"
    },
    "map": {
      "title": "Nchichi Ebe Obibi & Nsochi Dị Ndụ",
      "desc": "Ọnọdụ oge na nlekota gburugburu maka ebe obibi niile na-arụ ọrụ",
      "perimeter": "Gburugburu Ebe Obibi",
      "operational": "Na-arụ ọrụ",
      "occupancy": "Obibi:"
    },
    "overview": {
      "permissionDenied": "Ajụrụ Ikike",
      "permissionDeniedDesc": "I nweghi ikike i ịhụ data ebe obibi. Biko lelee iwu nchekwa Firestore gị ka ikwe ka ndị nchịkwa gụọ nchịkọta 'shelters'.",
      "noShelters": "A hụghị ebe obibi ọ bụla na nchekwa data.",
      "requests": "Arịrịọ",
      "totalCapacity": "Ngụkọta Ikike",
      "occupied": "Ndị Bi Ebi",
      "available": "Dịnụ",
      "manager": "Onye Nchịkwa:",
      "viewDetails": "Hụ Nkọwa",
      "contact": "Kpọtụrụ",
      "manage": "Jikwaa"
    },
    "media": {
      "droneView": "Ekiri Drone",
      "photos": "Foto",
      "droneFootage": "Etu E Si Ahụ site na Drone",
      "youtubeStream": "Stream Vidio YouTube",
      "openYoutube": "Mepee YouTube",
      "infrastructurePhotos": "Foto Ihe Owuwu Ebe Obibi",
      "noMedia": "Enweghị akụrụngwa mgbasa ozi",
      "addMedia": "Tinye Mgbasa Ozi",
      "lastInspection": "Nnyocha saịtị ikpeazụ:",
      "fullReport": "Akụkọ Zuruzu",
      "noAssets": "Akwadobeghi Akụ Mgbasa Ozi Ọbụla",
      "noAssetsDesc": "Enwere ike ịgbakwunye vidiyo Drone na foto saịtị nke dị elu site na bọtịnụ 'Jikwaa' n'ime taabụ Nchịkọta Ebe obibi."
    },
    "capacity": {
      "title": "Nchịkwa Ikike",
      "desc": "Hụ nkọwa zuru ezu gbasara ikike ma jikwaa oghere ebe obibi.",
      "occupied": "Ndị Bi Ebi",
      "available": "Dịnụ",
      "total": "Ngụkọta",
      "occupancy": "Ọnụ Bi Ebi",
      "manage": "Jikwaa",
      "table": {
        "shelter": "Ebe obibi",
        "status": "Ọnọdụ",
        "occupied": "Ndị Bi Ebi",
        "available": "Dịnụ",
        "total": "Ngụkọta",
        "occupancy": "Ọnụ Bi Ebi",
        "actions": "Omume"
      }
    },
    "operations": {
      "title": "Ọrụ Ebe Obibi",
      "desc": "Nyochaa ọnọdụ arụmọrụ, arịrịọ, na kọtụrụ ndị njikwa.",
      "manager": "Onye Nchịkwa",
      "contact": "Ndị ana-akpọ",
      "emergencyRequests": "Arịrịọ Mberede",
      "occupancyTrend": "Ọdịnihu Obibi",
      "lastUpdate": "Mmelite Ikpeazụ",
      "call": "Kpọọ",
      "manage": "Jikwaa",
      "table": {
        "shelter": "Ebe obibi",
        "manager": "Onye Nchịkwa",
        "contact": "Kọtụla",
        "emergencyRequests": "Arịrịọ Mberede",
        "occupancyTrend": "Ọdịnihu Obibi",
        "lastUpdate": "Mmelite Ikpeazụ",
        "actions": "Omume"
      }
    },
    "dialogs": {
      "manageShelter": "Jikwaa Ebe Obibi",
      "addShelter": "Tinye Ebe Obibi Ọhụrụ",
      "manageDesc": "Mmelite nkọwa maka ebe obibi a.",
      "addDesc": "Mechaa nkọwa maka ebe obibi ọhụrụ.",
      "contactManager": "Kọtụrụ Onye Nchịkwa Ebe Obibi",
      "contactDesc": "Nwee mmekọrịta na onye na-ahụ maka ebe mgbaba maka ihe ngwa ngwa ma ọ bụ nhazi."
    },
    "contact": {
      "shelterManager": "Onye Nchịkwa Ebe Obibi",
      "contactNumber": "Nọmba Kpọtụrụ",
      "callNow": "Kpọọ Ugbu a",
      "close": "Mechie"
    },
    "form": {
      "shelterName": "Aha Ebe Obibi",
      "organization": "Òtù",
      "location": "Ebe Ọdụ",
      "state": "Steeti",
      "selectState": "Họrọ Steeti",
      "totalCapacity": "Ngụkọta Ikike",
      "availableCapacity": "Ikike Dị Lọọ",
      "emergencyRequests": "Arịrịọ Mberede",
      "facilities": "Ụlọ Ọrụ (nke nwere eriri kọma)",
      "facilitiesPlaceholder": "d.g. Ahụike, Nri, Mmiri",
      "security": "Nkọwa Nchekwa",
      "securityPlaceholder": "Kọwaa ihe ndị nchekwa...",
      "managerName": "Aha Onye Nchịkwa",
      "phone": "Ekwentị Njikọ",
      "image": "Foto Ebe Obibi",
      "noImage": "Enweghị Foto",
      "uploading": "Na-ebugote...",
      "changeImage": "Change Image",
      "uploadImage": "Bulite Foto Ebe Obibi",
      "imageRecommend": "A na-akwado 800x600px ma ọ bụ karịa. Nke kacha ibu 5MB.",
      "geofence": "Geofence (Ihe Mbadamba Anọ)",
      "corner": "Akuku",
      "latitude": "Latitude",
      "longitude": "Longitude",
      "kmlIntegration": "Mgbakwunye Google My Maps KML",
      "kmlPlaceholder": "d.g. https://www.google.com/maps/d/u/0/kml?mid=...",
      "kmlDesc": "Iji Google My Map mee ihe, mee ka ọ pụta n'ihu ọha ma jikwaa njikọ nkwupụta KML. Ụdị atụmatụ:",
      "mediaAssets": "Akụkụ Mgbasa ozi",
      "droneVideo": "URL Vidiyo Drone",
      "dronePlaceholder": "d.g. https://storage.googleapis.com/videos/drone-view.mp4",
      "photoGallery": "Foto Ngosi (comma-separated URLs)",
      "photoPlaceholder": "url1, url2, url3",
      "cancel": "Kansụl",
      "saving": "Na-azọpụta...",
      "save": "Chekwa Ebe Obibi",
      "imageUploaded": "Ebugola ihe oyiyi ebe obibi gara nke ọma.",
      "uploadFailed": "Enweghị ike ibugo ihe oyiyi.",
      "updated": "Emezigharịrị ebe obibi nke ọma.",
      "created": "Emepụtara ebe obibi nke ọma.",
      "saveError": "Enweghị ike ịchekwa ebe obibi. Leta ikike Firestore."
    },
    "status": {
      "operational": "Arụmọrụ",
      "full": "Ejuola",
      "emergencyOnly": "Mberede Naanị"
    },
    "trend": {
      "increasing": "Na abawanye",
      "decreasing": "Nna ebelata",
      "stable": "Guzosie ike"
    }
  },
  yo: {
    "title": "Isakoso Ibugbe",
    "subtitle": "Bojuto ki o si ṣakoso agbara ibugbe, awọn iṣẹ, ati awọn oluşewadi",
    "refreshData": "Tun Sọfitiwia",
    "addNewShelter": "Fi Ibugbe Titun Kun",
    "cards": {
      "totalCapacity": "Lapapọ Agbara",
      "occupied": "kún",
      "availableSpaces": "Awọn Alafo Ti o Wa",
      "available": "wa ninu rẹ",
      "activeShelters": "Awọn ibugbe Ti n Ṣiṣẹ",
      "ofTotal": "ninu {total} gbogbo",
      "emergencyRequests": "Awọn ibeere Pajawiri",
      "pendingResponse": "nduro esi"
    },
    "tabs": {
      "overview": "Akopọ Ibugbe",
      "map": "Olutopa laaye ati Geofence",
      "capacity": "Isakoso Agbara",
      "capacityMobile": "Agbara",
      "media": "Awọn dukia Media",
      "operations": "Awọn isẹ"
    },
    "map": {
      "title": "Geofencing Ibugbe ati Titọpinpin laaye",
      "desc": "Ipo akoko ati mimojuto fun gbogbo awọn ibugbe ti n ṣiṣẹ",
      "perimeter": "Agbala Ibugbe",
      "operational": "Ṣiṣẹ",
      "occupancy": "Iwọn eniyan:"
    },
    "overview": {
      "permissionDenied": "Ikankan Ti A Kọ",
      "permissionDeniedDesc": "O ko ni aṣẹ lati wo data ibi aabo yii. Jọwọ ṣayẹwo awọn ofin aabo Firestore rẹ lati gba aṣẹ kika ti 'shelters' si adari.",
      "noShelters": "Ko si awọn ibugbe kankan ninu rẹ.",
      "requests": "Iranti",
      "totalCapacity": "Lapapọ Agbara",
      "occupied": "Di pupọ",
      "available": "Ṣe Wa",
      "manager": "Oluṣakoso:",
      "viewDetails": "Wo Alaye rẹ",
      "contact": "Kansi",
      "manage": "Ṣakoso"
    },
    "media": {
      "droneView": "Wiwa Drone",
      "photos": "Awọn aworan",
      "droneFootage": "Iyaworan eriali wunmi",
      "youtubeStream": "Sisanwọle fidio lati inu YouTube",
      "openYoutube": "Ṣii YouTube",
      "infrastructurePhotos": "Aworan ibugbe aabo",
      "noMedia": "Ko si media media kankan",
      "addMedia": "Ṣe afikun media",
      "lastInspection": "Ṣayẹwo oju opo wẹẹbu to kẹhin:",
      "fullReport": "Akọọlẹ kikun",
      "noAssets": "Ko si Awọn Duki Aworan Kanka",
      "noAssetsDesc": "Fidio awọn ọkọ ofurufu ati awọn fọto aaye to to lagbara le jẹ afikun ninu 'Manage' bọtini ninu apakan Ibi Aabo."
    },
    "capacity": {
      "title": "Agbara Abojuto",
      "desc": "Ṣe ayẹwo alaye alaye ijẹrisi ati iṣakoso nọmba ibugbe.",
      "occupied": "A ti lo",
      "available": "Ti nwa",
      "total": "Apapọ",
      "occupancy": "Eniyan inu yara",
      "manage": "Ṣelopo",
      "table": {
        "shelter": "Ibugbe",
        "status": "Ipo",
        "occupied": "A ti gba wá",
        "available": "O wa",
        "total": "Papọ",
        "occupancy": "Ipo Ibugbe",
        "actions": "Awọn iṣe"
      }
    },
    "operations": {
      "title": "Abojuto Isakoso",
      "desc": "Monito, beere ati sopọ si awọn agbabojuto.",
      "manager": "Agbabojuto",
      "contact": "Ifikansin",
      "emergencyRequests": "Ibeere ikanni isẹ",
      "occupancyTrend": "Afikun Ipo Ibugbe",
      "lastUpdate": "Imudojuiwọn ikẹhin",
      "call": "Pe",
      "manage": "Ṣelopo",
      "table": {
        "shelter": "Ibugbe",
        "manager": "Agbabojuto",
        "contact": "Ifikansin",
        "emergencyRequests": "Ibeere isẹ lẹkọkan",
        "occupancyTrend": "Ilana ijẹrisi ibugbe",
        "lastUpdate": "Akoko to ṣẹṣẹ de",
        "actions": "Awọn isẹ"
      }
    },
    "dialogs": {
      "manageShelter": "Toju ibugbe yii",
      "addShelter": "Fi Ibugbe Tuntun Kun",
      "manageDesc": "Nkan aiyera awọn igbimọ fun ibi ibi asala yi.",
      "addDesc": "Yàn awari alaye ti o nilo fun ibi asala titun yi.",
      "contactManager": "Se Ikansin Abasi ile Aabo",
      "contactDesc": "Wo asala gbogbo ibi ise ati eja ati abagbe re yara si eyikeyi ni abere yi."
    },
    "contact": {
      "shelterManager": "Oga Awada ile Aabo",
      "contactNumber": "Nọmba ikan silẹ",
      "callNow": "Pè Owo rẹ bayi",
      "close": "Pa da kuro"
    },
    "form": {
      "shelterName": "Orukọ Ibi Aabo",
      "organization": "Ẹgbẹ",
      "location": "Ipo ibi",
      "state": "Ipinle",
      "selectState": "Yan ipinle",
      "totalCapacity": "Gbogbo Agbara Rẹ",
      "availableCapacity": "Iwọn ti O Wa",
      "emergencyRequests": "Ibere Ile Iwosan lẹsẹkẹsẹ",
      "facilities": "Awọn ohun-ini (Yato rẹ fun igi atijọ)",
      "facilitiesPlaceholder": "e.g. Itọju-ara, Ounjẹ, Omi",
      "security": "Awọn ofin isakoṣo nipa ẹrọ ifọwọkan",
      "securityPlaceholder": "Ṣe afihan adẹtẹle ...",
      "managerName": "Orukọ Agbaṣẹ-ofin",
      "phone": "Foonu ibasọrọ",
      "image": "Aworan ibugbe",
      "noImage": "Ko saaworan",
      "uploading": "Bẹrẹ mimu ...",
      "changeImage": "Yipada Aworan Opopọ",
      "uploadImage": "Mu Aworan Ibi-iwadi wole",
      "imageRecommend": "Da ti a ko di ba 800x600px. Igbona ga jẹ 5MB.",
      "geofence": "Itakun Ayelujara(Awari 4 igun-ipa)",
      "corner": "Agun kọ̀n",
      "latitude": "Latitude giga",
      "longitude": "Ipò-rùn",
      "kmlIntegration": "Ijọpọ KML Google Maps",
      "kmlPlaceholder": "e.g. https://www.google.com/maps/d/u/0/kml?mid=...",
      "kmlDesc": "Lo gidi awọn Google Map pẹlu ifẹnukonu ita, lẹhin rẹ si yan Ọna KML nkan yi: Apejuwe ilana rẹ:",
      "mediaAssets": "Eto Gidi ohun ayelujara",
      "droneVideo": "Bídíẹ-ifẹ gẹlẹ Drone",
      "dronePlaceholder": "e.g. https://storage.googleapis.com/videos/drone-view.mp4",
      "photoGallery": "Idojukọ àwọn Ọrọ (A ti dárú gólótìnṣe lọ pẹ̀lu)",
      "photoPlaceholder": "Omi rẹ 1, omi rẹ baadi-o 2, omi isiyi gogo 3",
      "cancel": "Apefiyesi",
      "saving": "Fi igbesi rẹ ranṣẹ...",
      "save": "Toju ibi ibugbe lẹhin na",
      "imageUploaded": "Nṣakoso fọto yi ṣe iranlọwọ daadaa",
      "uploadFailed": "A ko lè ṣe ifilọ fọto ayebaye",
      "updated": "Ṣeto ibi ọna kan di da.",
      "created": "Ẹlẹda ile titun yi gẹgẹbi akọsilẹ",
      "saveError": "Ko lè fi gbogbo irọ isan-ninu pamo si yara Firestore yii."
    },
    "status": {
      "operational": "Sise",
      "full": "O kún",
      "emergencyOnly": "Pajawiri Nikan"
    },
    "trend": {
      "increasing": "N pọ sii",
      "decreasing": "Idinku",
      "stable": "Iduroṣinṣin"
    }
  },
  pcm: {
    "title": "Shelter Management",
    "subtitle": "Monitor and manage camp capacity, wetin dem dey do, and resources",
    "refreshData": "Reload Data",
    "addNewShelter": "Add New Shelter",
    "cards": {
      "totalCapacity": "Total Capacity",
      "occupied": "occupied",
      "availableSpaces": "Spaces wey remain",
      "available": "available",
      "activeShelters": "Shelters wey dey open",
      "ofTotal": "of {total} total",
      "emergencyRequests": "Emergency Requests",
      "pendingResponse": "na dem we dey watch"
    },
    "tabs": {
      "overview": "Camp Overview",
      "map": "Live Tracker & Geofence",
      "capacity": "Capacity Management",
      "capacityMobile": "Capacity",
      "media": "Media Assets",
      "operations": "Wetin Happen"
    },
    "map": {
      "title": "Camp Geofencing & Live Tracking",
      "desc": "Real-time wetin dey happen inside every active shelter",
      "perimeter": "Shelter Perimeter",
      "operational": "E dey work",
      "occupancy": "People ground:"
    },
    "overview": {
      "permissionDenied": "No Road",
      "permissionDeniedDesc": "You no get level to see dis camp data. Make Admin check Firestore setting to allow read.",
      "noShelters": "We no see any shelter inside database.",
      "requests": "Requests",
      "totalCapacity": "Total Capacity",
      "occupied": "Dem dey",
      "available": "E dey",
      "manager": "Oga:",
      "viewDetails": "View details",
      "contact": "Contact",
      "manage": "Manage am"
    },
    "media": {
      "droneView": "Drone View",
      "photos": "Photocopy",
      "droneFootage": "Drone Aerial Footage",
      "youtubeStream": "YouTube Video Stream",
      "openYoutube": "Open YouTube",
      "infrastructurePhotos": "Camp Photos",
      "noMedia": "No media available",
      "addMedia": "Add Media",
      "lastInspection": "Last time site check:",
      "fullReport": "Full Report",
      "noAssets": "No Media Uploaded",
      "noAssetsDesc": "Drone video and good quality photos fit dey added from di 'Manage am' button."
    },
    "capacity": {
      "title": "Capacity Management",
      "desc": "Check space full capacity and manage the remaining ones.",
      "occupied": "Dem Dey",
      "available": "Available",
      "total": "Total",
      "occupancy": "Occupancy",
      "manage": "Manage am",
      "table": {
        "shelter": "Shelter",
        "status": "Level",
        "occupied": "Dem full",
        "available": "Available",
        "total": "Total",
        "occupancy": "Occupancy",
        "actions": "Actions"
      }
    },
    "operations": {
      "title": "Camp Activity",
      "desc": "Track wetin happen, make request, and call oga.",
      "manager": "Oga pata pata",
      "contact": "Number",
      "emergencyRequests": "Emergency Requests",
      "occupancyTrend": "People level",
      "lastUpdate": "Last time we over",
      "call": "Holla Oga",
      "manage": "Manage am",
      "table": {
        "shelter": "Shelter",
        "manager": "Oga",
        "contact": "Number",
        "emergencyRequests": "Emergency",
        "occupancyTrend": "People dey pass",
        "lastUpdate": "Last Update",
        "actions": "Action"
      }
    },
    "dialogs": {
      "manageShelter": "Manage Dis Camp",
      "addShelter": "Add New Camp",
      "manageDesc": "Update wetin dey on top of dis place",
      "addDesc": "Fill paper make you complete new Camp registeration",
      "contactManager": "Call Camp Oga",
      "contactDesc": "Call dis guy to coordinate or answer your emergency issues."
    },
    "contact": {
      "shelterManager": "Shelter Oga",
      "contactNumber": "Phone",
      "callNow": "Call Am Direct",
      "close": "Comot"
    },
    "form": {
      "shelterName": "Shelter Name",
      "organization": "Company",
      "location": "Location",
      "state": "State",
      "selectState": "Choose State",
      "totalCapacity": "Total Capacity",
      "availableCapacity": "Available Capacity",
      "emergencyRequests": "Emergency Requests",
      "facilities": "Facilities (use comma)",
      "facilitiesPlaceholder": "e.g. Clinic, Food, Water",
      "security": "Security Settings",
      "securityPlaceholder": "Write security pattern...",
      "managerName": "Oga Name",
      "phone": "Contact Ph",
      "image": "Camp Pic",
      "noImage": "No pic",
      "uploading": "Uploading...",
      "changeImage": "Change Picture",
      "uploadImage": "Upload the pic before",
      "imageRecommend": "Smallest dimension 800x600px. Big no dey above 5MB.",
      "geofence": "Geofence (4 Boundary)",
      "corner": "Side",
      "latitude": "Latitude",
      "longitude": "Longitude",
      "kmlIntegration": "Google Map Link",
      "kmlPlaceholder": "e.g. https://www.google.com/maps/d/u/0/kml?mid=...",
      "kmlDesc": "To use Google My Map, make am public and bring the KML export here. Format:",
      "mediaAssets": "Media Assets",
      "droneVideo": "Drone Video URL",
      "dronePlaceholder": "e.g. https://storage.googleapis.com/videos/drone-view.mp4",
      "photoGallery": "Pishor Links (use comma)",
      "photoPlaceholder": "url1, url2, url3",
      "cancel": "Cancel",
      "saving": "Saving am...",
      "save": "Save Dis Camp",
      "imageUploaded": "You don load am finish.",
      "uploadFailed": "We no fit upload the picture.",
      "updated": "Shelter details don get update.",
      "created": "Shelter successfully create.",
      "saveError": "E fail. Check your permission level inside Firestore."
    },
    "status": {
      "operational": "E dey work",
      "full": "Full as drum",
      "emergencyOnly": "Emergency level"
    },
    "trend": {
      "increasing": "E dey go up",
      "decreasing": "E dey drop",
      "stable": "E catch am steady"
    }
  }
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const langKey = file.replace('.json', '');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.admin) {
      data.admin.trackShelter = translations[langKey];
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      console.log(`Updated ${file}`);
    }
  }
});
