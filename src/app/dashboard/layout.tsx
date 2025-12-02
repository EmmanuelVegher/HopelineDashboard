
'use client';

import { Navbar } from '@/components/navbar';
import { useLoading } from '@/contexts/LoadingProvider';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
  const { setIsLoading } = useLoading();
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  return (
    <div className="bg-gray-50/50 min-h-screen blob-container">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <Navbar />
        <main><Outlet /></main>
      </div>
    </div>
  );
}
