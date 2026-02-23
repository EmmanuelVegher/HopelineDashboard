const fs = require('fs');
const path = require('path');

const deleteAccountTranslations = {
  en: {
    "deleteAccount": {
      "title": "Delete Account",
      "subtitle": "Request account and data deletion",
      "warning": "Warning: This action is permanent. Once your account is deleted, all your data, including history, records, and settings, will be permanently removed and cannot be recovered.",
      "requestTitle": "Submit Deletion Request",
      "reasonLabel": "Reason for deletion (Optional)",
      "reasonPlaceholder": "Please tell us why you want to delete your account...",
      "confirmCheckbox": "I understand that this action is irreversible and all my data will be lost.",
      "submitButton": "Submit Deletion Request",
      "cancelButton": "Cancel",
      "successTitle": "Request Received",
      "successMessage": "Your request for account and data deletion has been received. Our team will process it within 30 days in accordance with our privacy policy.",
      "errorTitle": "Submission Failed",
      "errorMessage": "There was an error submitting your request. Please try again later or contact support directly."
    }
  },
  ha: {
    "deleteAccount": {
      "title": "Goge Akanta",
      "subtitle": "Nemi goge akanta da bayanai",
      "warning": "Gargaɗi: Wannan aikin na dindindin ne. Da zarar an goge akantarka, duk bayananka, gami da tarihi, bayanan sirri, da saituna, za a cire su na dindindin kuma ba za a iya dawo da su ba.",
      "requestTitle": "Sanya Neman Goge Akanta",
      "reasonLabel": "Dalilin gogewa (Zabibi)",
      "reasonPlaceholder": "Da fatan za a gaya mana dalilin da yasa kake son goge akantarka...",
      "confirmCheckbox": "Na fahimci cewa wannan aikin ba za a iya sauyawa ba kuma duk bayanana za su bace.",
      "submitButton": "Sanya Neman Goge Akanta",
      "cancelButton": "Soke",
      "successTitle": "An Karɓi Buƙata",
      "successMessage": "An karɓi buƙatarka ta goge akanta da bayanai. Tawagar mu za ta aiwatar da ita cikin kwanaki 30 daidai da manufofin mu na sirri.",
      "errorTitle": "Ba a yi nasara ba",
      "errorMessage": "An sami kuskure wajen gabatar da buƙatarka. Da fatan za a sake gwadawa daga baya ko tuntuɓi tallafi kai tsaye."
    }
  },
  ig: {
    "deleteAccount": {
      "title": "Hichapụ Akaụntụ",
      "subtitle": "Rịọ ka ehichapụ akaụntụ na data",
      "warning": "Ịdọ aka ná ntị: Ihe a ị na-eme bụ nke na-adịgide adịgide. Ozugbo ehichapụrụ akaụntụ gị, data gị niile, gụnyere akụkọ mbu, ndekọ, na ntọala, ga-apụ kpamkpam ma agaghị enwe ike iweghachite ha.",
      "requestTitle": "Nyefee Arịrịọ Nhichapụ",
      "reasonLabel": "Ihe kpatara nhichapụ (Nhọrọ)",
      "reasonPlaceholder": "Biko gwa anyị ihe kpatara ịchọrọ ihichapụ akaụntụ gị...",
      "confirmCheckbox": "Aghọtara m na a gaghị enwe ike ịgbanwe ihe a na data m niile ga-atụfu.",
      "submitButton": "Nyefee Arịrịọ Nhichapụ",
      "cancelButton": "Kagbuo",
      "successTitle": "Enwetara Arịrịọ",
      "successMessage": "Enwetara arịrịọ gị maka nhichapụ akaụntụ na data. Ndị otu anyị ga-arụ ya n'ime ụbọchị 30 dịka usoro nzuzo anyị si dị.",
      "errorTitle": "Ntọhapụ Adaghị",
      "errorMessage": "Enwere njehie n'inyefee arịrịọ gị. Biko gbalịa ọzọ ma emechaa ma ọ bụ kpọtụrụ ndị na-enyere anyị aka ozugbo."
    }
  },
  yo: {
    "deleteAccount": {
      "title": "Pa Àkàǹtì Rẹ́",
      "subtitle": "Tọrọ kí a pa àkàǹtì àti ìsọfúnni rẹ́",
      "warning": "Ìkìlọ̀: Ìgbésẹ̀ yìí kò ṣeé yípadà. Nígbà tí a bá pa àkàǹtì rẹ́ tán, gbogbo ìsọfúnni rẹ, pẹ̀lú àwọn àkọsílẹ̀, iṣẹ́ rẹ, àti àwọn ètò rẹ, yóò parẹ́ pátápátá tí kò sì ní ṣeé rí mọ́.",
      "requestTitle": "Fi Ìbéèrè Ìparẹ́ Sílẹ̀",
      "reasonLabel": "Ìdí fún ìparẹ́ (Bí o bá fẹ́)",
      "reasonPlaceholder": "Jọ̀wọ́ sọ fún wa ìdí tí o fi fẹ́ pa àkàǹtì rẹ́...",
      "confirmCheckbox": "Mo gbà pé ìgbésẹ̀ yìí kò ṣeé yípadà àti pé gbogbo ìsọfúnni mi yóò parẹ́.",
      "submitButton": "Fi Ìbéèrè Ìparẹ́ Sílẹ̀",
      "cancelButton": "Fagile",
      "successTitle": "A Ti Gba Ìbéèrè Rẹ",
      "successMessage": "A ti gba ìbéèrè rẹ láti pa àkàǹtì àti ìsọfúnni rẹ́. Ẹgbẹ́ wa yóò ṣiṣẹ́ lórí rẹ̀ láàárín ọjọ́ ọgbọ̀n gẹ́gẹ́ bí ìlànà ìpamọ́ wa.",
      "errorTitle": "Ìkùnà Láti Fi Sini",
      "errorMessage": "Àṣìṣe kan wáyé nígbà tí o ń fi ìbéèrè rẹ sílẹ̀. Jọ̀wọ́ gbìyànjú padà níkẹyìn tàbí kí o kàn sí ẹgbẹ́ ìrànwọ́ wa tààrà."
    }
  },
  pcm: {
    "deleteAccount": {
      "title": "Delete Account",
      "subtitle": "Ask for account and data deletion",
      "warning": "Warning: Dis action na permanent. Once your account delete, all your data, including history, records, and settings, go commot forever and you no go fit get dem back.",
      "requestTitle": "Submit Deletion Request",
      "reasonLabel": "Reason why you want delete (Optional)",
      "reasonPlaceholder": "Please tell us why you want delete your account...",
      "confirmCheckbox": "I understand say I no go fit change dis thing once I do am and all my data go loss.",
      "submitButton": "Submit Deletion Request",
      "cancelButton": "Cancel",
      "successTitle": "We Get Your Request",
      "successMessage": "We don get your request for account and data deletion. Our team go work on am within 30 days based on our privacy policy.",
      "errorTitle": "Submission Fail",
      "errorMessage": "Error occur as you try submit your request. Please try again later or contact support directly."
    }
  }
};

const localesDir = './src/locales';

Object.entries(deleteAccountTranslations).forEach(([lang, content]) => {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const updatedContent = { ...fileContent, ...content };
    fs.writeFileSync(filePath, JSON.stringify(updatedContent, null, 2), 'utf8');
    console.log(`Updated ${lang}.json with deleteAccount keys`);
  } else {
    console.log(`File ${filePath} not found`);
  }
});
