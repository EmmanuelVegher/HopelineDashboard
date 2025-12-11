import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { LoadingProvider } from '@/contexts/LoadingProvider';
import { LoadingSpinner } from '@/components/loading-spinner';
import { TranslationProvider } from '@/contexts/TranslationProvider';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { Outlet } from 'react-router-dom';

export default function RootLayout() {
  return (
    <div className="font-body antialiased">
      <ThemeProvider>
        <LoadingProvider>
          <TranslationProvider>
            <LoadingSpinner />
            <Outlet />
          </TranslationProvider>
        </LoadingProvider>
      </ThemeProvider>
      <Toaster />
    </div>
  );
}
