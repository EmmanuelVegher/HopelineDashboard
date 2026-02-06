# Master Prompt for Admin and Support Agent Pages - Flutter Mobile App Development

## Overview
This document provides a comprehensive specification for building Flutter mobile app modules that replicate the web-based admin and support agent dashboard functionality. The app should maintain the same user experience, data flow, and functionality as the existing web application.

## Firestore Collections and Data Structure

### Core Collections Used:
1. **sosAlerts** - Emergency SOS alerts with location, user info, status, assigned teams
2. **users** - User profiles with roles (admin, support agent, driver, user), contact info, settings
3. **chats** - Support chat sessions with messages subcollection
4. **calls** - Voice/video call records and active sessions
5. **shelters** - Shelter information with capacity, location, status
6. **displacedPersons** - Records of displaced individuals in shelters
7. **drivers** - Driver profiles with vehicle info, location, status
8. **vehicles** - Vehicle management data
9. **ussdCodes** - USSD emergency codes
10. **location_requests** - Location sharing requests from users
11. **emergency_locations** - Emergency location data
12. **notifications** - System notifications

### Key Data Paths:
- `/sosAlerts/{alertId}` - Individual SOS alerts
- `/users/{userId}` - User profiles
- `/chats/{chatId}` - Chat sessions
- `/chats/{chatId}/messages/{messageId}` - Individual messages
- `/calls/{callId}` - Call records
- `/shelters/{shelterId}` - Shelter data
- `/displacedPersons/{personId}` - Displaced person records
- `/drivers/{driverId}` - Driver data
- `/vehicles/{vehicleId}` - Vehicle data
- `/notifications/{notificationId}` - Notifications

---

## ADMIN MODULE SPECIFICATIONS

### 1. Admin Dashboard (`/admin`)
**Path:** `src/app/admin/page.tsx`

#### UI Components:
- **Header Section:**
  - Title: "Emergency Response Dashboard"
  - Subtitle: "CARITAS Nigeria | CITI Foundation Project"
  - Refresh button with spinning icon when loading

#### Stats Grid (4 cards):
1. **Active Alerts Card:**
   - Red gradient background (from-red-50 to-orange-50)
   - AlertTriangle icon
   - Shows count of alerts with status 'Active'
   - "from last hour" text

2. **People Assisted Card:**
   - Blue gradient background (from-blue-50 to-cyan-50)
   - Users icon
   - Shows total occupied shelter capacity
   - "Total individuals in shelters" text

3. **Shelter Occupancy Card:**
   - Green gradient background (from-green-50 to-emerald-50)
   - Shield icon
   - Shows occupancy percentage
   - "occupied/capacity capacity" text

4. **Avg Response Time Card:**
   - Purple gradient background (from-purple-50 to-pink-50)
   - Clock icon
   - Shows "12.5 min" (static)
   - "-1.2 min from yesterday" text

#### Main Content Tabs:
1. **Active Alerts Tab:**
   - Card with "Emergency SOS Alerts" title
   - "Active emergency situations requiring immediate attention" description
   - List of recent alerts (max 5) with:
     - Emergency type badge (secondary variant)
     - High Priority badge (destructive)
     - Alert ID (shortened, monospace)
     - Location address
     - User email (or 'Anonymous')
     - Additional info (if present, in yellow background)
     - Assigned team info (if present, in blue background)
     - Action buttons: "View Details", "Assign Team", "Mark Responding/Resolved"

2. **Shelter Status Tab:**
   - Card with "Shelter Capacity Management" title
   - "View detailed capacity information and manage shelter spaces" description
   - Table with columns: Shelter, Status, Occupied, Available, Total, Occupancy, Actions
   - Progress bars for occupancy percentage
   - "Manage" button linking to `/admin/track-shelter`

3. **Driver Tracking Tab:**
   - Card with "Driver Tracking" title
   - Description with link to full tracking page
   - Driver selection dropdown
   - Interactive map component showing selected driver

4. **Analytics Tab:**
   - Card with "Operational Analytics" title
   - "Visualizing key metrics for better decision-making" description
   - 4 charts: Alerts Over Time, Shelter Occupancy, Emergency Types, Displaced Persons Status

#### Dialogs:
- **Alert Details Dialog:** Shows full alert information with user, location, time, additional info, assigned team
- **Assign Driver Dialog:** Lists available drivers with assign buttons

