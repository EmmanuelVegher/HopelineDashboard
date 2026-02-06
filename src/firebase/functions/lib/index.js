"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAgoraToken = exports.translateText = exports.sendSos = exports.getWeather = exports.sendTaskAssignmentNotification = exports.processapprovedusers = exports.translateNewMessage = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const agora_token_1 = require("agora-token");
// Import flows for side effects (registration)
// import '../../ai/flows/get-weather-flow';
// import '../../ai/flows/send-sos-flow';
// import '../../ai/flows/translate-text-flow';
// Import translation function
var translate_only_1 = require("./translate-only");
Object.defineProperty(exports, "translateNewMessage", { enumerable: true, get: function () { return translate_only_1.translateNewMessage; } });
admin.initializeApp();
/**
 * A scheduled function that runs every minute to process approved user requests.
 */
exports.processapprovedusers = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
    console.log("Checking for approved users...");
    const db = admin.firestore();
    const pendingUsersRef = db.collection("pendingUsers");
    try {
        // Get all user requests that have been approved.
        const snapshot = await pendingUsersRef.where("status", "==", "approved")
            .get();
        if (snapshot.empty) {
            console.log("No approved users to process.");
            return;
        }
        const promises = snapshot.docs.map(async (doc) => {
            const pendingUser = doc.data();
            const { email, role, language } = pendingUser;
            try {
                // 1. Create the user in Firebase Authentication.
                // The user will need to use the "Forgot Password" flow to set their
                // password for the first time.
                console.log(`Creating user in Auth for: ${email}`);
                const userRecord = await admin.auth().createUser({
                    email: email,
                    emailVerified: true, // Assuming admin approval is sufficient.
                });
                const uid = userRecord.uid;
                console.log(`Successfully created user ${email} with uid ${uid}`);
                // 2. Create the user profile in the 'users' collection in Firestore.
                console.log(`Creating user profile in Firestore for uid: ${uid}`);
                const userDocRef = db.collection("users").doc(uid);
                await userDocRef.set({
                    uid: uid,
                    email: email,
                    role: role,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isOnline: false,
                    displayName: email.split('@')[0] || 'New Staff',
                    firstName: '',
                    lastName: '',
                    gender: '',
                    image: '',
                    mobile: 0,
                    profileCompleted: 0,
                    language: language || 'English', // Default to English if not provided
                });
                console.log(`Successfully created Firestore profile for ${email}`);
                // 3. Delete the request from the 'pendingUsers' collection.
                console.log(`Deleting pending request for ${email}`);
                await doc.ref.delete();
                console.log(`Successfully processed and deleted request for ${email}`);
            }
            catch (error) {
                console.error(`Failed to process user ${email} with doc ID ${doc.id}`, error);
                // Optionally, update the status to "failed" to prevent retries.
                await doc.ref.update({ status: "failed", error: error.message });
            }
        });
        await Promise.all(promises);
        console.log("Finished processing batch of approved users.");
    }
    catch (error) {
        console.error("Error querying for approved users:", error);
    }
});
/**
 * Send push notification when a task is assigned to a driver
 */
exports.sendTaskAssignmentNotification = functions.firestore.document("sosAlerts/{alertId}").onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    // Check if assignedTeam was added (task assignment)
    if (!(beforeData === null || beforeData === void 0 ? void 0 : beforeData.assignedTeam) && (afterData === null || afterData === void 0 ? void 0 : afterData.assignedTeam)) {
        const driverId = afterData.assignedTeam.driverId;
        try {
            // Get driver's FCM token
            const userDoc = await admin.firestore().collection("users").doc(driverId).get();
            const userData = userDoc.data();
            if (userData === null || userData === void 0 ? void 0 : userData.fcmToken) {
                const message = {
                    notification: {
                        title: "🚨 New Emergency Task Assigned",
                        body: `Respond to ${afterData.emergencyType} at ${afterData.location.address || 'specified location'}`,
                    },
                    data: {
                        alertId: context.params.alertId,
                        type: "task_assigned",
                        emergencyType: afterData.emergencyType,
                        location: JSON.stringify(afterData.location),
                    },
                    token: userData.fcmToken,
                };
                await admin.messaging().send(message);
                console.log(`Push notification sent to driver ${driverId} for task assignment`);
            }
            else {
                console.warn(`No FCM token found for driver ${driverId}`);
            }
        }
        catch (error) {
            console.error(`Error sending push notification to driver ${driverId}:`, error);
        }
    }
});
/**
 * Callable function for fetching weather data using OpenWeatherMap One Call API 3.0
 */
