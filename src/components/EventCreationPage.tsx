'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronRight, Settings2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

interface EventData {
  id: string; 
  name: string;
  selectedDates: string[];
  requireEmail: boolean;
  startTime: string;
  endTime: string;
  timezone: {
    value: string;
    label: string;
  };
  timeSlots: string[];
  responses: Array<{
    name: string;
    email?: string;
    availability: Array<{
      date: string;
      time: string;
      available: boolean;
      timestamp: string;
    }>;
  }>;
  responseLimit?: number;
}

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

const EMOJIS = [
  // Fun & Creative
  '🌟', '🎨', '🎭', '🌈', '🎪', '🎠', '🎡', '🎢', '🎬', '🎸',
  // Animals
  '🦋', '🐬', '🦜', '🦒', '🦁', '🦊', '🐘', '🦄', '🐠', '🦩',
  // Nature
  '🌺', '🌸', '🍀', '🌴', '🌵', '🌹', '🌻', '🍁', '🌿', '🌳',
  // Games & Activities
  '🎮', '🎲', '🎯', '🎪', '🎨', '⚽', '🎱', '🎳', '🎵', '🎹',
  // Space & Stars
  '🚀', '✨', '💫', '⭐', '🌙', '🌎', '☄️', '🌍', '🌌', '🛸',
  // Weather & Elements
  '🌞', '⛈️', '🌈', '❄️', '🌊', '🔥', '⚡', '🌪️', '☁️', '🌅',
  // Food & Drinks
  '🍕', '🍦', '🍰', '🎂', '🍭', '🍪', '🧁', '🥨', '🍩', '🍫'
];

const generateFunName = () => {
  const shuffled = [...EMOJIS].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);
  return selected.join('');
};

const DEFAULT_PLACEHOLDER = "Incredible Motionful Meeting";

