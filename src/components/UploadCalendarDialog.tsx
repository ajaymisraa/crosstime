import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquareText, Send, ChevronDown, Calendar, Upload, X, ArrowLeft } from "lucide-react";
import { FaGoogle, FaApple, FaMicrosoft } from 'react-icons/fa';
import { toast } from "@/hooks/use-toast";
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import 'dotenv/config';
import { format } from 'date-fns';
import { DateTime } from 'luxon';
import Image from 'next/image';

interface UploadCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyzeComplete: (
    newTimeSlots: {
      [dateStr: string]: {
        [time12: string]: boolean;
      };
    }
  ) => void;
  eventData: {
    selectedDates: string[];
  };
}

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict'
});

type ParsedSchedule = {
  weeklySchedule: {
    [key: string]: Array<{ startTime: string; endTime: string }>;
  };
};

/** 
 * Convert "HH:mm" (24-hour) -> "h:mm a" (12-hour).
 * E.g. "13:15" -> "1:15 PM".
 */
function convert24to12(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  let hourNum = parseInt(hourStr, 10);
  const minuteNum = parseInt(minuteStr, 10);

  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  hourNum = hourNum % 12 || 12; // 0 => 12, 13 => 1, etc.
  return `${hourNum}:${minuteNum.toString().padStart(2, '0')} ${ampm}`;
}


/**
 * Given "2024-12-26" and "13:15" (24-hour), parse to a DateTime for range comparison.
 */
function parse24HourToDateTime(dateStr: string, time24: string): DateTime {
  return DateTime.fromFormat(`${dateStr} ${time24}`, 'yyyy-MM-dd HH:mm', {
    zone: 'local',
  });
}

// 12-hour time slots from 9:00 AM to 5:00 PM, every 15 minutes
const TIME_SLOTS_12 = [
  '9:00 AM',
  '9:15 AM',
  '9:30 AM',
  '9:45 AM',
  '10:00 AM',
  '10:15 AM',
  '10:30 AM',
  '10:45 AM',
  '11:00 AM',
  '11:15 AM',
  '11:30 AM',
  '11:45 AM',
  '12:00 PM',
  '12:15 PM',
  '12:30 PM',
  '12:45 PM',
  '1:00 PM',
  '1:15 PM',
  '1:30 PM',
  '1:45 PM',
  '2:00 PM',
  '2:15 PM',
  '2:30 PM',
  '2:45 PM',
  '3:00 PM',
  '3:15 PM',
  '3:30 PM',
  '3:45 PM',
  '4:00 PM',
  '4:15 PM',
  '4:30 PM',
  '4:45 PM',
  '5:00 PM',
];

/** 
 * For the confirmation screen: turn "HH:mm" => "X:XX AM/PM" to display 
 */
const formatTimeForDisplay = (time24: string) => convert24to12(time24);

/** 
 * Summarize each day's slots for the confirmation screen 
 */
const getDayScheduleSummary = (slots: Array<{ startTime: string; endTime: string }>) => {
  if (slots.length === 0) return 'Unavailable';
  
  // If 00:00–23:59 => "Available all day"
  if (slots.length === 1 && slots[0].startTime === '00:00' && slots[0].endTime === '23:59') {
    return 'Available all day';
  }

  // Otherwise list each time window, e.g. "9:00 AM - 1:00 PM"
  return slots
    .map(slot => 
      `${formatTimeForDisplay(slot.startTime)} - ${formatTimeForDisplay(slot.endTime)}`
    )
    .join(', ');
};

function parse12HourTime(timeStr: string): [number, number] {
  const [time, meridiem] = timeStr.split(' ');
  const [minutes] = time.split(':').map(Number);
  let [hours] = time.split(':').map(Number);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return [hours, minutes];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/calendar',
  'application/json',
  'text/csv'
];

