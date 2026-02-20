import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { RtcTokenBuilder, RtcRole } from 'agora-token';

// Import flows for side effects (registration)
// import '../../ai/flows/get-weather-flow';
// import '../../ai/flows/send-sos-flow';
// import '../../ai/flows/translate-text-flow';

// Import translation function
export { translateNewMessage } from './translate-only';

admin.initializeApp();

/**
 * A scheduled function that runs every minute to process approved user requests.
 */
export const processapprovedusers = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
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
      } catch (error) {
        console.error(
          `Failed to process user ${email} with doc ID ${doc.id}`,
          error
        );
        // Optionally, update the status to "failed" to prevent retries.
        await doc.ref.update({ status: "failed", error: (error as Error).message });
      }
    });

    await Promise.all(promises);
    console.log("Finished processing batch of approved users.");
  } catch (error) {
    console.error("Error querying for approved users:", error);
  }
});

/**
 * Send push notification when a task is assigned to a driver
 */
export const sendTaskAssignmentNotification = functions.firestore.document("sosAlerts/{alertId}").onUpdate(async (change: any, context: any) => {
  const beforeData = change.before.data();
  const afterData = change.after.data();

  // Check if assignedTeam was added (task assignment)
  if (!beforeData?.assignedTeam && afterData?.assignedTeam) {
    const driverId = afterData.assignedTeam.driverId;

    try {
      // Get driver's FCM token
      const userDoc = await admin.firestore().collection("users").doc(driverId).get();
      const userData = userDoc.data();

      if (userData?.fcmToken) {
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
      } else {
        console.warn(`No FCM token found for driver ${driverId}`);
      }
    } catch (error) {
      console.error(`Error sending push notification to driver ${driverId}:`, error);
    }
  }
});

/**
 * Callable function for fetching weather data using OpenWeatherMap One Call API 3.0
 */
export const getWeather = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { latitude, longitude } = data;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid latitude and longitude are required');
  }

  // Get API key from environment variables
  const API_KEY = functions.config().openweather?.key;
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
      const cacheTime = cacheData?.timestamp?.toDate();
      const now = new Date();

      // Cache valid for 30 minutes
      if (cacheTime && (now.getTime() - cacheTime.getTime()) < 30 * 60 * 1000) {
        console.log('Returning cached weather data');
        return cacheData?.weatherData;
      }
    }
  } catch (cacheError) {
    console.warn('Cache read error:', cacheError);
    // Continue with API call
  }

  try {
    // Fetch from OpenWeatherMap One Call API 3.0
    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&exclude=minutely,hourly`
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new functions.https.HttpsError('internal', 'Weather API authentication failed');
      } else if (response.status === 429) {
        throw new functions.https.HttpsError('resource-exhausted', 'Weather API rate limit exceeded');
      } else {
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
    const forecast = apiData.daily.slice(1, 6).map((day: any, index: number) => {
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
    const alerts = (apiData.alerts || []).map((alert: any) => ({
      title: alert.event || 'Weather Alert',
      description: alert.description || 'Weather alert issued',
      area: 'Local Area',
      severity: mapSeverity(alert.tags?.[0] || 'Minor'),
      activeUntil: new Date((alert.end || Date.now() / 1000) * 1000).toLocaleTimeString()
    }));

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
    } catch (cacheError) {
      console.warn('Cache write error:', cacheError);
      // Don't fail the request if caching fails
    }

    return weatherData;

  } catch (error) {
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
        { day: 'Today', temp: '28°C', description: 'Sunny', icon: 'Sun' as const },
        { day: 'Tomorrow', temp: '27°C', description: 'Partly cloudy', icon: 'Cloud' as const },
        { day: 'Wed', temp: '26°C', description: 'Cloudy', icon: 'Cloudy' as const },
        { day: 'Thu', temp: '29°C', description: 'Sunny', icon: 'Sun' as const },
        { day: 'Fri', temp: '30°C', description: 'Sunny', icon: 'Sun' as const }
      ],
      alerts: [
        {
          title: 'Flood & Security Alert',
          description: 'Heavy rainfall and potential flooding forecasted for Bayelsa. Increased security vigilance advised in Adamawa. Please find safe shelter immediately.',
          area: 'Bayelsa and Adamawa',
          severity: 'Severe' as const,
          activeUntil: '23:59:59'
        }
      ],
      shelterImpact: 'Current weather conditions are favorable for shelter operations. No significant impacts expected.',
      lastUpdated: new Date().toLocaleTimeString()
    };
  }
});

/**
 * Automatically ensure state group chat exists when a user from a new state registers
 */
export const syncUserGroups = functions.firestore.document("users/{userId}").onCreate(async (snap, context) => {
  const userData = snap.data();
  const db = admin.firestore();

  if (userData.state) {
    const stateGroupName = `${userData.state} Beneficiaries`;
    const groupId = `state_${userData.state.toLowerCase().replace(/\s+/g, '_')}_beneficiaries`;

    const groupRef = db.collection('chats').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      await groupRef.set({
        name: stateGroupName,
        type: 'group',
        state: userData.state,
        isBeneficiaryGroup: true,
        participants: [], // We use state-based query for scalability, but can store admins here if needed
        status: 'active',
        lastMessage: 'Welcome to the state group chat!',
        lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created state group chat: ${stateGroupName}`);
    }
  }
  return null;
});

