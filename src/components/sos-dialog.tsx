'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Send } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { useState } from 'react';

export function SOSDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = () => {
    // In a real app, this would be a server action.
    toast({
      title: "SOS Sent Successfully",
      description: "Help is on the way. Your location has been shared with our response team.",
      variant: 'default'
    })
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md z-[1000]">
        <DialogHeader>
          <DialogTitle>Send Emergency SOS</DialogTitle>
          <DialogDescription>
            This will immediately alert our emergency response team with your
            location. Only use this in a real emergency.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="message">Describe your emergency (optional)</Label>
            <Textarea
              placeholder="e.g., trapped by flood, need medical help..."
              id="message"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between flex-row-reverse">
            <Button type="submit" variant="destructive" onClick={handleSend} className="gap-2">
                <Send className="h-4 w-4"/>
                Send SOS Now
            </Button>
            <DialogClose asChild>
                <Button type="button" variant="secondary">
                    Cancel
                </Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