### 2. User Management (`/admin/user-management`)
**Path:** `src/app/admin/user-management/page.tsx`

#### UI Components:
- **Header:** "User Management" title, "View and manage all registered users" description
- **Responsive Layout:** Cards on mobile, table on desktop

#### User Data Display:
- **Card View (Mobile):**
  - User name, email, role badge with icon, status badge
  - Phone number with phone icon
  - Profile completion progress bar with percentage

- **Table View (Desktop):**
  - Columns: Name, Email, Role (with icon), Status, Phone, Profile Completion
  - Role badges: Admin (red), Support Agent (blue), others (gray)
  - Status badges: Active (secondary), Inactive (outline)
  - Progress bars: Green (>80%), Yellow (50-80%), Red (<50%)

#### Features:
- Permission error handling with alert
- Dummy data fallback for testing
- Responsive design with proper spacing

---

## SUPPORT AGENT MODULE SPECIFICATIONS

### 1. Support Agent Dashboard (`/support-agent`)
**Path:** `src/app/support-agent/page.tsx`

#### UI Components:
- **Header Section:**
  - Large icon (MessageSquare) in blue-cyan gradient circle
  - Title: "Support Agent Dashboard"
  - Subtitle: "Manage active chats, voice calls, and provide assistance to users in need"
  - Location badge showing agent's serving area

#### Stats Overview (4 cards):
1. **Active Chats Card:**
   - Primary color background
   - MessageSquare icon
   - Shows count of active chats assigned to agent

2. **Active Calls Card:**
   - Green background
   - Phone icon
   - Shows count of active calls

3. **Online Users Card:**
   - Purple background
   - Users icon
   - Shows online users in agent's state

4. **Languages Card:**
   - Orange background
   - Globe icon
   - Shows "5" (static count)

#### Active Chat Sessions Section:
- **Card Layout:** "Active Chat Sessions" title, "Users currently waiting for chat support" description
- **Empty State:** MessageSquare icon, "No active chat sessions assigned to you" text
- **Chat Items:**
  - User avatar with fallback to first letter
  - User name, last message (truncated)
  - Language badge with Globe icon
  - Location badge with MapPin icon (if available)
  - Unread count badge (destructive variant)
  - "Join Chat" button

#### Active Voice Calls Section:
- **Card Layout:** "Active Voice Calls" title, "Voice calls requiring immediate attention" description
- **Empty State:** Phone icon, "No active voice calls assigned to you" text
- **Call Items:**
  - User avatar with fallback
  - User name
  - Status badge (Ringing=destructive, Active=default)
  - Language badge, Location badge (if available)
  - Call start time (if active)
  - "Answer Call" or "Join Call" button

#### Quick Actions (4 buttons):
1. **View All Chats:** MessageSquare icon, "Chat History" subtitle, navigates to `/support-agent/chats`
2. **Voice Calls:** Phone icon, "Call Management" subtitle, navigates to `/support-agent/calls`
3. **Location Assist:** MapPin icon, "Map Support" subtitle, navigates to `/support-agent/map`
4. **Availability:** Clock icon, "Set Status" subtitle, navigates to `/support-agent/settings`

### 2. Chat Sessions Page (`/support-agent/chats`)
**Path:** `src/app/support-agent/chats/page.tsx`

#### UI Components:
- **Header:** "Active Chat Sessions" title, "Manage and respond to user support requests" subtitle
- **Two-Column Layout:** Chat list (left), Chat interface (right)

#### Chat Sessions List:
- **Card with ScrollArea:** Shows active chats assigned to agent
- **Empty State:** MessageSquare icon, "No active chat sessions" text
- **Chat Items:**
  - User avatar
  - User name, last message
  - Status badge (waiting=secondary, active=default)
  - Unread count badge
  - Recent message preview (last 2 messages)
  - Language badge, Location badge
  - Click to select chat

#### Chat Interface:
- **Selected Chat Header:**
  - User avatar, name, email
  - Call button, Close Chat button
- **Messages Area:**
  - Scrollable message list
  - Agent messages (right, primary background)
  - User messages (left, muted background)
  - Message status indicators (sent, delivered, read)
  - Timestamps
  - Attachment support (images, videos, audio, files)
  - Translation display (original and translated text)
- **Input Area:**
  - Text input with send button
  - Attachment button (paperclip icon)
  - Auto-translation for multilingual support