const EventCreationPage = () => {
  const router = useRouter();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [eventName, setEventName] = useState("");
  const [requireEmail] = useState(false);
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timezone, setTimezone] = useState(() => {
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const defaultTz = US_TIMEZONES.find(tz => tz.value === systemTimezone) || US_TIMEZONES[0];
    return defaultTz.value;
  });
  const [responseLimit, setResponseLimit] = useState<number | undefined>(undefined);
  const [enableResponseLimit, setEnableResponseLimit] = useState(false);

  const timeSlots = [
    "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
    "6:00 PM", "7:00 PM", "8:00 PM"
  ];

  const responseLimitOptions = [1, 2, 3, 4, 5, 10, 15, 20];

  const validateForm = (): boolean => {
    if (selectedDates.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one date",
        variant: "destructive",
      });
      return false;
    }

    if (!startTime || !endTime) {
      toast({
        title: "Error",
        description: "Please select both start and end times",
        variant: "destructive",
      });
      return false;
    }

    if (!timezone) {
      toast({
        title: "Error",
        description: "Please select a timezone",
        variant: "destructive",
      });
      return false;
    }

    // Validate that end time is after start time
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    if (startIndex >= endIndex) {
      toast({
        title: "Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return false;
    }

    // Validate date format
    if (!selectedDates.every(date => date instanceof Date && !isNaN(date.getTime()))) {
      toast({
        title: "Error",
        description: "Invalid date format",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleCreateEvent = async () => {
    try {
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      const eventId = uuidv4();
      const finalEventName = eventName.trim() || generateFunName();

      const selectedTimezone = US_TIMEZONES.find(tz => tz.value === timezone) || US_TIMEZONES[0];
      
      console.log('=== CHECKING ALL REQUIRED FIELDS ===');
      console.log('id:', eventId);
      console.log('name:', finalEventName);
      console.log('selectedDates:', selectedDates.map(date => date.toISOString()));
      console.log('startTime:', startTime);
      console.log('endTime:', endTime);
      console.log('timezone:', selectedTimezone);
      console.log('timeSlots:', timeSlots.slice(
        timeSlots.indexOf(startTime),
        timeSlots.indexOf(endTime) + 1
      ));

      const eventData: EventData = {
        id: eventId,
        name: finalEventName,
        selectedDates: selectedDates.map(date => date.toISOString()),
        requireEmail,
        startTime,
        endTime,
        timezone: {
          value: selectedTimezone.value,
          label: selectedTimezone.label
        },
        timeSlots: timeSlots.slice(
          timeSlots.indexOf(startTime),
          timeSlots.indexOf(endTime) + 1
        ),
        responses: [],
        responseLimit: enableResponseLimit ? responseLimit : undefined,
      };

      console.log('=== FINAL EVENT DATA ===');
      console.log(JSON.stringify(eventData, null, 2));

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();
      
      console.log('=== API RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Response:', data);

      if (!response.ok) {
        throw new Error(
          `Failed to create event. Status: ${response.status}. ${data.error || 'No error message provided'}`
        );
      }

      toast({
        title: "Success",
        description: "Event created successfully!",
      });

      router.push(`/event/${data.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateSelect = (days: Date[] | undefined) => {
    if (days) {
      setSelectedDates(days);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Updated Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Crosstime
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Coordinate your next meeting anonymously and effectively.</p>
        </div>

        {/* Updated Main Content Layout */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-gray-800/50 pb-4">
                <CardTitle className="text-xl text-blue-300">Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="event-name" className="text-gray-300">Event Name</Label>
                  <Input
                    id="event-name"
                    placeholder={DEFAULT_PLACEHOLDER}
                    className="bg-gray-800/50 border-gray-700/50 focus:border-blue-500 transition-colors"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Time Range</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Select onValueChange={setStartTime} value={startTime}>
                      <SelectTrigger className="bg-gray-800/50 border-gray-700/50 focus:border-blue-500">
                        <SelectValue placeholder="Start Time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setEndTime} value={endTime}>
                      <SelectTrigger className="bg-gray-800/50 border-gray-700/50 focus:border-blue-500">
                        <SelectValue placeholder="End Time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {startTime && endTime && timeSlots.indexOf(startTime) >= timeSlots.indexOf(endTime) && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      End time must be after start time
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select onValueChange={setTimezone} value={timezone}>
                    <SelectTrigger className="bg-gray-800 border-gray-700">
                      <SelectValue placeholder="Select Timezone">
                        {US_TIMEZONES.find(tz => tz.value === timezone)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {US_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-gray-800/50 pb-4">
                <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  <span>Advanced Options</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">

                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enable-response-limit">
                      Limit number of responses
                    </Label>
                    <Switch
                      id="enable-response-limit"
                      checked={enableResponseLimit}
                      onCheckedChange={setEnableResponseLimit}
                    />
                  </div>

                  {enableResponseLimit && (
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <Label>Maximum responses</Label>
                      <Select
                        value={responseLimit?.toString()}
                        onValueChange={(value: string) => setResponseLimit(Number(value))}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700">
                          <SelectValue placeholder="Select limit" />
                        </SelectTrigger>
                        <SelectContent>
                          {responseLimitOptions.map((limit) => (
                            <SelectItem key={limit} value={limit.toString()}>
                              {limit} {limit === 1 ? 'response' : 'responses'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="col-span-2">
                        <p className="text-sm text-gray-400">
                          Event will stop accepting new responses after reaching the limit. This is helpful if you want to publicize your schedule.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Calendar */}
          <div>
            <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-gray-800/50 pb-4">
                <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  <span>Select Dates</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pt-6">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(days) => handleDateSelect(days)}
                  className="rounded-md border border-gray-800/50"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Updated Create Button */}
        <div className="flex justify-center pt-6">
          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg transition-all duration-200 hover:scale-105"
            onClick={handleCreateEvent}
            disabled={isSubmitting || !startTime || !endTime || selectedDates.length === 0}
          >
            <span>{isSubmitting ? "Creating..." : "Create Event"}</span>
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventCreationPage;
