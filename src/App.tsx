import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RootLayout from './app/layout';
import HomePage from './app/page';
import LoginPage from './app/login/page';
import SignupPage from './app/signup/page';
import ForgotPasswordPage from './app/forgot-password/page';
import DashboardLayout from './app/dashboard/layout';
import DashboardPage from './app/dashboard/page';
import AssistanceLayout from './app/assistance/layout';
import AssistancePage from './app/assistance/page';
import FindShelterLayout from './app/find-shelter/layout';
import FindShelterPage from './app/find-shelter/page';
import NavigateLayout from './app/navigate/layout';
import NavigatePage from './app/navigate/page';
import ProfileLayout from './app/profile/layout';
import ProfilePage from './app/profile/page';
import SettingsLayout from './app/settings/layout';
import SettingsPage from './app/settings/page';
import SosLayout from './app/sos/layout';
import SosPage from './app/sos/page';
import WeatherLayout from './app/weather/layout';
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
import DriverLayout from './app/driver/layout';
import DriverProfilePage from './app/driver/profile/page';
import DriverSettingsPage from './app/driver/settings/page';
import DriverHistoryPage from './app/driver/history/page';
import DriverMapPage from './app/driver/map/page';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
          </Route>
          <Route path="assistance" element={<AssistanceLayout />}>
            <Route index element={<AssistancePage />} />
          </Route>
          <Route path="find-shelter" element={<FindShelterLayout />}>
            <Route index element={<FindShelterPage />} />
          </Route>
          <Route path="navigate" element={<NavigateLayout />}>
            <Route index element={<NavigatePage />} />
          </Route>
          <Route path="profile" element={<ProfileLayout />}>
            <Route index element={<ProfilePage />} />
          </Route>
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<SettingsPage />} />
          </Route>
          <Route path="sos" element={<SosLayout />}>
            <Route index element={<SosPage />} />
          </Route>
          <Route path="weather" element={<WeatherLayout />}>
            <Route index element={<WeatherPage />} />
          </Route>
          <Route path="driver" element={<DriverLayout />}>
            <Route index element={<DriverMapPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
            <Route path="settings" element={<DriverSettingsPage />} />
            <Route path="history" element={<DriverHistoryPage />} />
            <Route path="map" element={<DriverMapPage />} />
          </Route>
          <Route path="shelter/:id" element={<ShelterPage />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="contact-management" element={<ContactManagementPage />} />
            <Route path="displaced-persons" element={<DisplacedPersonsPage />} />
            <Route path="track-drivers" element={<TrackDriversPage />} />
            <Route path="track-shelter" element={<TrackShelterPage />} />
            <Route path="user-management" element={<UserManagementPage />} />
            <Route path="vehicle-management" element={<VehicleManagementPage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;