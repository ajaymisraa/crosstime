// app/page.tsx
import EventCreationPage from '@/components/EventCreationPage'

export const metadata = {
  title: 'Create Event | Schedule Maker',
  description: 'Create a new event and find the perfect time to meet',
}

export default function Page() {
  return (
    <main>
      <EventCreationPage />
    </main>
  )
}