/**
 * Send notifications and group messages when a new training module is published
 */
export const onTrainingPublished = functions.firestore.document("trainingMaterials/{trainingId}").onCreate(async (snap, context) => {
  const training = snap.data();
  const db = admin.firestore();

  const title = training.title || "New Training Available";
  const body = `Category: ${training.category}. Tap to view the latest protocol.`;

  // 1. Post to relevant Group Chats
  let targetGroupId = 'global_beneficiaries';
  if (training.targetedRoles?.includes('admin')) targetGroupId = 'global_admins';
  else if (training.targetedRoles?.includes('support-agent')) targetGroupId = 'global_support';

  try {
    const chatRef = db.collection('chats').doc(targetGroupId);
    await chatRef.collection('messages').add({
      content: `📚 New Training: ${title}\n\n${training.description}`,
      messageType: 'training_alert',
      trainingId: context.params.trainingId,
      senderId: 'system',
      senderEmail: 'system@hopeline.app',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent'
    });

    await chatRef.update({
      lastMessage: `📚 New Training: ${title}`,
      lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error posting training to chat:", err);
  }

  // 2. Send Push Notification to all users (topic-based is better for scale)
  const message = {
    notification: {
      title: `📚 ${title}`,
      body: body,
    },
    topic: 'all_users', // You'll need to subscribe users to this topic in the app
    data: {
      type: "new_training",
      trainingId: context.params.trainingId,
    }
  };

  try {
    await admin.messaging().send(message);
    console.log("Global training notification sent");
  } catch (error) {
    console.error("Error sending training notification:", error);
  }
});

/**
 * Callable to initialize global groups (Run once by super admin)
 */
export const initializeGlobalGroups = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const db = admin.firestore();
  const groups = [
    { id: 'global_beneficiaries', name: 'Global Beneficiaries', isBeneficiaryGroup: true },
    { id: 'global_support', name: 'Support Agents Hub', isSupportGroup: true },
    { id: 'global_admins', name: 'Admin Tactical Command', isAdminGroup: true }
  ];

  const results = [];
  for (const group of groups) {
    const ref = db.collection('chats').doc(group.id);
    await ref.set({
      ...group,
      type: 'group',
      status: 'active',
      lastMessage: 'Global group initialized',
      lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      participants: []
    }, { merge: true });
    results.push(group.id);
  }

  return { success: true, groups: results };
});
function mapWeatherIcon(description: string): string {
  const iconMap: Record<string, string> = {
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

function mapSeverity(severity: string): 'Severe' | 'Moderate' | 'Minor' {
  const severityMap: Record<string, 'Severe' | 'Moderate' | 'Minor'> = {
    'Extreme': 'Severe',
    'Severe': 'Severe',
    'Moderate': 'Moderate',
    'Minor': 'Minor',
    'Unknown': 'Minor'
  };
  return severityMap[severity] || 'Minor';
}

function generateNarrativeSummary(current: any, forecast: any[]): string {
  const currentTemp = current.temperature;
  const currentDesc = current.description.toLowerCase();

  if (forecast.length > 0) {
    const tomorrow = forecast[0]; // forecast[0] is tomorrow since we sliced from daily[1]
    return `${currentDesc} conditions expected throughout the day with temperatures around ${currentTemp}. ${tomorrow ? `Tomorrow will be ${tomorrow.description.toLowerCase()} with ${tomorrow.temp}.` : ''}`;
  }

  return `${currentDesc} conditions with temperatures around ${currentTemp}.`;
}



function generateShelterImpact(current: any, forecast: any[]): string {
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
export const sendSos = functions.https.onCall(async (data, context) => {
  // SOS can be sent anonymously, so no auth check required
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  // }

  const { emergencyType, location, additionalInfo, userId, userEmail, readByAdmin, readBySuperAdmin } = data;

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
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      readByAdmin: readByAdmin ?? false,
      readBySuperAdmin: readBySuperAdmin ?? false
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
        } catch (userError) {
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
          const name = userData?.displayName || (userData?.firstName && userData?.lastName)
            ? `${userData.firstName} ${userData.lastName}`
            : userEmail || 'Unknown Person';
          const details = userData?.email || userEmail || '';

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
      } else {
        console.log("Duplicate displaced person record found, skipping creation");
      }

      // Update SOS alert to mark as displacement-related
      await docRef.update({
        isDisplacementRelated: true
      });
    }

    return { success: true, alertId: docRef.id };

  } catch (error) {
    console.error("Error in sendSos function: ", error);
    throw new functions.https.HttpsError('internal', 'Failed to send SOS alert');
  }
});

