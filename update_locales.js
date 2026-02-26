const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'locales');
const files = ['ha.json', 'ig.json', 'yo.json', 'pcm.json'];

const cardViewTranslations = {
  "ha": {
    "allStatuses": "Dukkan Matsayi",
    "moreFilters": "Ƙarin Tace",
    "headOfFamily": "Shugaban iyali",
    "currentLocation": "Wurin da yake yanzu",
    "destination": "Inda zashi",
    "vulnerabilities": "Rauni",
    "activityHistory": "Tarihin ayyuka",
    "logActivity": "Rubuta Aiki",
    "noActivitiesLogged": "Babu ayyuka da aka rubuta tukunna.",
    "medicalNeeds": "Bukatun Lafiya",
    "assistanceRequested": "An nemi Taimako",
    "lastUpdate": "Sabuntawar ƙarshe",
    "navigate": "Nemo hanya",
    "satellite": "Satelite",
    "edit": "Gyara",
    "assignShelter": "Bada Wurin Zama",
    "resettle": "Sake zaunar da",
    "homebound": "Zai koma gida",
    "noPersonsFound": "Ba a sami mutanen da suka rasa muhallinsu ba",
    "addPersonPrompt": "Danna maballin \"Ƙara Mutum\" don yin rijistar sabon mutum da ke buƙatar taimako.",
    "permissionDenied": "An Hana Izini",
    "permissionDeniedDesc": "Baka da izinin ganin wannan bayanan. Da fatan za a duba dokokin tsaro na Firestore don ba da dama ga masu gudanarwa su karanta tarin 'displacedPersons'."
  },
  "ig": {
    "allStatuses": "Ọnọdụ niile",
    "moreFilters": "Ntinye ndị ọzọ",
    "headOfFamily": "Onye isi ezinụlọ",
    "currentLocation": "Ebe ọ nọ ugbu a",
    "destination": "Ebe ọ na-aga",
    "vulnerabilities": "Adịghị ike",
    "activityHistory": "Akụkọ mmemme",
    "logActivity": "Dekọọ Mmemme",
    "noActivitiesLogged": "Enweghị mmemme edekọrọ ugbu a.",
    "medicalNeeds": "Mkpa ahụike",
    "assistanceRequested": "Enyemaka a rịọrọ",
    "lastUpdate": "Mmelite ikpeazụ",
    "navigate": "Chọta ụzọ",
    "satellite": "Satịlaịtị",
    "edit": "Dezie",
    "assignShelter": "Nye Ebe Obibi",
    "resettle": "Bigharịa",
    "homebound": "Na-ala ụlọ",
    "noPersonsFound": "Enweghị ndị a chụpụrụ achụpụ a hụrụ",
    "addPersonPrompt": "Pịa bọtịnụ \"Tinyere Onye\" iji debanye aha onye ọhụrụ chọrọ enyemaka.",
    "permissionDenied": "Ajụrụ Ikike",
    "permissionDeniedDesc": "I nweghị ikike ịhụ data a. Biko lelee iwu nchekwa Firestore gị ka ikwe ka ndị nchịkwa gụọ nchịkọta 'displacedPersons'."
  },
  "yo": {
    "allStatuses": "Gbogbo Awọn Ipo",
    "moreFilters": "Awọn asẹ diẹ sii",
    "headOfFamily": "Olori ebi",
    "currentLocation": "Ibi ti o wa bayi",
    "destination": "Ibi ti o nlo",
    "vulnerabilities": "Awọn ailagbara",
    "activityHistory": "Itan Iṣẹ",
    "logActivity": "Fi Iṣẹ Ránṣẹ",
    "noActivitiesLogged": "Ko si awọn iṣẹ ti a fipamọ sibẹsibẹ.",
    "medicalNeeds": "Awọn Aini Iṣoogun",
    "assistanceRequested": "Iranlọwọ ti a beere",
    "lastUpdate": "Imudojuiwọn kẹhin",
    "navigate": "Wa ọna",
    "satellite": "Satẹlaiti",
    "edit": "Ṣatunkọ",
    "assignShelter": "Pese Ibi aabo",
    "resettle": "Tun gbe",
    "homebound": "Nlọ si ile",
    "noPersonsFound": "Ko si awọn eniyan ti a fipa nipo ti a ri",
    "addPersonPrompt": "Tẹ bọtini \"Fi Eniyan Kun\" lati forukọsilẹ olukuluku tuntun ti o nilo iranlọwọ.",
    "permissionDenied": "A kọ Iyọọda",
    "permissionDeniedDesc": "O ko ni aṣẹ lati wo data yii. Jọwọ ṣayẹwo awọn ofin aabo Firestore rẹ lati gba aaye kika fun akopọ 'displacedPersons' si awọn oludari."
  },
  "pcm": {
    "allStatuses": "All Statuses",
    "moreFilters": "More Filters",
    "headOfFamily": "Head of family",
    "currentLocation": "Current Location",
    "destination": "Where dem dey go",
    "vulnerabilities": "Vulnerabilities",
    "activityHistory": "Wetin happen history",
    "logActivity": "Log Wetin Happen",
    "noActivitiesLogged": "No activity log yet.",
    "medicalNeeds": "Health Needs",
    "assistanceRequested": "Help Requested",
    "lastUpdate": "Last time we update",
    "navigate": "Find am",
    "satellite": "Satellite",
    "edit": "Edit",
    "assignShelter": "Give Dem Camp",
    "resettle": "Resettle Dem",
    "homebound": "Dem don go house",
    "noPersonsFound": "We no see any IDP",
    "addPersonPrompt": "Click 'Add Person' to drop new IDP details.",
    "permissionDenied": "Na Oga only level",
    "permissionDeniedDesc": "You no get clearance. Make Admin check Firestore setting to allow read for 'displacedPersons'."
  }
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const langKey = file.replace('.json', '');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.admin && data.admin.displacedPersons) {
      data.admin.displacedPersons.cardView = cardViewTranslations[langKey];
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      console.log(`Updated ${file}`);
    }
  }
});