exports.getWeather = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { latitude, longitude } = data;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid latitude and longitude are required');
    }
    // Get API key from environment variables
    const API_KEY = (_a = functions.config().openweather) === null || _a === void 0 ? void 0 : _a.key;
    if (!API_KEY) {
        console.error('OPENWEATHER_API_KEY not configured');
        throw new functions.https.HttpsError('internal', 'Weather service not configured');
    }
    // Check cache first (valid for 30 minutes)
    const db = admin.firestore();
    const cacheKey = `weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
    const cacheRef = db.collection('weatherCache').doc(cacheKey);
    try {
        const cacheDoc = await cacheRef.get();
        if (cacheDoc.exists) {
            const cacheData = cacheDoc.data();
            const cacheTime = (_b = cacheData === null || cacheData === void 0 ? void 0 : cacheData.timestamp) === null || _b === void 0 ? void 0 : _b.toDate();
            const now = new Date();
            // Cache valid for 30 minutes
            if (cacheTime && (now.getTime() - cacheTime.getTime()) < 30 * 60 * 1000) {
                console.log('Returning cached weather data');
                return cacheData === null || cacheData === void 0 ? void 0 : cacheData.weatherData;
            }
        }
    }
    catch (cacheError) {
        console.warn('Cache read error:', cacheError);
        // Continue with API call
    }
    try {
        // Fetch from OpenWeatherMap One Call API 3.0
        const response = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&exclude=minutely,hourly`);
        if (!response.ok) {
            if (response.status === 401) {
                throw new functions.https.HttpsError('internal', 'Weather API authentication failed');
            }
            else if (response.status === 429) {
                throw new functions.https.HttpsError('resource-exhausted', 'Weather API rate limit exceeded');
            }
            else {
                throw new functions.https.HttpsError('internal', 'Weather API request failed');
            }
        }
        const apiData = await response.json();
        // Process current conditions
        const current = apiData.current;
        const currentConditions = {
            temperature: `${Math.round(current.temp)}°C`,
            description: current.weather[0].main,
            humidity: `${current.humidity}%`,
            windSpeed: `${Math.round(current.wind_speed * 3.6)} km/h`,
            visibility: '10 km', // One Call API doesn't provide visibility in basic response
            uvIndex: current.uvi ? current.uvi.toString() : 'N/A'
        };
        // Process forecast (next 5 days from daily array)
        const forecast = apiData.daily.slice(1, 6).map((day, index) => {
            const date = new Date(day.dt * 1000);
            const dayName = index === 0 ? 'Tomorrow' :
                date.toLocaleDateString('en-US', { weekday: 'short' });
            return {
                day: dayName,
                temp: `${Math.round(day.temp.day)}°C`,
                description: day.weather[0].main,
                icon: mapWeatherIcon(day.weather[0].main)
            };
        });
        // Generate narrative summary
        const narrativeSummary = generateNarrativeSummary(currentConditions, forecast);
        // Process real alerts from One Call API
        const alerts = (apiData.alerts || []).map((alert) => {
            var _a;
            return ({
                title: alert.event || 'Weather Alert',
                description: alert.description || 'Weather alert issued',
                area: 'Local Area',
                severity: mapSeverity(((_a = alert.tags) === null || _a === void 0 ? void 0 : _a[0]) || 'Minor'),
                activeUntil: new Date((alert.end || Date.now() / 1000) * 1000).toLocaleTimeString()
            });
        });
        // Add generated alerts if no real alerts
        if (alerts.length === 0) {
            alerts.push(...generateMockAlerts(currentConditions, forecast));
        }
        const weatherData = {
            narrativeSummary,
            currentConditions,
            forecast,
            alerts,
            shelterImpact: generateShelterImpact(currentConditions, forecast),
            lastUpdated: new Date().toLocaleTimeString()
        };
        // Cache the result
        try {
            await cacheRef.set({
                weatherData,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('Weather data cached successfully');
        }
        catch (cacheError) {
            console.warn('Cache write error:', cacheError);
            // Don't fail the request if caching fails
        }
        return weatherData;
    }
    catch (error) {
        console.error('Weather API error:', error);
        // Return fallback mock data
        return {
            narrativeSummary: 'Weather information temporarily unavailable. Please check again later.',
            currentConditions: {
                temperature: '28°C',
                description: 'Sunny',
                humidity: '65%',
                windSpeed: '12 km/h',
                visibility: '10 km',
                uvIndex: '7'
            },
            forecast: [
                { day: 'Today', temp: '28°C', description: 'Sunny', icon: 'Sun' },
                { day: 'Tomorrow', temp: '27°C', description: 'Partly cloudy', icon: 'Cloud' },
                { day: 'Wed', temp: '26°C', description: 'Cloudy', icon: 'Cloudy' },
                { day: 'Thu', temp: '29°C', description: 'Sunny', icon: 'Sun' },
                { day: 'Fri', temp: '30°C', description: 'Sunny', icon: 'Sun' }
            ],
            alerts: [
                {
                    title: 'Flood & Security Alert',
                    description: 'Heavy rainfall and potential flooding forecasted for Bayelsa. Increased security vigilance advised in Adamawa. Please find safe shelter immediately.',
                    area: 'Bayelsa and Adamawa',
                    severity: 'Severe',
                    activeUntil: '23:59:59'
                }
            ],
            shelterImpact: 'Current weather conditions are favorable for shelter operations. No significant impacts expected.',
            lastUpdated: new Date().toLocaleTimeString()
        };
    }
});
// Helper functions
function mapWeatherIcon(description) {
    const iconMap = {
        'Sunny': 'Sun',
        'Clear': 'Sun',
        'Partly cloudy': 'Cloud',
        'Cloudy': 'Cloudy',
        'Overcast': 'Cloudy',
        'Light rain': 'CloudDrizzle',
        'Moderate rain': 'CloudRain',
        'Heavy rain': 'CloudRain',
        'Thunderstorm': 'CloudLightning',
        'Snow': 'CloudSnow',
        'Mist': 'CloudFog',
        'Fog': 'CloudFog'
    };
    return iconMap[description] || 'Cloud';
}
function mapSeverity(severity) {
    const severityMap = {
        'Extreme': 'Severe',
        'Severe': 'Severe',
        'Moderate': 'Moderate',
        'Minor': 'Minor',
        'Unknown': 'Minor'
    };
    return severityMap[severity] || 'Minor';
}
function generateNarrativeSummary(current, forecast) {
    const currentTemp = current.temperature;
    const currentDesc = current.description.toLowerCase();
    if (forecast.length > 0) {
        const tomorrow = forecast[0]; // forecast[0] is tomorrow since we sliced from daily[1]
        return `${currentDesc} conditions expected throughout the day with temperatures around ${currentTemp}. ${tomorrow ? `Tomorrow will be ${tomorrow.description.toLowerCase()} with ${tomorrow.temp}.` : ''}`;
    }
    return `${currentDesc} conditions with temperatures around ${currentTemp}.`;
}
function generateMockAlerts(current, forecast) {
    const alerts = [];
    // Check for rain in forecast
    const hasRain = forecast.some(day => ['Rain', 'Drizzle', 'Thunderstorm'].includes(day.description));
    if (hasRain) {
        alerts.push({
            title: 'Weather Alert',
            description: 'Rainfall expected in the coming days. Please stay informed about local weather conditions and prepare accordingly.',
            area: 'Local Area',
            severity: 'Moderate',
            activeUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleTimeString()
        });
    }
    // High temperature alert
    const highTemp = forecast.some(day => parseInt(day.temp) > 35);
    if (highTemp) {
        alerts.push({
            title: 'Heat Advisory',
            description: 'High temperatures expected. Stay hydrated and avoid prolonged sun exposure.',
            area: 'Local Area',
            severity: 'Minor',
            activeUntil: new Date(Date.now() + 12 * 60 * 60 * 1000).toLocaleTimeString()
        });
    }
    return alerts;
}
function generateShelterImpact(current, forecast) {
    const hasSevereWeather = ['Rain', 'Thunderstorm', 'Snow'].includes(current.description) ||
        forecast.some(day => ['Rain', 'Thunderstorm', 'Snow'].includes(day.description));
    if (hasSevereWeather) {
        return 'Weather conditions may impact shelter accessibility. Monitor local alerts and follow safety guidelines.';
    }
    return 'Current weather conditions are favorable for shelter operations. No significant impacts expected.';
}
/**
 * Callable function for sending SOS alerts
 */
