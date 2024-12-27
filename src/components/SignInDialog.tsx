// Create a new file for the SignInDialog component
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: (userName: string, password: string) => Promise<boolean>;
  eventId: string;
  error?: string;
  isLocked?: boolean;
  requiresPassword?: boolean;
}

export function SignInDialog({ open, onOpenChange, onSignIn, error, isLocked, requiresPassword }: SignInDialogProps) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError('');

    const nameInput = document.getElementById('name') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;

    if (!nameInput?.value.trim()) {
      setLocalError('Please enter your name');
      setIsSubmitting(false);
      return;
    }

    if (requiresPassword && !passwordInput?.value.trim()) {
      setLocalError('Password is required for this event');
      setIsSubmitting(false);
      return;
    }

    try {
      const success = await onSignIn(nameInput.value.trim(), passwordInput?.value || '');
      if (!success) {
        setIsSubmitting(false);
      }
    } catch (error) {
      setLocalError('An error occurred. Please try again. Error: ' + error);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px]"
        aria-describedby="signin-description"
      >
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription id="signin-description">
            {isLocked 
              ? "This event has reached its maximum number of responses. If you have already responded to this event, you can still login to modify your response."
              : requiresPassword
                ? "Enter your name and password to save your availability. Passwords are required as this is a response-limited event."
                : "Enter your name to save your availability. Add an optional password to securely access your responses later."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          {(error || localError) && (
            <div className="text-red-500 mb-4" role="alert">
              {error || localError}
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setLocalError('');
                }}
                className="col-span-3"
                autoComplete="off"
                placeholder="John Do'h"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3"
                autoComplete="current-password"
                placeholder={requiresPassword ? "(Required)" : "(Optional)"}
                required={requiresPassword}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="submit"
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}