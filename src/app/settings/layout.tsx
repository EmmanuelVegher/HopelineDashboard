
'use client';

import { Navbar } from '@/components/navbar';
import { useLoading } from '@/contexts/LoadingProvider';
import { useEffect } from 'react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setIsLoading } = useLoading();
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  return (
    <div className="bg-gray-50/50 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <Navbar />
        <main>{children}</main>
      </div>
    </div>
  );
}