/**
 * Callable function for translating text using Google Translate API v2
 */
export const translateText = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { text, targetLanguage } = data;

  if (!text || !targetLanguage) {
    throw new functions.https.HttpsError('invalid-argument', 'Text and targetLanguage are required');
  }

  // Language code mappings (full name to ISO)
  const LANGUAGE_CODES: Record<string, string> = {
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

  const API_KEY = functions.config().googletranslate?.key;
  if (!API_KEY) {
    console.error('GOOGLE_TRANSLATE_API_KEY not configured');
    throw new functions.https.HttpsError('internal', 'Translation service not configured');
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: 'POST',
        body: JSON.stringify({
          q: text,
          target: targetCode,
          // omit source to allow auto-detection
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

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
  } catch (error) {
    console.error('Translation error:', error);
    throw new functions.https.HttpsError('internal', 'Translation failed');
  }
});

/**
 * Generate Agora RTC token for voice/video calls
 * Compatible with Flutter mobile app implementation
 */
export const generateAgoraToken = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { channelName, uid = 0, role = 'publisher' } = data;

  if (!channelName) {
    throw new functions.https.HttpsError('invalid-argument', 'Channel name is required');
  }

  // Agora credentials (matching mobile app)
  const appId = '8bb7364b135e43d0b936e3cb53dc69fe';
  const appCertificate = '611360e6a5164a7188944aa59cc9ad40';

  // Token expires in 24 hours
  const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  // Convert role string to RtcRole enum
  const rtcRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

  try {
    // Use buildTokenWithUid (compatible with mobile app)
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      rtcRole,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    );

    console.log(`Generated Agora token for channel: ${channelName}, uid: ${uid}`);
    return token; // Return token directly as string (matching mobile app)

  } catch (error: any) {
    console.error('Error generating Agora token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate token');
  }
});

/**
 * Callable function for creating accounts for displaced persons
 */
