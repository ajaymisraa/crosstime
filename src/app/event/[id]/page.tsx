// app/event/[id]/page.tsx
import EventViewPage from '@/components/EventViewPage'

export const metadata = {
  title: 'Event Details | Schedule Maker',
  description: 'View and respond to event availability',
}

export default function Page() {
  return <EventViewPage />
}