exports.sendSos = functions.https.onCall(async (data, context) => {
    // SOS can be sent anonymously, so no auth check required
    // if (!context.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    // }
    const { emergencyType, location, additionalInfo, userId, userEmail } = data;
    if (!emergencyType || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'emergencyType and valid location are required');
    }
    const db = admin.firestore();
    try {
        const sosAlertsRef = db.collection('sosAlerts');
        const docRef = await sosAlertsRef.add({
            emergencyType,
            location,
            additionalInfo: additionalInfo || '',
            userId: userId || null,
            userEmail: userEmail || null,
            status: 'Active',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("SOS Alert saved with ID: ", docRef.id);
        // Check if this is a displacement-related emergency
        const DISPLACEMENT_EMERGENCY_TYPES = [
            'flood', 'earthquake', 'hurricane', 'tornado', 'tsunami',
            'volcanic eruption', 'war', 'conflict', 'evacuation', 'disaster',
            'fire', 'landslide', 'mudslide'
        ];
        if (DISPLACEMENT_EMERGENCY_TYPES.includes(emergencyType.toLowerCase())) {
            console.log("Displacement emergency detected, checking for existing displaced person record");
            // Fetch user data if userId is provided
            let userData = null;
            if (userId) {
                try {
                    const userDoc = await db.collection('users').doc(userId).get();
                    if (userDoc.exists) {
                        userData = userDoc.data();
                        console.log("User data fetched:", userData);
                    }
                }
                catch (userError) {
                    console.warn("Could not fetch user data:", userError);
                }
            }
            // Check for existing displaced person record
            const displacedPersonsRef = db.collection('displacedPersons');
            let existingQuery = null;
            if (userId) {
                existingQuery = displacedPersonsRef.where('userId', '==', userId);
            }
            let existingDocs = null;
            if (existingQuery) {
                existingDocs = await existingQuery.get();
            }
            if (!existingDocs || existingDocs.empty) {
                if (userId) {
                    const name = (userData === null || userData === void 0 ? void 0 : userData.displayName) || ((userData === null || userData === void 0 ? void 0 : userData.firstName) && (userData === null || userData === void 0 ? void 0 : userData.lastName))
                        ? `${userData.firstName} ${userData.lastName}`
                        : userEmail || 'Unknown Person';
                    const details = (userData === null || userData === void 0 ? void 0 : userData.email) || userEmail || '';
                    const displacedPersonData = {
                        name,
                        details,
                        userId,
                        status: 'Emergency',
                        currentLocation: location.address || `${location.latitude}, ${location.longitude}`,
                        destination: '',
                        vulnerabilities: [],
                        medicalNeeds: [],
                        assistanceRequested: additionalInfo || `Displacement emergency: ${emergencyType}`,
                        priority: 'High Priority',
                        lastUpdate: new Date().toLocaleString(),
                    };
                    await displacedPersonsRef.add(displacedPersonData);
                    console.log("Displaced person record created");
                }
            }
            else {
                console.log("Duplicate displaced person record found, skipping creation");
            }
            // Update SOS alert to mark as displacement-related
            await docRef.update({
                isDisplacementRelated: true
            });
        }
        return { success: true, alertId: docRef.id };
    }
    catch (error) {
        console.error("Error in sendSos function: ", error);
        throw new functions.https.HttpsError('internal', 'Failed to send SOS alert');
    }
});
/**
 * Callable function for translating text using Google Translate API v2
 */
exports.translateText = functions.https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { text, targetLanguage } = data;
    if (!text || !targetLanguage) {
        throw new functions.https.HttpsError('invalid-argument', 'Text and targetLanguage are required');
    }
    // Language code mappings (full name to ISO)
    const LANGUAGE_CODES = {
        'English': 'en',
        'Yoruba': 'yo',
        'Hausa': 'ha',
        'Igbo': 'ig',
        'Tiv': 'tiv',
        'Kanuri': 'kr',
        'en': 'en',
        'yo': 'yo',
        'ha': 'ha',
        'ig': 'ig',
        'tiv': 'tiv',
        'kr': 'kr',
    };
    const sourceCode = 'en'; // Assuming source is always English
    const targetCode = LANGUAGE_CODES[targetLanguage] || targetLanguage;
    // If same language, return original text
    if (sourceCode === targetCode) {
        return { translatedText: text };
    }
    const API_KEY = (_a = functions.config().googletranslate) === null || _a === void 0 ? void 0 : _a.key;
    if (!API_KEY) {
        console.error('GOOGLE_TRANSLATE_API_KEY not configured');
        throw new functions.https.HttpsError('internal', 'Translation service not configured');
    }
    try {
        const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({
                q: text,
                target: targetCode,
                // omit source to allow auto-detection
            }),
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Google Translate API error:', response.status, errorData);
            throw new functions.https.HttpsError('internal', 'Translation API error');
        }
        const data = await response.json();
        if (data.error) {
            console.error('Google Translate API error:', data.error);
            throw new functions.https.HttpsError('internal', 'Translation failed');
        }
        const translatedText = data.data.translations[0].translatedText;
        return { translatedText };
    }
    catch (error) {
        console.error('Translation error:', error);
        throw new functions.https.HttpsError('internal', 'Translation failed');
    }
});
/**
 * Callable function for generating Agora RTC tokens
 */
exports.generateAgoraToken = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { channelName, uid, role = 'publisher' } = data;
    if (!channelName || uid === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'channelName and uid are required');
    }
    const appId = '8bb7364b135e43d0b936e3cb53dc69fe';
    const appCertificate = '611360e6a5164a7188944aa59cc9ad40';
    // Convert role string to RtcRole enum
    const rtcRole = role === 'publisher' ? agora_token_1.RtcRole.PUBLISHER : agora_token_1.RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600; // 1 hour validity
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    try {
        const token = agora_token_1.RtcTokenBuilder.buildTokenWithUserAccount(appId, appCertificate, channelName, uid.toString(), rtcRole, privilegeExpiredTs, 0 // salt
        );
        return { token };
    }
    catch (error) {
        console.error('Error generating Agora token:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate token');
    }
});
//# sourceMappingURL=index.js.map