import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TranslationProvider } from './contexts/TranslationProvider';
import RootLayout from './app/layout';
import HomePage from './app/page';
import LoginPage from './app/login/page';
import SignupPage from './app/signup/page';
import ForgotPasswordPage from './app/forgot-password/page';
import DashboardLayout from './app/dashboard/layout';
import DashboardPage from './app/dashboard/page';
import AssistancePage from './app/assistance/page';
import FindShelterPage from './app/find-shelter/page';
import NavigatePage from './app/navigate/page';
import ProfilePage from './app/profile/page';
import DashboardProfilePage from './app/dashboard/profile/page';
import SettingsPage from './app/settings/page';
import SosPage from './app/sos/page';
import WeatherPage from './app/weather/page';
import ShelterPage from './app/shelter/[id]/page';
import AdminLayout from './app/admin/layout';
import AdminPage from './app/admin/page';
import ContactManagementPage from './app/admin/contact-management/page';
import DisplacedPersonsPage from './app/admin/displaced-persons/page';
import TrackDriversPage from './app/admin/track-drivers/page';
import TrackShelterPage from './app/admin/track-shelter/page';
import UserManagementPage from './app/admin/user-management/page';
import AdminProfilePage from './app/admin/profile/page';
import VehicleManagementPage from './app/admin/vehicle-management/page';
import SituationRoomPage from './app/admin/situation-room/page';
import AdminChatsPage from './app/admin/chats/page';
import TrainingCenterPage from './app/admin/training/page';
import DriverLayout from './app/driver/layout';
import DriverProfilePage from './app/driver/profile/page';
import DriverSettingsPage from './app/driver/settings/page';
import DriverHistoryPage from './app/driver/history/page';
import DriverMapPage from './app/driver/map/page';
import DriverChatsPage from './app/driver/chats/page';
import SupportAgentLayout from './app/support-agent/layout';
import SupportAgentDashboard from './app/support-agent/page';
import SupportAgentChatsPage from './app/support-agent/chats/page';
import IndividualChatPage from './app/support-agent/chats/[id]/page';
import SupportAgentCallsPage from './app/support-agent/calls/page';
import SupportAgentHistoryPage from './app/support-agent/history/page';
import SupportAgentMapPage from './app/support-agent/map/page';
import SupportAgentProfilePage from './app/support-agent/profile/page';
import SupportAgentSettingsPage from './app/support-agent/settings/page';
import SupportAgentNotificationsPage from './app/support-agent/notifications/page';
import SupportAgentTrainingPage from './app/support-agent/training/page';
import DriverTrainingPage from './app/driver/training/page';
import UserTrainingPage from './app/dashboard/training/page';
import CallPage from './app/call/page';
import PrivacyPage from './app/privacy/page';

import { CallListener } from './components/call/call-listener';

function App() {
  return (
    <TranslationProvider>
      <Router>
        <CallListener />
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route path="call" element={<CallPage />} />
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="assistance" element={<AssistancePage />} />
              <Route path="find-shelter" element={<FindShelterPage />} />
              <Route path="navigate" element={<NavigatePage />} />
              <Route path="profile" element={<DashboardProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="sos" element={<SosPage />} />
              <Route path="weather" element={<WeatherPage />} />
              <Route path="training" element={<UserTrainingPage />} />
            </Route>
            {/* Keep individual routes for backward compatibility */}
            <Route path="assistance" element={<DashboardLayout />}>
              <Route index element={<AssistancePage />} />
            </Route>
            <Route path="find-shelter" element={<DashboardLayout />}>
              <Route index element={<FindShelterPage />} />
            </Route>
            <Route path="navigate" element={<DashboardLayout />}>
              <Route index element={<NavigatePage />} />
            </Route>
            <Route path="profile" element={<DashboardLayout />}>
              <Route index element={<ProfilePage />} />
            </Route>
            <Route path="settings" element={<DashboardLayout />}>
              <Route index element={<SettingsPage />} />
            </Route>
            <Route path="sos" element={<DashboardLayout />}>
              <Route index element={<SosPage />} />
            </Route>
            <Route path="weather" element={<DashboardLayout />}>
              <Route index element={<WeatherPage />} />
            </Route>
            <Route path="driver" element={<DriverLayout />}>
              <Route index element={<DriverMapPage />} />
              <Route path="profile" element={<DriverProfilePage />} />
              <Route path="settings" element={<DriverSettingsPage />} />
              <Route path="history" element={<DriverHistoryPage />} />
              <Route path="map" element={<DriverMapPage />} />
              <Route path="chats" element={<DriverChatsPage />} />
              <Route path="training" element={<DriverTrainingPage />} />
            </Route>
            <Route path="support-agent" element={<SupportAgentLayout />}>
              <Route index element={<SupportAgentDashboard />} />
              <Route path="chats" element={<SupportAgentChatsPage />} />
              <Route path="chats/:id" element={<IndividualChatPage />} />
              <Route path="calls" element={<SupportAgentCallsPage />} />
              <Route path="history" element={<SupportAgentHistoryPage />} />
              <Route path="map" element={<SupportAgentMapPage />} />
              <Route path="profile" element={<SupportAgentProfilePage />} />
              <Route path="settings" element={<SupportAgentSettingsPage />} />
              <Route path="notifications" element={<SupportAgentNotificationsPage />} />
              <Route path="training" element={<SupportAgentTrainingPage />} />
            </Route>
            <Route path="shelter/:id" element={<ShelterPage />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminPage />} />
              <Route path="situation-room" element={<SituationRoomPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="contact-management" element={<ContactManagementPage />} />
              <Route path="displaced-persons" element={<DisplacedPersonsPage />} />
              <Route path="track-drivers" element={<TrackDriversPage />} />
              <Route path="track-shelter" element={<TrackShelterPage />} />
              <Route path="user-management" element={<UserManagementPage />} />
              <Route path="vehicle-management" element={<VehicleManagementPage />} />
              <Route path="chats" element={<AdminChatsPage />} />
              <Route path="training" element={<TrainingCenterPage />} />
            </Route>
            <Route path="privacy" element={<PrivacyPage />} />
          </Route>
        </Routes>
      </Router>
    </TranslationProvider>
  );
}

export default App;