export function UploadCalendarDialog({
  open,
  onOpenChange,
  onAnalyzeComplete,
  eventData,
}: UploadCalendarDialogProps) {
  const [scheduleText, setScheduleText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedSchedule, setParsedSchedule] = useState<ParsedSchedule | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);

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

    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Error",
        description: "Invalid file type",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }

    setShowUploadConfirm(true);
  };

  const confirmUpload = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);

    try {
      let prompt = '';
      if (uploadedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedFile);
        });
        
        prompt = `Please analyze this calendar image and extract the weekly schedule. 
        The image is a calendar or schedule in base64 format: ${base64}
        
        For each day of the week:
        - If there are specific time slots, list them in 24-hour format (e.g., "09:00" to "17:00")
        - If the day is completely free, use a single slot from "00:00" to "23:59"
        - If the day has no availability, return an empty array
       - If the image shows just one specific day , or a abbreviation (Mon, Tues, Wed, etc), only include that day and times for that day. It's important that you DONT make assumptions for the other days if other days are not included. Only include assumptions for days included. 
        
        Focus on identifying:
        - Clear time blocks
        - Full day availability
        - Days with no availability
        - Recurring patterns`;
      } else {
        const text = await uploadedFile.text();
        prompt = `Please analyze this calendar file (${uploadedFile.type}) and extract the weekly schedule.
        The calendar data is: ${text}
        
        For each day of the week:
        - If there are specific time slots, list them in 24-hour format (e.g., "09:00" to "17:00")
        - If the day is completely free, use a single slot from "00:00" to "23:59"
        - If the day has no availability, return an empty array
         - If the image shows just one specific day , or a abbreviation (Mon, Tues, Wed, etc), only include that day and times for that day. It's important that you DONT make assumptions for the other days if other days are not included. Only include assumptions for days included. 
        
        Focus on identifying:
        - Clear time blocks
        - Full day availability
        - Days with no availability
        - Recurring patterns`;
      }

      const result = await generateObject({
        model: openai('gpt-4o-mini', {
          structuredOutputs: true,
        }),
        schemaName: 'schedule',
        schemaDescription: 'A weekly schedule showing available time slots',
        schema: z.object({
          weeklySchedule: z.object({
            monday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            tuesday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            wednesday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            thursday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            friday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            saturday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            sunday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
          }),
        }),
        prompt,
      });

      setParsedSchedule(result.object);
      setShowConfirmation(true);
      setShowUploadConfirm(false);
    } catch (error) {
      console.error('Error analyzing file:', error);
      setRateLimitError(true);
      setShowUploadConfirm(false);
      setShowConfirmation(false);
      setParsedSchedule(null);
    } finally {
      setIsAnalyzing(false);
      setUploadedFile(null);
      setPreviewUrl(null);
    }
  };

  /** GPT-based free-text schedule parsing */
  const analyzeSchedule = async () => {
    if (!scheduleText.trim()) return;

    setIsAnalyzing(true);
    try {
      const result = await generateObject({
        model: openai('gpt-4o-mini', {
          structuredOutputs: true,
        }),
        schemaName: 'schedule',
        schemaDescription: 'A weekly schedule showing available time slots',
        schema: z.object({
          weeklySchedule: z.object({
            monday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            tuesday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            wednesday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            thursday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            friday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            saturday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
            sunday: z.array(z.object({
              startTime: z.string(),
              endTime: z.string(),
            })),
          }),
        }),
        prompt: `Parse this availability description into a structured weekly schedule: "${scheduleText}". 
                 Convert any time references to 24-hour format (e.g., "7 PM" => "19:00").
                 For each day, provide an array of time slots.
                 If a day is completely unavailable, provide [].
                 If a day is completely available, provide a single slot from "00:00" to "23:59".
                 Use "HH:mm" format (24-hour).`,
      });

      console.log('Parsed schedule:', result.object);
      setParsedSchedule(result.object);
      setShowConfirmation(true);
      setIsAnalyzing(false);
    } catch (error) {
      console.error('Error analyzing schedule:', error);
      setRateLimitError(true);
      setShowUploadConfirm(false);
      setShowConfirmation(false);
      setParsedSchedule(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Build final structure purely using "X:XX AM/PM" keys
   * {
   *   "2024-12-26": {
   *       "9:00 AM": boolean,
   *       "9:15 AM": boolean,
   *       ...
   *   }
   * }
   */
  const applySchedule = () => {
    if (!parsedSchedule || !eventData?.selectedDates) {
      console.error('DEBUG - Missing required data:', { parsedSchedule, eventData });
      return;
    }

    console.log('DEBUG - Initial data:', {
      parsedSchedule,
      selectedDates: eventData.selectedDates,
      timeSlots: TIME_SLOTS_12
    });

    const newTimeSlots: {
      [dateStr: string]: {
        [time12: string]: boolean;
      };
    } = {};

    eventData.selectedDates.forEach((dateStr) => {
      console.log('\nDEBUG - Processing date:', dateStr);
      newTimeSlots[dateStr] = {};
      
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = format(date, 'EEEE').toLowerCase() as keyof typeof parsedSchedule.weeklySchedule;
      const daySlots = parsedSchedule.weeklySchedule[dayOfWeek] || [];

      // Initialize all slots with timestamps
      TIME_SLOTS_12.forEach((timeStr) => {
        const slotDate = new Date(date);
        const [hours, minutes] = parse12HourTime(timeStr);
        slotDate.setHours(hours, minutes, 0, 0);
        const timestamp = slotDate.getTime();
        newTimeSlots[dateStr][timestamp] = false;
      });

      // If it's a full day, mark all slots as available
      if (daySlots.length === 1 && 
          daySlots[0].startTime === '00:00' && 
          daySlots[0].endTime === '23:59') {
        Object.keys(newTimeSlots[dateStr]).forEach(timestamp => {
          newTimeSlots[dateStr][timestamp] = true;
        });
      } else {
        daySlots.forEach((slot) => {
          const startDT = parse24HourToDateTime(dateStr, slot.startTime);
          const endDT = parse24HourToDateTime(dateStr, slot.endTime);

          Object.keys(newTimeSlots[dateStr]).forEach(timestamp => {
            const slotTime = DateTime.fromMillis(parseInt(timestamp));
            if (slotTime >= startDT && slotTime < endDT) {
              newTimeSlots[dateStr][timestamp] = true;
            }
          });
        });
      }
    });

    console.log('DEBUG - Final structure:', newTimeSlots);
    
    // Add a small delay to ensure state updates are processed
    setTimeout(() => {
      onAnalyzeComplete(newTimeSlots);
      setShowConfirmation(false);
      onOpenChange(false);

      toast({
        title: "Success",
        description: "Your availability has been updated!",
      });
    }, 0);
  };

  // Pressing Enter triggers analyzeSchedule
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && scheduleText.trim()) {
      e.preventDefault();
      analyzeSchedule();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] px-4 sm:px-6 mx-auto">
        {rateLimitError ? (
          <div className="space-y-6 p-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-red-400">
                    Something Went Wrong
                  </h3>
                  <p className="text-sm text-red-300/80">
                    Please wait a moment before trying again. This is likely a temporary issue. If this persists, please let us know @ help@crosstime.org.
                  </p>
                </div>
                <Button 
                  onClick={() => setRateLimitError(false)}
                  className="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
                >
                 Dismiss
                </Button>
              </div>
            </div>
          </div>
        ) : showConfirmation && parsedSchedule ? (
          <div className="space-y-6">
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-2xl sm:text-3xl font-semibold">
                Confirm Your Schedule
              </DialogTitle>
              <p className="text-sm text-gray-400">
                Please review your weekly availability
              </p>
            </DialogHeader>

            <div className="space-y-4 p-4 rounded-lg border border-gray-800 bg-gray-900/50">
              {Object.entries(parsedSchedule.weeklySchedule).map(([day, slots]) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24 font-medium text-gray-300 capitalize">
                    {day}
                  </div>
                  <div className="flex-1 text-sm text-gray-400">
                    {getDayScheduleSummary(slots)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowConfirmation(false);
                  setParsedSchedule(null);
                  setScheduleText('');
                }}
                className="flex items-center gap-2 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={applySchedule}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                Apply Schedule
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-2xl sm:text-3xl font-semibold">
                Describe your availability
              </DialogTitle>
              {!showCalendarOptions && (
                <p className="text-sm sm:text-base text-gray-400">
                  Tell us when you&apos;re free in your own words. For example:
                  <br />
                  <span className="italic text-gray-500">
                    &quot;free tues thurs after 7 PM, all weekends, cant do mon&quot;
                  </span>
                </p>
              )}
            </DialogHeader>
            {/* Free-text input */}
            {!showCalendarOptions && (
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
                      ${
                        scheduleText.trim()
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
                          ${
                            scheduleText.trim()
                              ? 'translate-x-0 translate-y-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                              : '-translate-x-0.5 translate-y-0.5 opacity-70'
                          }`}
                      />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Calendar integration (placeholder) */}
            <div className="w-full">
              <Button
                variant="ghost"
                onClick={() => setShowCalendarOptions(!showCalendarOptions)}
                className="w-full flex items-center justify-center gap-2 text-gray-400 
                  hover:text-gray-300 hover:bg-gray-800/30 transition-all duration-200"
              >
                <Calendar className="w-4 h-4" />
                {showCalendarOptions ? (
                  <span>Describe your availability instead</span>
                ) : (
                  <span>Import from your calendar instead</span>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showCalendarOptions ? 'rotate-180' : ''
                  }`}
                />
              </Button>

              {showCalendarOptions && (
                <div className="space-y-6 animate-in fade-in duration-200 w-full pt-4">
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
                          Upload your calendar (beta)
                        </p>
                        <p className="text-xs text-gray-400">
                          Drop a picture of your calendar or upload an .ical, .ics, .csv, or .json file.
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileInput}
                        accept=".ical,.ics,.csv,.json,image/*"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {showUploadConfirm && (
              <div className="space-y-6 px-2">
                <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-200">Confirm Calendar Upload</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setShowUploadConfirm(false);
                          setUploadedFile(null);
                          setPreviewUrl(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-col items-center gap-4">
                      {previewUrl && (
                        <div className="w-full max-w-[500px] max-h-[500px] overflow-hidden rounded-lg border border-gray-800 mx-auto relative">
                          <Image
                            src={previewUrl}
                            alt="Calendar preview"
                            width={500}
                            height={500}
                            className="object-contain"
                            unoptimized // Since we're using a blob URL
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowUploadConfirm(false);
                      setUploadedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmUpload}
                    disabled={isAnalyzing}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    {isAnalyzing ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        <span>Analyzing...</span>
                      </div>
                    ) : (
                      'Analyze Calendar'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