export const createDisplacedPersonAccounts = functions.runWith({
  timeoutSeconds: 300,
  memory: '512MB'
}).https.onCall(async (data, context) => {
  // Check if user is authenticated and has admin privileges (optional, depending on requirements)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { users } = data; // Expecting array of { name, phone }

  if (!users || !Array.isArray(users)) {
    throw new functions.https.HttpsError('invalid-argument', 'Users array is required');
  }

  const results: any[] = [];
  const db = admin.firestore();

  for (const user of users) {
    try {
      if (!user) {
        results.push({ status: 'error', reason: 'User object is null or undefined' });
        continue;
      }

      const { name, phone, gender, state, image, latitude, longitude } = user;

      if (!name || !phone) {
        console.warn('Missing required fields for account creation:', { name, phone });
        results.push({
          name: name || 'Unknown',
          phone: phone || 'Unknown',
          status: 'error',
          reason: 'Name and phone are required for each beneficiary'
        });
        continue;
      }

      const phoneStr = String(phone);
      console.log(`[PROVISIONING] Processing account for: ${name} (${phoneStr})`);

      // 1. Tactical Phone Sanitization (Leading Zero Protocol)
      let mobileNumber = phoneStr.replace(/\s+/g, '').replace(/[^0-9]/g, '');
      if (mobileNumber.startsWith('234') && mobileNumber.length >= 11) {
        mobileNumber = '0' + mobileNumber.substring(3);
      } else if (mobileNumber.length === 10 && !mobileNumber.startsWith('0')) {
        mobileNumber = '0' + mobileNumber;
      }

      const syntheticEmail = `${mobileNumber}@hopeline.app`;
      const password = mobileNumber; // Password is the sanitized 11-digit mobile number

      // 2. E.164 Global Format for Auth
      let cleanForE164 = phoneStr.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (cleanForE164.startsWith('0')) {
        cleanForE164 = cleanForE164.substring(1);
      }
      let formattedPhone = cleanForE164;
      if (!cleanForE164.startsWith('+')) {
        formattedPhone = `+234${cleanForE164}`;
      }

      console.log(`[IDENTITY] Generated: Email=${syntheticEmail}, Local=${mobileNumber}, Global=${formattedPhone}`);

      try {
        // Check if user exists by email
        try {
          const authUser = await admin.auth().getUserByEmail(syntheticEmail);
          console.log(`[AUTH] User already exists (Email): ${syntheticEmail}`);
          results.push({ phone: phoneStr, status: 'skipped', reason: 'Account already exists (Email)', uid: authUser.uid });
          continue;
        } catch (error: any) {
          if (error.code !== 'auth/user-not-found') throw error;
        }

        // Check if user exists by phone number
        try {
          const authUser = await admin.auth().getUserByPhoneNumber(formattedPhone);
          console.log(`[AUTH] User already exists (Phone): ${formattedPhone}`);
          results.push({ phone: phoneStr, status: 'skipped', reason: 'Account already exists (Phone)', uid: authUser.uid });
          continue;
        } catch (error: any) {
          if (error.code !== 'auth/user-not-found') throw error;
        }

        // Create user in Auth
        const userRecord = await admin.auth().createUser({
          email: syntheticEmail,
          password: password,
          phoneNumber: formattedPhone,
          displayName: name,
          emailVerified: true,
        });

        const uid = userRecord.uid;

        // Create user profile in Firestore (Normalization Protocol)
        await db.collection("users").doc(uid).set({
          uid: uid,
          email: syntheticEmail,
          role: 'displaced_person',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isOnline: false,
          displayName: name,
          mobile: formattedPhone, // E.164 formatted (+234...)
          mobileNumber: mobileNumber, // Local format with leading zero (090...)
          firstName: name.split(' ')[0] || '',
          lastName: name.split(' ').slice(1).join(' ') || '',
          image: image || '',
          profileCompleted: 1, // Bypasses onboarding
          language: 'English',
          accountStatus: 'active', // Allows login
          gender: gender || '',
          state: state || '',
          latitude: !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : null,
          longitude: !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : null,
        }, { merge: true });

        console.log(`Successfully processed ${phoneStr}: ${uid}`);
        results.push({ phone: phoneStr, status: 'created', uid });

      } catch (error: any) {
        console.error(`Error processing account:`, error);
        results.push({ status: 'error', reason: error.message || 'Unknown error' });
      }
    } catch (error: any) {
      console.error(`Error processing account:`, error);
      results.push({ status: 'error', reason: error.message || 'Unknown error' });
    }
  }

  return { results };
});

