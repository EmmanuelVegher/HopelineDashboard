const fs = require('fs');

const enPath = '/Users/mac/hopelineWeb/src/locales/en.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

en.admin.contactManagement = {
    "title": "Contact Numbers Management",
    "subtitle": "Add, edit, or delete USSD codes and emergency numbers that are displayed on user-facing pages.",
    "addNew": "Add New Number",
    "table": {
        "heads": {
            "serviceName": "Service Name",
            "numberCode": "Number / Code",
            "state": "State",
            "actions": "Actions"
        },
        "noContacts": "No contact numbers found.",
        "nationwide": "Nationwide"
    },
    "form": {
        "addTitle": "Add New Contact Number",
        "editTitle": "Edit Contact Number",
        "addDesc": "Add a new USSD code or emergency number.",
        "editDesc": "Update the details for this contact.",
        "serviceName": "Service Name",
        "servicePlaceholder": "e.g., Emergency SOS or Police",
        "numberCode": "Number or Code",
        "numberPlaceholder": "e.g., *347*100# or 112",
        "state": "State",
        "statePlaceholder": "Select State (Optional)",
        "allStates": "All States (Nationwide)",
        "adminLocked": "Admin locked to assigned state.",
        "save": "Save Number",
        "saving": "Saving...",
        "cancel": "Cancel"
    },
    "toasts": {
        "missingFields": "Missing Fields",
        "missingFieldsDesc": "Please provide both a name and a number/code.",
        "success": "Success",
        "updated": "Contact number updated successfully.",
        "added": "Contact number added successfully.",
        "deleted": "Contact number deleted.",
        "error": "Error",
        "saveError": "Could not save the contact number.",
        "deleteError": "Could not delete the number."
    },
    "deleteConfirm": "Are you sure you want to delete this contact number?",
    "permissionError": {
        "title": "Permission Denied",
        "description": "You do not have permission to manage contact numbers. Please check your Firestore security rules."
    }
};

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log('en.json updated with contactManagement keys.');