#### Features:
- Real-time message updates
- Message status tracking
- Multi-language support with translation
- File attachment handling
- Chat closure functionality

### 3. Voice Calls Page (`/support-agent/calls`)
**Path:** `src/app/support-agent/calls/page.tsx`

#### UI Components:
- **Header Section:**
  - Large PhoneCall icon in green-cyan gradient
  - Title: "Voice Calls Management"
  - Subtitle: "Handle voice and video calls from users in need"

#### Active Calls Section:
- **Card with ScrollArea:** "Active Calls" title, shows count
- **Empty State:** Phone icon, "No active calls" text
- **Call Items:**
  - User avatar
  - User name
  - Priority color dot
  - Status badge (ringing=destructive, active=default)
  - Language badge, Location badge
  - Video badge (if video call)
  - Click to select call

#### Call Interface:
- **Incoming Call View:**
  - Large user avatar
  - User name, language
  - Priority badge
  - "Incoming Call" text with pulsing animation
  - Decline and Accept buttons

- **Active Call View:**
  - User avatar, name, language
  - Live call timer (MM:SS format)
  - Call controls: Mute, Hold, End Call buttons
  - Call status text
  - Location display (if available)

#### Call History Section:
- **Card:** "Recent Call History" title, "Calls from the last 24 hours" description
- **History Items:**
  - User avatar, name
  - Language badge, Duration badge
  - Status badge (ended=secondary, missed=destructive)
  - End time

#### Features:
- Call duration tracking
- Priority levels (emergency, high, medium, low)
- Voice and video call support
- Call status management (ringing, active, ended, missed)

### 4. Chat History Page (`/support-agent/history`)
**Path:** `src/app/support-agent/history/page.tsx`

#### UI Components:
- **Header Section:**
  - Large History icon in purple-indigo gradient
  - Title: "Chat History"
  - Subtitle: "Review and analyze past support conversations"

#### Filters and Search:
- **Search Input:** "Search by user name, message, or language..." placeholder
- **Date Range Selector:** Last Day, 7 Days, 30 Days, 90 Days
- **Status Filter:** All Status, Active, Closed, Transferred
- **Resolution Filter:** All Resolutions, Resolved, Transferred, Abandoned, Pending
- **Export Button:** "Export Data" with download functionality

#### Chat History List:
- **Scrollable Card:** Shows filtered chat sessions
- **Empty State:** History icon, "No chat history found" text
- **History Items:**
  - User avatar with name fallback
  - User name
  - Language badge, Message count badge
  - Last message (truncated)
  - Metadata: timestamp, duration, location
  - Status badge (active=green, closed=gray, transferred=orange)
  - Resolution badge (resolved=green, transferred=orange, abandoned=red, pending=yellow)
  - "View" button to open chat

#### Features:
- Advanced filtering and search
- CSV export functionality
- Chat session analytics (duration, message count)
- Resolution tracking
- Multilingual chat history

---

## Technical Implementation Requirements

### Flutter App Structure:
```
lib/
├── models/           # Data models for all collections
├── screens/          # Screen implementations
│   ├── admin/        # Admin module screens
│   └── support_agent/# Support agent screens
├── widgets/          # Reusable UI components
├── services/         # Firebase services, API calls
├── utils/            # Helper functions, constants
└── main.dart
```

### Key Dependencies:
- `firebase_core`, `cloud_firestore` - Firebase integration
- `firebase_auth` - Authentication
- `google_maps_flutter` - Maps functionality
- `flutter_local_notifications` - Push notifications
- `cached_network_image` - Image caching
- `intl` - Date/time formatting
- `url_launcher` - External links
- `flutter_sound` - Audio recording/playback
- `permission_handler` - Location/call permissions

### Real-time Data Handling:
- Use StreamBuilder for real-time Firestore updates
- Implement proper error handling and loading states
- Handle offline data synchronization

### UI/UX Requirements:
- Maintain exact color schemes and gradients
- Implement responsive design for mobile screens
- Use proper loading skeletons and empty states
- Ensure accessibility with proper contrast and touch targets
- Implement smooth animations and transitions

### Security and Permissions:
- Implement role-based access control
- Handle Firestore security rules in Flutter
- Secure API key management
- Proper user authentication flows

This specification provides the complete blueprint for building feature-complete Flutter mobile app modules that mirror the web application's functionality, user experience, and data management.