import { Check } from "lucide-react";

interface MessageStatusProps {
  status?: 'sent' | 'delivered' | 'read';
  className?: string;
}

export function MessageStatus({ status, className = "" }: MessageStatusProps) {
  if (!status) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return (
          <Check className={`h-3 w-3 text-gray-400 ${className}`} />
        );
      case 'delivered':
        return (
          <div className={`flex ${className}`}>
            <Check className="h-3 w-3 text-gray-400" />
            <Check className="h-3 w-3 text-gray-400 -ml-1" />
          </div>
        );
      case 'read':
        return (
          <div className={`flex ${className}`}>
            <Check className="h-3 w-3 text-green-500" />
            <Check className="h-3 w-3 text-green-500 -ml-1" />
          </div>
        );
      default:
        return null;
    }
  };

  return getStatusIcon();
}