'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Copy, Clock, LogIn, LogOut, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format } from 'date-fns';
import { DateTime } from 'luxon';
import { SignInDialog } from './SignInDialog';
import { debounce, DebouncedFunc } from 'lodash';
import { UploadCalendarDialog } from './UploadCalendarDialog';

interface AvailabilitySlot {
  date: string;
  time: string;
  available: boolean;
  timestamp: string;
}

interface ApiError {
  message?: string;
  error?: string;
}

interface EventData {
  id: string;
  name: string;
  selectedDates: Date[];
  requireEmail: boolean;
  hideResponses: boolean;
  startTime: string;
  endTime: string;
  timezone: { value: string; label: string };
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
  responseLimit: number;
}

interface TimeSlotState {
  [key: string]: {
    [key: string]: boolean;
  };
}

type ViewMode = 'personal' | 'everyone';

interface TimeSlot {
  timestamp: number;
  time: string;
  selected: boolean;
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

const getTimeAgo = (timestamp: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
  
  if (seconds === 0) return 'just now';
  
  let interval = seconds / 31536000; // years
  if (interval > 1) {
    const years = Math.floor(interval);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
  
  interval = seconds / 2592000; // months
  if (interval > 1) {
    const months = Math.floor(interval);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  
  interval = seconds / 86400; // days
  if (interval > 1) {
    const days = Math.floor(interval);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  
  interval = seconds / 3600; // hours
  if (interval > 1) {
    const hours = Math.floor(interval);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  interval = seconds / 60; // minutes
  if (interval > 1) {
    const minutes = Math.floor(interval);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  return seconds <= 1 ? 'just now' : `${Math.floor(seconds)} seconds ago`;
};

const EventViewPage = () => {
  const params = useParams();
  const router = useRouter();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => 
    isSignedIn ? 'personal' : 'everyone'
  );
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlotState>({});
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [, setIsSubmitting] = useState(false);
  const [userTimezone, setUserTimezone] = useState(() => {
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const defaultTz = US_TIMEZONES.find(tz => tz.value === systemTimezone) || US_TIMEZONES[0];
    return defaultTz.value;
  });
  const [showSignIn, setShowSignIn] = useState(false);
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [signInError, setSignInError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<boolean | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lastTouchedSlot, setLastTouchedSlot] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isUserSessionLoaded, setIsUserSessionLoaded] = useState(false);

  // Create a ref to store the debounced function
  const debouncedSubmitRef = useRef<DebouncedFunc<(slots: TimeSlotState) => void> | null>(null);

  // Initialize the debounced function
  useEffect(() => {
    debouncedSubmitRef.current = debounce(async (slots: TimeSlotState) => {
      if (!eventData || !isSignedIn) return;

      setIsSubmitting(true);
      try {
        const availability = Object.entries(slots).flatMap(([date, times]) =>
          Object.entries(times).map(([time, available]) => ({
            date,
            time,
            available,
            timestamp: new Date().toISOString()
          }))
        );

        const response = await fetch('/api/events', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            id: eventData.id,
            name: eventData.name,
            selectedDates: eventData.selectedDates,
            requireEmail: eventData.requireEmail,
            hideResponses: eventData.hideResponses,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            timezone: eventData.timezone,
            timeSlots: eventData.timeSlots,
            responses: [
              ...eventData.responses.filter(r => r.name !== currentUser),
              {
                name: currentUser,
                email: userEmail,
                availability
              }
            ]
          }),
        });

        const data: EventData = await response.json();

        if (!response.ok) {
          const errorData = data as ApiError;
          throw new Error(errorData.error || errorData.message || 'Failed to update event');
        }

        setEventData(data);
        
        toast({
          title: "Changes saved",
          description: "Your availability has been updated",
          duration: 2000,
        });
      } catch (error: unknown) {
        const apiError = error as ApiError;
        console.error('Error auto-saving:', error);
        toast({
          title: "Error",
          description: apiError?.message || "Failed to save changes. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    }, 1000);

    // Cleanup function
    return () => {
      if (debouncedSubmitRef.current) {
        debouncedSubmitRef.current.cancel();
      }
    };
  }, [eventData, isSignedIn, currentUser, userEmail]);

  useEffect(() => {
    const loadEventData = async () => {
      try {
        const response = await fetch(`/api/events?id=${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch event');
        }

        if (!data) {
          throw new Error('Event not found');
        }

        setEventData(data);
        setIsDataLoaded(true);
      } catch (error: unknown) {
        const apiError = error as ApiError;
        console.error('Error loading event:', error);
        toast({
          title: "Error",
          description: apiError.message || "Failed to load event",
          variant: "destructive",
        });
      }
    };

    loadEventData();
  }, [params.id, router]);

  useEffect(() => {
    if (eventData?.id) {
      const fetchUserSession = async () => {
        try {
          const response = await fetch(`/api/events/users?eventId=${eventData.id}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            if (userData.userName) {
              setCurrentUser(userData.userName);
              setIsSignedIn(true);
              
              // Load previous responses
              const userResponses = eventData.responses.find(r => r.name === userData.userName);
              if (userResponses) {
                setUserEmail(userResponses.email || '');
                const slots: TimeSlotState = {};
                userResponses.availability.forEach((slot: AvailabilitySlot) => {
                  if (!slots[slot.date]) slots[slot.date] = {};
                  slots[slot.date][slot.time] = slot.available;
                });
                setSelectedTimeSlots(slots);
              }
            }
          } else {
            setIsSignedIn(false);
            setCurrentUser('');
          }
        } catch (error) {
          console.error('Error fetching user session:', error);
          setIsSignedIn(false);
          setCurrentUser('');
        } finally {
          setIsUserSessionLoaded(true);
        }
      };

      fetchUserSession();
    }
  }, [eventData?.id, eventData?.responses]);

  useEffect(() => {
    setViewMode(isSignedIn ? 'personal' : 'everyone');
  }, [isSignedIn]);

  const getAvailabilityDetails = (date: string, time: string) => {
    if (!eventData) return [];
    
    let filteredResponses = eventData.responses;
    if (hasSelectedUsers()) {
      filteredResponses = eventData.responses.filter(response => selectedUsers[response.name]);
    }
    
    return filteredResponses
      .filter(response => 
        response.availability.find(
          a => a.date === date && a.time === time && a.available
        )
      )
      .map(response => ({
        name: response.name,
        email: response.email,
        timestamp: response.availability.find(
          a => a.date === date && a.time === time
        )?.timestamp || new Date().toISOString()
      }));
  };

  const getTimeSlotColor = (date: string, time: number) => {
    if (!eventData) return 'border-gray-800 hover:bg-gray-700 hover:text-white';
    
    if (viewMode === 'personal') {
      return selectedTimeSlots[date]?.[time] 
        ? 'bg-blue-600 border-blue-500 hover:bg-blue-700 text-white'
        : 'border-gray-800 hover:bg-gray-700 hover:text-white';
    }
    
    const availableResponses = getAvailabilityDetails(date, time.toString());
    const totalResponses = hasSelectedUsers() 
      ? Object.keys(selectedUsers).filter(key => selectedUsers[key]).length 
      : eventData.responses.length;
    
    if (totalResponses === 0) return 'border-gray-800 hover:bg-gray-700 hover:text-white';
    
    const percentage = availableResponses.length / totalResponses;
    
    if (percentage === 1) return 'bg-green-900 border-green-800 hover:bg-white hover:text-green-900';
    if (percentage >= 0.75) return 'bg-green-700 border-green-600 hover:bg-white hover:text-green-700';
    if (percentage >= 0.5) return 'bg-green-500 border-green-400 hover:bg-white hover:text-green-500';
    if (percentage > 0) return 'bg-green-300 border-green-200 hover:bg-white hover:text-green-300';
    return 'border-gray-800 hover:bg-gray-700 hover:text-white';
  };

  const handleTimeSlotClick = (date: string, timestamp: number) => {
    if (viewMode === 'everyone') return;
    
    const newSelectedTimeSlots = {
      ...selectedTimeSlots,
      [date]: {
        ...selectedTimeSlots[date],
        [timestamp]: !selectedTimeSlots[date]?.[timestamp]
      }
    };
    
    setSelectedTimeSlots(newSelectedTimeSlots);

    // Auto-save if signed in
    if (isSignedIn && debouncedSubmitRef.current) {
      debouncedSubmitRef.current(newSelectedTimeSlots);
    }
  };

  // Add state for copy animation
  const [isCopying, setIsCopying] = useState(false);

  // Update the copyEventLink function with proper error handling
  const copyEventLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setIsCopying(true);
      toast({
        title: "Success",
        description: "Link copied to clipboard!",
      });
      
      // Reset animation after 1 second
      setTimeout(() => {
        setIsCopying(false);
      }, 500);
    } catch (error: unknown) {
      // Proper error handling with type checking
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to copy link to clipboard";
      
      console.error("Copy error:", error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const generateTimeSlotsForTimezone = (date: Date): TimeSlot[] => {
    if (!eventData) return [];
    
    // Parse start and end times using 24-hour format
    const startParts = eventData.startTime.match(/(\d+):(\d+)\s*(am|pm)?/i);
    const endParts = eventData.endTime.match(/(\d+):(\d+)\s*(am|pm)?/i);
    
    if (!startParts || !endParts) return [];

    // Convert the event's times from event timezone to user timezone
    const startInEventTz = DateTime.fromObject(
      {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: startParts[3]?.toLowerCase() === 'pm' && parseInt(startParts[1]) !== 12 
          ? parseInt(startParts[1]) + 12 
          : startParts[3]?.toLowerCase() === 'am' && parseInt(startParts[1]) === 12
          ? 0
          : parseInt(startParts[1]),
        minute: parseInt(startParts[2])
      },
      { zone: eventData.timezone.value }
    );

    const endInEventTz = DateTime.fromObject(
      {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: endParts[3]?.toLowerCase() === 'pm' && parseInt(endParts[1]) !== 12 
          ? parseInt(endParts[1]) + 12 
          : endParts[3]?.toLowerCase() === 'am' && parseInt(endParts[1]) === 12
          ? 0
          : parseInt(endParts[1]),
        minute: parseInt(endParts[2])
      },
      { zone: eventData.timezone.value }
    );

    // Convert to user timezone
    const startInUserTz = startInEventTz.setZone(userTimezone);
    const endInUserTz = endInEventTz.setZone(userTimezone);

    // Generate slots
    const slots: TimeSlot[] = [];
    let currentTime = startInUserTz;
    const endTime = endInUserTz;

    while (currentTime <= endTime) {
      slots.push({
        timestamp: currentTime.toMillis(),
        time: currentTime.toFormat('h:mm a'),
        selected: false
      });
      currentTime = currentTime.plus({ minutes: 15 });
    }

    return slots;
  };

  // Helper to check if a slot is on the hour
  const isHourMark = (timestamp: number): boolean => {
    const date = new Date(timestamp);
    return date.getMinutes() === 0;
  };

  // Helper function to format the date range
  const formatDateRange = (dates: Date[]) => {
    if (!dates.length || !eventData?.timezone?.label) return '';
    
    // Sort dates chronologically
    const sortedDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Group consecutive dates
    const groups: { start: Date; end: Date }[] = [];
    let currentGroup: { start: Date; end: Date } | null = null;

    sortedDates.forEach((date, index) => {
      const currentDate = new Date(date);
      const prevDate = index > 0 ? new Date(sortedDates[index - 1]) : null;
      
      // Check if this date is consecutive with the previous date
      // AND in the same month
      if (prevDate && 
          Math.abs(currentDate.getTime() - prevDate.getTime()) === 24 * 60 * 60 * 1000 &&
          currentDate.getMonth() === prevDate.getMonth()) {
        if (currentGroup) {
          currentGroup.end = currentDate;
        }
      } else {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = { start: currentDate, end: currentDate };
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    // Group the formatted strings by month and year
    const monthGroups: { [key: string]: string[] } = {};
    
    groups.forEach((group) => {
      const monthYear = `${format(group.start, 'MMMM yyyy')}`;
      if (!monthGroups[monthYear]) {
        monthGroups[monthYear] = [];
      }

      const sameMonth = group.start.getMonth() === group.end.getMonth();
      let dateStr = '';

      if (group.start === group.end) {
        dateStr = format(group.start, 'd');
      } else if (sameMonth) {
        dateStr = `${format(group.start, 'd')}-${format(group.end, 'd')}`;
      } else {
        dateStr = `${format(group.start, 'MMMM d')}-${format(group.end, 'MMMM d')}`;
      }

      monthGroups[monthYear].push(dateStr);
    });

    // Format the final string
    const dateString = Object.entries(monthGroups).map(([monthYear, dates], index) => {
      const [month, year] = monthYear.split(' ');
      const isLastGroup = index === Object.entries(monthGroups).length - 1;
      const datesStr = dates.join(' and ');
      
      // Only add the year if it's different from the previous group
      if (isLastGroup || year !== Object.entries(monthGroups)[index + 1][0].split(' ')[1]) {
        return `${month} ${datesStr}, ${year}`;
      }
      return `${month} ${datesStr}`;
    }).join(' and ');

    // Get timezone abbreviation safely
    const timezoneParts = eventData.timezone.label.match(/\(([^)]+)\)/);
    const timezoneAbbr = timezoneParts ? timezoneParts[1] : eventData.timezone.label;
    
    // Add time range and timezone
    const timeRange = `from ${eventData.startTime} to ${eventData.endTime} ${timezoneAbbr}`;
    
    return `${dateString} ${timeRange}`;
  };

  const handleTimezoneChange = (newTimezone: string) => {
    if (!eventData) return;

    // Convert existing selections to the new timezone
    const convertedSelections: TimeSlotState = {};
    
    Object.entries(selectedTimeSlots).forEach(([date, times]) => {
      convertedSelections[date] = {};
      
      Object.entries(times).forEach(([timestamp, isSelected]) => {
        if (!isSelected) return; // Skip unselected slots
        
        // Convert the timestamp from old timezone to new timezone
        const oldTime = DateTime.fromMillis(parseInt(timestamp))
          .setZone(userTimezone);
        
        const newTime = oldTime.setZone(newTimezone);
        
        // Store the converted timestamp
        convertedSelections[date][newTime.toMillis()] = true;
      });
    });

    // Update the timezone and selected slots
    setUserTimezone(newTimezone);
    setSelectedTimeSlots(convertedSelections);
  };

  // First, generate a consistent set of time slots for all days using the first day
  const allTimeSlots = useMemo(() => {
    if (!eventData?.selectedDates.length) return [];
    
    // Parse start and end times using 24-hour format
    const startParts = eventData.startTime.match(/(\d+):(\d+)\s*(am|pm)?/i);
    const endParts = eventData.endTime.match(/(\d+):(\d+)\s*(am|pm)?/i);
    
    if (!startParts || !endParts) return [];

    // Convert the event's times from event timezone to user timezone
    const startInEventTz = DateTime.fromObject(
      {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        day: new Date().getDate(),
        hour: startParts[3]?.toLowerCase() === 'pm' && parseInt(startParts[1]) !== 12 
          ? parseInt(startParts[1]) + 12 
          : startParts[3]?.toLowerCase() === 'am' && parseInt(startParts[1]) === 12
          ? 0
          : parseInt(startParts[1]),
        minute: parseInt(startParts[2])
      },
      { zone: eventData.timezone.value }
    );

    const endInEventTz = DateTime.fromObject(
      {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        day: new Date().getDate(),
        hour: endParts[3]?.toLowerCase() === 'pm' && parseInt(endParts[1]) !== 12 
          ? parseInt(endParts[1]) + 12 
          : endParts[3]?.toLowerCase() === 'am' && parseInt(endParts[1]) === 12
          ? 0
          : parseInt(endParts[1]),
        minute: parseInt(endParts[2])
      },
      { zone: eventData.timezone.value }
    );

    // Convert to user timezone
    const startInUserTz = startInEventTz.setZone(userTimezone);
    const endInUserTz = endInEventTz.setZone(userTimezone);

    // Generate slots
    const slots: TimeSlot[] = [];
    let currentTime = startInUserTz;
    const endTime = endInUserTz;

    if (endTime <= currentTime) {
      endTime.plus({ days: 1 });
    }

    while (currentTime <= endTime) {
      const timestamp = currentTime.toMillis();
      slots.push({
        timestamp,
        time: currentTime.toFormat('h:mm a'),
        selected: false
      });
      currentTime = currentTime.plus({ minutes: 15 });
    }

    return slots;
  }, [eventData?.startTime, eventData?.endTime, eventData?.timezone.value, userTimezone, eventData?.selectedDates.length]);

  const handleSignIn = async () => {
    try {
      // Get current values from input boxes
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      const currentUserName = nameInput?.value || userName;
      const currentPassword = passwordInput?.value || password;
      
      console.log('handleSignIn current values:', {
        nameInputValue: nameInput?.value,
        currentUserName,
        originalUserName: userName,
        hasPassword: !!currentPassword,
        isResponseLimited: !!eventData?.responseLimit
      });

      // Check if password is required (response limited event)
      if (eventData?.responseLimit && !currentPassword) {
        setSignInError("Password is required for response-limited events.");
        return false;
      }

      if (!eventData?.id) return false;

      const response = await fetch('/api/events/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventData.id,
          userName: currentUserName.trim(),
          password: currentPassword || undefined,
          isResponseLimited: !!eventData.responseLimit
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setSignInError(data.message || data.error || 'Failed to sign in');
        return false;
      }

      setSignInError('');
      return true;

    } catch (error: unknown) {
      const apiError = error as ApiError;
      setSignInError(apiError?.message || 'Failed to sign in');
      return false;
    }
  };

  const handleSignOut = async () => {
    try {
      if (!eventData?.id) return;
      
      const response = await fetch(`/api/events/users/signout?eventId=${eventData.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to sign out');
      }
  
      setIsSignedIn(false);
      setCurrentUser('');
      setSelectedTimeSlots({});
      setUserEmail('');
      setViewMode('everyone');
      
      window.location.reload();

    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: apiError?.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  // Add this helper function to format time range
  const formatTimeRange = (startTime: string, endTime: string) => {
    // Convert endTime to DateTime, add 15 minutes, and format back
    const endDateTime = DateTime.fromFormat(endTime, 'h:mm a').plus({ minutes: 15 });
    const adjustedEndTime = endDateTime.toFormat('h:mm a');
    return `${startTime} to ${adjustedEndTime}`;
  };

  // Update touch handlers
  const handleTouchStart = (date: string, timestamp: number, currentValue: boolean, e: React.TouchEvent) => {
    if (viewMode === 'everyone') return;
    
    setIsDragging(true);
    setDragValue(!currentValue);
    setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setLastTouchedSlot(`${date}|${timestamp}`);
    
    // Update initial slot without triggering autosave
    const newSelectedTimeSlots = {
      ...selectedTimeSlots,
      [date]: {
        ...selectedTimeSlots[date],
        [timestamp]: !currentValue
      }
    };
    setSelectedTimeSlots(newSelectedTimeSlots);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || dragValue === null) return;

    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const slotElement = elements.find(el => el.hasAttribute('data-slot'));
    
    if (slotElement) {
      const currentSlot = slotElement.getAttribute('data-slot')!;
      if (currentSlot === lastTouchedSlot) return;
      
      setLastTouchedSlot(currentSlot);

      if (touchStartPos) {
        const rect = slotElement.getBoundingClientRect();
        const slotCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        const elementsInPath = document.elementsFromPoint(slotCenter.x, slotCenter.y);
        const slotElements = elementsInPath
          .filter(el => el.hasAttribute('data-slot'))
          .map(el => el.getAttribute('data-slot')!);

        // Update slots without triggering autosave
        const newSelectedTimeSlots = { ...selectedTimeSlots };
        slotElements.forEach(slotId => {
          const [slotDate, slotTimestamp] = slotId.split('|');
          if (!newSelectedTimeSlots[slotDate]) {
            newSelectedTimeSlots[slotDate] = {};
          }
          newSelectedTimeSlots[slotDate][slotTimestamp] = dragValue;
        });

        setSelectedTimeSlots(newSelectedTimeSlots);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragValue(null);
    
    // Send the complete update only when touch ends
    if (isSignedIn && debouncedSubmitRef.current) {
      debouncedSubmitRef.current.flush(); // Cancel any pending debounced calls
      submitAvailability(selectedTimeSlots); // Send immediate update
    }
  };

  // Add this function to handle the submission
  const submitAvailability = async (slots: TimeSlotState) => {
    if (!eventData || !isSignedIn) return;

    try {
      const availability = Object.entries(slots).flatMap(([date, times]) =>
        Object.entries(times).map(([time, available]) => ({
          date,
          time,
          available,
          timestamp: new Date().toISOString()
        }))
      );

      const response = await fetch('/api/events', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id: eventData.id,
          name: eventData.name,
          selectedDates: eventData.selectedDates,
          requireEmail: eventData.requireEmail,
          hideResponses: eventData.hideResponses,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          timezone: eventData.timezone,
          timeSlots: eventData.timeSlots,
          responses: [
            ...eventData.responses.filter(r => r.name !== currentUser),
            {
              name: currentUser,
              email: userEmail,
              availability
            }
          ]
        }),
      });

      const data: EventData = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        throw new Error(errorData.error || errorData.message || 'Failed to update event');
      }

      setEventData(data);
      
      toast({
        title: "Changes saved",
        description: "Your availability has been updated",
        duration: 2000,
      });
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error saving:', error);
      toast({
        title: "Error",
        description: apiError?.message || "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add mouse state handlers alongside touch state
  const handleMouseDown = (date: string, timestamp: number, currentValue: boolean) => {
    if (viewMode === 'everyone') return;
    
    setIsDragging(true);
    setDragValue(!currentValue);
    
    // Update initial slot
    const newSelectedTimeSlots = {
      ...selectedTimeSlots,
      [date]: {
        ...selectedTimeSlots[date],
        [timestamp]: !currentValue
      }
    };
    setSelectedTimeSlots(newSelectedTimeSlots);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragValue === null) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const slotElement = elements.find(el => el.hasAttribute('data-slot'));
    
    if (slotElement) {
      const currentSlot = slotElement.getAttribute('data-slot')!;
      if (currentSlot === lastTouchedSlot) return;
      
      setLastTouchedSlot(currentSlot);

      const rect = slotElement.getBoundingClientRect();
      const slotCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const elementsInPath = document.elementsFromPoint(slotCenter.x, slotCenter.y);
      const slotElements = elementsInPath
        .filter(el => el.hasAttribute('data-slot'))
        .map(el => el.getAttribute('data-slot')!);

      const newSelectedTimeSlots = { ...selectedTimeSlots };
      slotElements.forEach(slotId => {
        const [slotDate, slotTimestamp] = slotId.split('|');
        if (!newSelectedTimeSlots[slotDate]) {
          newSelectedTimeSlots[slotDate] = {};
        }
        newSelectedTimeSlots[slotDate][slotTimestamp] = dragValue;
      });

      setSelectedTimeSlots(newSelectedTimeSlots);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragValue(null);
    
    // Send the complete update
    if (isSignedIn && debouncedSubmitRef.current) {
      debouncedSubmitRef.current.flush();
      submitAvailability(selectedTimeSlots);
    }
  };

  // First, update the isResponseLimitReached function to handle the initial state
  const isResponseLimitReached = () => {
    if (!eventData?.responseLimit) return false;
    return eventData.responses.length >= eventData.responseLimit;
  };

  // Add new interface for selected users
  interface SelectedUsers {
    [key: string]: boolean;
  }

  // Add new state for selected users
  const [selectedUsers, setSelectedUsers] = useState<SelectedUsers>({});
  const [, setIsFilteringUsers] = useState(false);

  // Add this helper function to check if any users are selected
  const hasSelectedUsers = () => Object.values(selectedUsers).some(selected => selected);

  // Add this helper function
  const isPasswordRequired = () => {
    return !!eventData?.responseLimit; // Returns true if responseLimit exists
  };

  // Add effect to manage loading state
  useEffect(() => {
    if (isDataLoaded && isUserSessionLoaded) {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded, isUserSessionLoaded]);

  // Show loading state while any required data is loading
  if (isLoading || !isDataLoaded || !isUserSessionLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6 flex items-center justify-center">
        <div>Event not found</div>
      </div>
    );
  }

  if (!isSignedIn && eventData.responses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="container mx-auto px-4 min-h-screen flex flex-col items-center justify-center gap-8">
          {/* Title Section with Copy Button */}
          <div className="text-center space-y-2 relative w-full">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-bold">
                {eventData.name}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyEventLink}
                className="h-8 w-8 rounded-full hover:bg-gray-800 transition-all duration-200 
                  active:scale-90 focus:ring-2 focus:ring-gray-500"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-gray-400 text-sm sm:text-base">
              {formatDateRange(eventData.selectedDates)}
            </p>
            {eventData.responseLimit > 0 && (
              <p className="text-gray-400 text-sm sm:text-base">
                This event is limited to {eventData.responseLimit} {eventData.responseLimit === 1 ? 'response' : 'responses'}.
                </p>
            )}
          </div>

          {/* Sign In Button with Rainbow Animation */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 
              rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 
              group-hover:duration-200 animate-rainbow-border"></div>
            <Button 
              variant="outline"
              onClick={() => setShowSignIn(true)}
              className="relative flex items-center gap-2 px-6 h-12 bg-gray-950 
                border-2 border-transparent rounded-lg font-semibold
                hover:bg-gray-900/80 transition-all duration-200"
            >
              <LogIn className="w-5 h-5" />
              <span>Get Started</span>
            </Button>
          </div>
        </div>

        <SignInDialog
          open={showSignIn}
          onOpenChange={setShowSignIn}
          onSignIn={async (userName: string, password: string) => {
            // Check if this is a new user when response limit is reached
            const isNewUser = !eventData.responses.some(r => r.name === userName);
            
            if (isResponseLimitReached() && isNewUser) {
              setSignInError('This event has reached its response limit and is not accepting new participants.');
              return false;
            }
            
            setUserName(userName);
            setPassword(password);
            const success = await handleSignIn();
            if (success) {
              setShowSignIn(false);
              window.location.reload();
            }
            return success;
          }}
          eventId={eventData.id}
          error={signInError}
          isLocked={isResponseLimitReached()}
          requiresPassword={isPasswordRequired()}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-6">
        <div className="flex flex-col gap-6 sm:gap-4 md:flex-row md:justify-between md:items-center py-4 sm:py-0">
          <div className="pt-2 sm:pt-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center md:text-left">
              {eventData.name}
            </h1>
            <p className="text-gray-400 text-sm text-center md:text-left mt-1">
              {formatDateRange(eventData.selectedDates)}
            </p>
            {eventData.responseLimit > 0 && (
              <p className="text-gray-400 text-sm text-center md:text-left mt-1">
                This event {isResponseLimitReached() 
                  ? `was limited to ${eventData.responseLimit} ${eventData.responseLimit === 1 ? 'response' : 'responses'}${isSignedIn ? ' and is now locked' : ''}`
                  : `is limited to ${eventData.responseLimit} ${eventData.responseLimit === 1 ? 'response' : 'responses'}`
                }.
              </p>
            )}
            {isSignedIn && (
              <p className="text-green-500 text-sm text-center md:text-left mt-1">
                Autosave is turned on.
              </p>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2 bg-gray-900 px-4 h-10 rounded-md">
              <div className={`w-2 h-2 rounded-full ${
                isSignedIn 
                  ? 'bg-green-500' 
                  : isResponseLimitReached()
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`} />
              <span className="text-gray-400 truncate">
                {isSignedIn ? (
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Signed in as</span>
                    <span className="font-medium text-white truncate">{currentUser}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white -mr-1"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : isResponseLimitReached() ? (
                  "Event Locked"
                ) : (
                  "Signed out"
                )}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isSignedIn ? (
                <>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 px-4 h-10 bg-gray-900/50"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Describe Availability</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 px-4 h-10 bg-gray-900/50"
                    onClick={copyEventLink}
                  >
                    <Copy className={`h-4 w-4 ${
                      isCopying 
                        ? 'scale-125 text-green-500 transition-all duration-200' 
                        : 'transition-all duration-200'
                    }`} />
                    <span>Copy Link</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline"
                    className="flex items-center gap-2 px-4 h-10 bg-gray-900/50"
                    onClick={() => setShowSignIn(true)}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {isResponseLimitReached() 
                        ? "Modify Existing Response" 
                        : "Add Your Name To Reply"}
                    </span>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 px-4 h-10 bg-gray-900/50"
                    onClick={copyEventLink}
                  >
                    <Copy className={`h-4 w-4 ${
                      isCopying 
                        ? 'scale-125 text-green-500 transition-all duration-200' 
                        : 'transition-all duration-200'
                    }`} />
                    <span>Copy Link</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_400px]">
          <Card className="bg-gray-900 border-gray-800 order-2 lg:order-1 overflow-hidden px-6">
            <CardHeader className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 sm:gap-6 pb-6">
              <CardTitle className="flex items-center gap-2 self-center sm:self-start">
                <Clock className="w-5 h-5" />
                <span>Availability</span>
              </CardTitle>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
                <div dir="ltr" data-orientation="horizontal" className="flex justify-center sm:justify-start">
                  <Tabs 
                    value={viewMode} 
                    onValueChange={(value) => setViewMode(value as ViewMode)}
                    defaultValue={isSignedIn ? 'personal' : 'everyone'}
                  >
                    <TabsList className="inline-flex h-9 items-center justify-center rounded-lg p-1 text-muted-foreground bg-gray-800">
                      <TabsTrigger 
                        value="personal" 
                        disabled={!isSignedIn}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium 
                          ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 
                          focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
                          data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
                      >
                        Personal
                      </TabsTrigger>
                      <TabsTrigger 
                        value="everyone"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium 
                          ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 
                          focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
                          data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
                      >
                        {hasSelectedUsers() ? "Selected Responses" : "Everyone"}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <Select value={userTimezone} onValueChange={handleTimezoneChange}>
                  <SelectTrigger 
                    className="flex h-9 items-center justify-between whitespace-nowrap rounded-md border px-3 py-2 text-sm 
                      shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 
                      focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 
                      w-[180px] bg-gray-800 border-gray-700"
                  >
                    <SelectValue placeholder="Select timezone">
                      {US_TIMEZONES.find(tz => tz.value === userTimezone)?.label}
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
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto -mx-6">
                <div 
                  ref={scrollContainerRef}
                  className="min-w-[calc(44px*var(--num-days))] sm:min-w-[640px] max-h-[600px] overflow-y-auto"
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-0">
                    {/* Time labels column - make more compact on mobile */}
                    <div className="pt-10 sm:pt-12 border-r border-gray-800 bg-gray-900/50">
                      {allTimeSlots.map((slot) => (
                        <div 
                          key={slot.timestamp} 
                          className={`
                            text-xs sm:text-sm h-6 sm:h-8 flex items-center justify-end pr-2 sm:pr-4
                            ${new Date(slot.timestamp).getMinutes() === 0
                              ? 'text-white font-medium whitespace-nowrap'
                              : 'text-gray-500 whitespace-nowrap'} 
                            relative w-full
                          `}
                        >
                          <span className="relative z-10 bg-gray-900 px-1 sm:px-2 min-w-[70px] sm:min-w-[90px] text-right">
                            {slot.time}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Calendar grid - make more compact on mobile */}
                    <div 
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${eventData.selectedDates.length}, minmax(44px, 1fr))`
                      }}
                    >
                      {eventData.selectedDates.map((date) => (
                        <div key={date.toString()}>
                          <div className="h-10 sm:h-12 text-xs sm:text-sm font-medium flex items-center justify-center sticky top-0 bg-gray-900 z-10 border-b border-gray-800">
                            {format(new Date(date), 'EEE MMM d')}
                          </div>
                          <div className="flex flex-col">
                            {generateTimeSlotsForTimezone(new Date(date)).map((slot) => {
                              const availableResponses = getAvailabilityDetails(format(new Date(date), 'yyyy-MM-dd'), slot.timestamp.toString());
                      
                              return (
                                <div
                                  key={slot.timestamp}
                                  data-slot={`${format(new Date(date), 'yyyy-MM-dd')}|${slot.timestamp}`}
                                  className={`
                                    relative 
                                    ${viewMode === 'everyone' ? 'cursor-default' : 'cursor-pointer'}
                                    border-t border-gray-800
                                    ${isHourMark(slot.timestamp) ? 'border-t-2 border-gray-700' : ''} 
                                    ${getTimeSlotColor(format(new Date(date), 'yyyy-MM-dd'), slot.timestamp)}
                                    h-6 sm:h-8 transition-all duration-200
                                    touch-none
                                    select-none
                                  `}
                                  onClick={() => handleTimeSlotClick(format(new Date(date), 'yyyy-MM-dd'), slot.timestamp)}
                                  onTouchStart={(e) => handleTouchStart(
                                    format(new Date(date), 'yyyy-MM-dd'),
                                    slot.timestamp,
                                    !!selectedTimeSlots[format(new Date(date), 'yyyy-MM-dd')]?.[slot.timestamp],
                                    e
                                  )}
                                  onMouseDown={() => handleMouseDown(
                                    format(new Date(date), 'yyyy-MM-dd'),
                                    slot.timestamp,
                                    !!selectedTimeSlots[format(new Date(date), 'yyyy-MM-dd')]?.[slot.timestamp]
                                  )}
                                >
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="absolute inset-0" />
                                      </TooltipTrigger>
                                      <TooltipContent 
                                        side="right" 
                                        className="max-w-[300px] bg-gray-700/50 backdrop-blur-sm text-white"
                                      >
                                        <p className="font-medium">{slot.time}</p>
                                        {viewMode === 'everyone' && (
                                          <div className="text-sm">
                                            {availableResponses.length > 0 ? (
                                              <div className="flex items-center gap-1">
                                                <span className="font-medium">Available:</span>
                                                <span>
                                                  {availableResponses.map((response, idx) => (
                                                    <span key={idx}>
                                                      {response.name}
                                                      {idx < availableResponses.length - 1 ? ', ' : ''}
                                                    </span>
                                                  ))}
                                                </span>
                                              </div>
                                            ) : (
                                              <p>No one available</p>
                                            )}
                                          </div>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>Responses ({eventData.responses.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventData.responses.length === 0 ? (
                  <p className="text-gray-400 text-sm">No responses yet</p>
                ) : (
                  <div className="space-y-2">
                    {eventData.responses.map((response) => {
                      const lastUpdated = response.availability
                        ?.map(a => a.timestamp)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

                      return (
                        <div 
                          key={response.name} 
                          onClick={() => {
                            setSelectedUsers(prev => ({
                              ...prev,
                              [response.name]: !prev[response.name]
                            }));
                            setIsFilteringUsers(true);
                          }}
                          className={`
                            text-sm flex items-baseline gap-1.5 p-2 rounded-md transition-all
                            cursor-pointer hover:bg-gray-800
                            ${selectedUsers[response.name] ? 'bg-gray-800 ring-1 ring-blue-500' : ''}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`
                              w-2 h-2 rounded-full transition-all
                              ${selectedUsers[response.name] ? 'bg-blue-500' : 'bg-gray-600'}
                            `} />
                            <span className={`font-medium ${selectedUsers[response.name] ? 'text-blue-400' : ''}`}>
                              {response.name}
                            </span>
                          </div>
                          {response.name === currentUser && (
                            <span className="text-xs text-gray-400">(You)</span>
                          )}
                          {lastUpdated && (
                            <span className="text-xs text-gray-400">
                              (Last updated {getTimeAgo(lastUpdated)})
                            </span>
                          )}
                          {response.email && (
                            <span className="text-gray-400 text-xs">({response.email})</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>Best Times</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!eventData.responses.some(response => 
                  response.availability && response.availability.some(slot => slot.available)
                ) ? (
                  <p className="text-gray-400 text-sm">
                    {isResponseLimitReached() 
                      ? "No availability has been added to this event yet."
                      : "Add your name to add your availability."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {eventData.selectedDates.some(date => {
                      const timeSlots = generateTimeSlotsForTimezone(new Date(date));
                      const availabilityMap = timeSlots.map(slot => ({
                        timestamp: slot.timestamp,
                        time: slot.time,
                        available: getAvailabilityDetails(format(new Date(date), 'yyyy-MM-dd'), slot.timestamp.toString()).length,
                        total: eventData.responses.length
                      }));

                      // Check if any slots meet the majority threshold (51%)
                      return availabilityMap.some(slot => (slot.available / slot.total) >= 0.51);
                    }) ? (
                      // Existing best times display logic
                      eventData.selectedDates.map((date) => {
                        const timeSlots = generateTimeSlotsForTimezone(new Date(date));
                        const availabilityMap = timeSlots.map(slot => ({
                          timestamp: slot.timestamp,
                          time: slot.time,
                          available: getAvailabilityDetails(format(new Date(date), 'yyyy-MM-dd'), slot.timestamp.toString()).length,
                          total: eventData.responses.length
                        }));

                        // Filter for slots where at least 51% of people are available
                        const bestSlots = availabilityMap.filter(slot => 
                          (slot.available / slot.total) >= 0.51
                        );

                        if (bestSlots.length === 0) return null;

                        // Group consecutive time slots
                        const groups: Array<{
                          startTime: string;
                          endTime: string;
                          available: number;
                          total: number;
                        }> = [];
                        
                        let currentGroup: typeof groups[0] | null = null;

                        bestSlots.forEach((slot, index) => {
                          const prevSlot = bestSlots[index - 1];
                          
                          if (prevSlot && 
                              slot.available === prevSlot.available && 
                              slot.timestamp - prevSlot.timestamp === 15 * 60 * 1000) {
                            if (currentGroup) {
                              currentGroup.endTime = slot.time;
                            }
                          } else {
                            if (currentGroup) {
                              groups.push(currentGroup);
                            }
                            currentGroup = {
                              startTime: slot.time,
                              endTime: slot.time,
                              available: slot.available,
                              total: slot.total
                            };
                          }
                        });

                        if (currentGroup) {
                          groups.push(currentGroup);
                        }

                        return (
                          <div key={date.toString()} className="space-y-2">
                            <p className="text-sm font-medium">
                              {format(new Date(date), 'EEEE, MMMM d')}
                            </p>
                            <div className="space-y-1.5">
                              {groups.map((group, idx) => (
                                <div 
                                  key={idx}
                                  className="text-sm flex items-center gap-2"
                                >
                                  <span className="text-gray-400">
                                    {formatTimeRange(group.startTime, group.endTime)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({group.available}/{group.total} available)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 text-sm">
                        No timeframe works for the majority of people.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <SignInDialog
        open={showSignIn}
        onOpenChange={setShowSignIn}
        onSignIn={async (userName: string, password: string) => {
          // Check if this is a new user when response limit is reached
          const isNewUser = !eventData.responses.some(r => r.name === userName);
          
          if (isResponseLimitReached() && isNewUser) {
            setSignInError('This event has reached its response limit and is not accepting new participants.');
            return false;
          }
          
          setUserName(userName);
          setPassword(password);
          const success = await handleSignIn();
          if (success) {
            setShowSignIn(false);
            window.location.reload();
          }
          return success;
        }}
        eventId={eventData.id}
        error={signInError}
        isLocked={isResponseLimitReached()}
        requiresPassword={isPasswordRequired()}
      />
      <UploadCalendarDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        eventData={{ selectedDates: eventData.selectedDates.map(date => format(date, 'yyyy-MM-dd')) }}
        onAnalyzeComplete={(newTimeSlots) => {
          console.log('DEBUG - Received time slots:', newTimeSlots);
          setSelectedTimeSlots(newTimeSlots);
          if (isSignedIn && debouncedSubmitRef.current) {
            debouncedSubmitRef.current(newTimeSlots);
          }
        }}
      />
    </div>
  );
};

export default EventViewPage;
