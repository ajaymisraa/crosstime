import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquareText, Send, ChevronDown, Calendar, Upload } from "lucide-react";
import { FaGoogle, FaApple, FaMicrosoft } from 'react-icons/fa';
import { toast } from "@/hooks/use-toast";

interface UploadCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyzeComplete: (newTimeSlots: { [key: string]: { [key: string]: boolean } }) => void;
}

export function UploadCalendarDialog({ open, onOpenChange, onAnalyzeComplete }: UploadCalendarDialogProps) {
  const [scheduleText, setScheduleText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleCalendarConnect = (provider: string) => {
    toast({
      title: "Coming Soon",
      description: `${provider} Calendar integration will be available soon!`,
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    toast({
      title: "Coming Soon",
      description: "Calendar screenshot analysis will be available soon!",
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("error; lowkey not done for prod:", e);
    toast({
      title: "Coming Soon",
      description: "Calendar screenshot analysis will be available soon!",
    });
  };
  

  const analyzeSchedule = async () => {
    if (!scheduleText.trim()) return;

    setIsAnalyzing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newTimeSlots: { [key: string]: { [key: string]: boolean } } = {};
      onAnalyzeComplete(newTimeSlots);
      
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Schedule analyzed successfully!",
      });
    } catch (error) {
      console.error('Error analyzing schedule:', error);
      toast({
        title: "Error",
        description: "Failed to analyze schedule",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && scheduleText.trim()) {
      e.preventDefault();
      analyzeSchedule();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] px-4 sm:px-6 mx-auto">
        <DialogHeader className="space-y-2 text-center">
          <DialogTitle className="text-2xl sm:text-3xl font-semibold">Describe your availability</DialogTitle>
          <p className="text-sm sm:text-base text-gray-400">
            Tell us when you&apos;re free in your own words. For example:
            <br />
            <span className="italic text-gray-500">
              &quot;free tues thurs after 7 PM, all weekends, cant do mon&quot;
            </span>
          </p>
        </DialogHeader>

        {/* Schedule Description Section */}
        <div className="space-y-4 w-full flex flex-col items-center">
          <div className="relative flex items-center justify-center gap-2 w-full">
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <MessageSquareText className="w-5 h-5 text-gray-400/70" />
              </div>
              <Input
                placeholder="Describe when you're available..."
                value={scheduleText}
                onChange={(e) => setScheduleText(e.target.value)}
                onKeyDown={handleKeyPress}
                className="pl-10 pr-12 py-6 bg-gray-900/50 border-gray-700/50 
                  hover:border-gray-600/70 focus:border-blue-600/70 focus:ring-1 focus:ring-blue-600/50
                  transition-all duration-200 text-base rounded-xl placeholder:text-gray-500
                  shadow-sm w-full"
              />
              <Button
                size="sm"
                variant="ghost"
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 h-9 w-9 rounded-lg
                  ${scheduleText.trim() 
                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 hover:scale-105' 
                    : 'text-gray-400'
                  }
                  transition-all duration-200 group flex items-center justify-center`}
                onClick={analyzeSchedule}
                disabled={!scheduleText.trim() || isAnalyzing}
              >
                {isAnalyzing ? (
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
                ) : (
                  <Send 
                    className={`w-4 h-4 transition-all duration-300 ease-out
                      ${scheduleText.trim() 
                        ? 'translate-x-0 translate-y-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5' 
                        : '-translate-x-0.5 translate-y-0.5 opacity-70'
                      }`}
                  />
                )}
              </Button>
            </div>
          </div>

          {/* Calendar Options Button */}
          <div className="w-full">
            <Button
              variant="ghost"
              onClick={() => setShowCalendarOptions(!showCalendarOptions)}
              className="w-full flex items-center justify-center gap-2 text-gray-400 
                hover:text-gray-300 hover:bg-gray-800/30 transition-all duration-200"
            >
              <Calendar className="w-4 h-4" />
              <span>Import from your calendar instead</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showCalendarOptions ? 'rotate-180' : ''}`} />
            </Button>

            {showCalendarOptions && (
              <div className="space-y-6 animate-in fade-in duration-200 w-full pt-4">
                {/* Calendar Integration Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-3 h-14 hover:bg-gray-800/50 transition-all w-full"
                    onClick={() => handleCalendarConnect('Google')}
                    disabled
                  >
                    <FaGoogle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                    <span className="font-medium">Google</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-3 h-14 hover:bg-gray-800/50 transition-all w-full"
                    onClick={() => handleCalendarConnect('Apple')}
                    disabled
                  >
                    <FaApple className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                    <span className="font-medium">Apple</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-3 h-14 hover:bg-gray-800/50 transition-all w-full"
                    onClick={() => handleCalendarConnect('Microsoft')}
                    disabled
                  >
                    <FaMicrosoft className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                    <span className="font-medium">Microsoft</span>
                  </Button>
                </div>

                {/* File Upload Section */}
                <div 
                  className={`
                    border-2 border-dashed rounded-lg p-4
                    ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'}
                    transition-colors duration-200 mt-2
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <label className="flex items-center justify-center gap-4 cursor-pointer">
                    <div className="p-2 bg-gray-800/50 rounded-full">
                      <Upload className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-300">
                        Upload your calendar
                      </p>
                      <p className="text-xs text-gray-400">
                        Drop a picture of your calendar or upload an .ical, .ics, .csv, or .json file.
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileInput}
                      accept="image/*"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}