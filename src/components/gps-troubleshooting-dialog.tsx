import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Wifi, MapPin, Smartphone, Settings, RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface GPSTroubleshootingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gpsStatus?: 'good' | 'weak' | 'lost' | 'unknown';
  isOffline?: boolean;
  signalStrength?: number;
}

export default function GPSTroubleshootingDialog({
  isOpen,
  onOpenChange,
  gpsStatus = 'unknown',
  isOffline = false,
  signalStrength = 0
}: GPSTroubleshootingDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const troubleshootingSteps = [
    {
      title: "Check Device Settings",
      description: "Ensure location services are enabled for this app",
      icon: <Settings className="h-5 w-5" />,
      steps: [
        "Go to Settings > Privacy & Security > Location Services",
        "Make sure Location Services is turned ON",
        "Find this app and ensure it's set to 'While Using' or 'Always'",
        "Check that Precise Location is enabled"
      ]
    },
    {
      title: "Check Network Connection",
      description: "GPS works better with internet connection",
      icon: <Wifi className="h-5 w-5" />,
      steps: [
        "Ensure you have an active internet connection",
        "Try switching between Wi-Fi and mobile data",
        "Check if you're in an area with poor network coverage",
        "Consider moving to an area with better signal"
      ]
    },
    {
      title: "GPS Signal Issues",
      description: "Physical factors affecting GPS reception",
      icon: <MapPin className="h-5 w-5" />,
      steps: [
        "Move to an open area away from tall buildings",
        "Avoid areas with heavy tree cover or tunnels",
        "Check if you're indoors - GPS works best outdoors",
        "Wait a few minutes for GPS to acquire satellites",
        "Try restarting your device"
      ]
    },
    {
      title: "Device-Specific Issues",
      description: "Troubleshooting device and app problems",
      icon: <Smartphone className="h-5 w-5" />,
      steps: [
        "Force close and restart the app",
        "Restart your device completely",
        "Check for app updates in the app store",
        "Clear app cache if available",
        "Check device storage space"
      ]
    }
  ];

  const getStatusIcon = () => {
    if (isOffline) return <XCircle className="h-5 w-5 text-red-500" />;
    switch (gpsStatus) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'weak': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'lost': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    if (isOffline) return 'destructive';
    switch (gpsStatus) {
      case 'good': return 'default';
      case 'weak': return 'secondary';
      case 'lost': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto z-[1000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            GPS Troubleshooting Guide
          </DialogTitle>
          <DialogDescription>
            Current GPS Status:
            <Badge variant={getStatusColor() as any} className="ml-2">
              {isOffline ? 'Offline' : gpsStatus?.toUpperCase() || 'UNKNOWN'}
              {signalStrength !== undefined && ` (${signalStrength}%)`}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isOffline && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Device Offline</AlertTitle>
              <AlertDescription>
                Your device appears to be offline. Location tracking will use cached data until connection is restored.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 mb-4">
            {troubleshootingSteps.map((step, index) => (
              <Button
                key={index}
                variant={currentStep === index ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentStep(index)}
                className="flex items-center gap-1"
              >
                {step.icon}
                {index + 1}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{troubleshootingSteps[currentStep].icon}</span>
              <h3 className="text-lg font-semibold">{troubleshootingSteps[currentStep].title}</h3>
            </div>
            <p className="text-muted-foreground">{troubleshootingSteps[currentStep].description}</p>

            <div className="space-y-2">
              <h4 className="font-medium">Try these steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {troubleshootingSteps[currentStep].steps.map((step, index) => (
                  <li key={index} className="text-muted-foreground">{step}</li>
                ))}
              </ol>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.min(troubleshootingSteps.length - 1, currentStep + 1))}
              disabled={currentStep === troubleshootingSteps.length - 1}
            >
              Next
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="ml-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh App
            </Button>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Still having issues?</AlertTitle>
            <AlertDescription>
              If GPS problems persist, try restarting your device or contact technical support.
              The system will continue to use cached location data when GPS is unavailable.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}