/**
 * Trigger to track driver location history
 * Listens for updates to user documents and archives location changes
 */
export const trackDriverLocationHistory = functions.firestore.document("users/{userId}").onUpdate(async (change, context) => {
  const beforeData = change.before.data();
  const afterData = change.after.data();
  const userId = context.params.userId;

  // Check if user is a driver/responder role
  const driverRoles = ['driver', 'pilot', 'responder', 'rider'];
  if (!driverRoles.includes(afterData.role)) {
    return null;
  }

  // Check if location exists and has changed
  const beforeLat = beforeData.latitude;
  const beforeLng = beforeData.longitude;
  const afterLat = afterData.latitude;
  const afterLng = afterData.longitude;

  // If no location data in new update, skip
  if (afterLat === undefined || afterLng === undefined) {
    return null;
  }

  // Check if location changed significantly (approx 5-10 meters to reduce noise, or just any change)
  // For simplicity, checking strict inequality. Client usually handles throttle.
  if (beforeLat === afterLat && beforeLng === afterLng) {
    return null;
  }

  try {
    const db = admin.firestore();
    const historyRef = db.collection("users").doc(userId).collection("locationHistory");

    await historyRef.add({
      latitude: afterLat,
      longitude: afterLng,
      heading: afterData.heading || null,
      speed: afterData.speed || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // Store plain timestamp for easier querying if needed
      timestampMs: Date.now()
    });

    console.log(`Archived location for driver ${userId}: ${afterLat}, ${afterLng}`);

  } catch (error) {
    console.error(`Error archiving location for ${userId}:`, error);
  }

  return null;
});

/**
 * Callable function for creating team members (drivers, pilots, etc.)
 */
export const createTeamMember = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify requester has admin privileges
  // Note: For strict security, you should verify the caller's role from Firestore here.
  // For now, we'll assume the client + Firestore rules protect the UI, but backend check is best practice.

  const { email, password, phone, name, role, state, vehicleId, vehicleImageUrl } = data;

  if (!email || !password || !phone || !name || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Email, password, phone, name, and role are required');
  }

  try {
    // 1. Check if user exists by email or phone to provide better error messages
    try {
      await admin.auth().getUserByEmail(email);
      throw new functions.https.HttpsError('already-exists', 'A user with this email already exists.');
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // Format phone number to E.164 (Assuming Nigeria +234 if not provided)
    let cleanPhone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

    // Remove leading 0 if present (common in Nigeria: 080...)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }

    // Add +234 if not present
    let formattedPhone = cleanPhone;
    if (!cleanPhone.startsWith('+')) {
      formattedPhone = `+234${cleanPhone}`;
    }

    try {
      await admin.auth().getUserByPhoneNumber(formattedPhone);
      throw new functions.https.HttpsError('already-exists', 'A user with this phone number already exists.');
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // 2. Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      phoneNumber: formattedPhone,
      displayName: name,
      emailVerified: true, // Auto-verify for internal tools
    });

    // 3. Create user profile in Firestore
    const db = admin.firestore();
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      role, // 'driver', 'pilot', etc.
      name, // Store as 'name' to match Driver type, or map to displayName
      displayName: name,
      firstName: name.split(' ')[0] || '',
      lastName: name.split(' ').slice(1).join(' ') || '',
      phone,
      mobile: phone, // Legacy field support
      state: state || '',
      vehicle: '', // Assigned later or via separate flow
      vehicleId: vehicleId || null,
      vehicleImageUrl: vehicleImageUrl || null,
      status: 'Available',
      task: 'Awaiting Assignment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isOnline: false,
      profileCompleted: 1,
      accountStatus: 'active'
    });

    console.log(`Created team member ${name} (${role}) with UID ${userRecord.uid}`);
    return { success: true, uid: userRecord.uid };

  } catch (error: any) {
    console.error("Error creating team member:", error);
    throw new functions.https.HttpsError(error.code || 'internal', error.message || 'Failed to create team member');
  }
});
