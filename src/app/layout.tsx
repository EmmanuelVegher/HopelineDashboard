import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { LoadingProvider } from '@/contexts/LoadingProvider';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Outlet } from 'react-router-dom';

export default function RootLayout() {
  return (
    <div className="font-body antialiased">
      <LoadingProvider>
        <LoadingSpinner />
        <Outlet />
      </LoadingProvider>
      <Toaster />
    </div>
  );
}
