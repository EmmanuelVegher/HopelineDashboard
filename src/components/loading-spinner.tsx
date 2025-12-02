
"use client";
import React, { memo } from "react";
import { useLoading } from "@/contexts/LoadingProvider";

const LoadingSpinnerComponent = () => {
  const { isLoading } = useLoading();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1">
      <div className="h-full w-full bg-primary/30 overflow-hidden">
        <div className="h-full bg-primary loading-indicator" />
      </div>
    </div>
  );
};

LoadingSpinnerComponent.displayName = "LoadingSpinner";

export const LoadingSpinner = memo(LoadingSpinnerComponent);
