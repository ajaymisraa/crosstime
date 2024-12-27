import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sign, verify } from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Add interface for event response
interface EventResponse {
  name: string;
  password: string | null;
  email: string;
  availability: Array<{
    date: string;
    time: string;
    available: boolean;
  }>;
}

interface NewEventResponse extends EventResponse {
  createdAt: Date;
}

// Add this interface near the top with other interfaces
interface EventDocument {
  id: string;
  responses: NewEventResponse[];
  responseLimit?: number;
  hideResponses?: boolean;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const authToken = cookieStore.get(`auth_token_${eventId}`);
    
    if (!authToken?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      );
    }

    try {
      const decoded = verify(authToken.value, JWT_SECRET) as { userName: string };
      return NextResponse.json({ userName: decoded.userName });
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error: unknown) {
    console.error('Error in GET /api/events/users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { eventId, userName, password, isResponseLimited } = await req.json();
    console.log('POST /api/events/users - Request received:', { 
      eventId, 
      userName, 
      hasPassword: !!password,
      isResponseLimited
    });

    if (!eventId || !userName) {
      console.log('Validation Error:', { 
        eventId: !!eventId, 
        userName: userName,
        reason: 'Missing required fields'
      });
      return NextResponse.json(
        { error: 'Event ID and username are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const events = db.collection<EventDocument>('events');

    const event = await events.findOne({ id: eventId });
    
    if (!event) {
      console.log('Event Not Found:', { 
        eventId,
        reason: 'No event matches the provided ID'
      });
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Double-check response limit and password requirement
    if (event.responseLimit && !password) {
      console.log('Validation Error:', {
        eventId,
        userName,
        reason: 'Password required for response-limited event'
      });
      return NextResponse.json(
        { error: 'Password is required for response-limited events' },
        { status: 400 }
      );
    }

    const existingResponse = event.responses?.find(
      (r: EventResponse) => r.name.toLowerCase() === userName.toLowerCase()
    );

    // If user exists, validate password for response-limited events
    if (existingResponse) {
      if (event.responseLimit) {
        if (!password) {
          console.log('Authentication Failed:', {
            reason: 'Password required but not provided',
            userName,
            eventId
          });
          return NextResponse.json(
            { error: 'Password required for this response-limited event' },
            { status: 401 }
          );
        }
        
        if (existingResponse.password !== password) {
          console.log('Authentication Failed:', {
            reason: 'Password mismatch',
            userName,
            eventId
          });
          return NextResponse.json(
            { error: 'Incorrect password' },
            { status: 401 }
          );
        }
      }
    } else {
      // New user - ensure password for response-limited events
      if (event.responseLimit && !password) {
        console.log('Validation Error:', {
          eventId,
          userName,
          reason: 'Password required for new response in limited event'
        });
        return NextResponse.json(
          { error: 'Password is required for response-limited events' },
          { status: 400 }
        );
      }

      const newResponse: NewEventResponse = {
        name: userName,
        password: event.responseLimit ? password : (password || null), // Ensure password is set for limited events
        email: '',
        availability: [],
        createdAt: new Date()
      };

      console.log('Creating New User:', {
        userName,
        eventId,
        hasPassword: !!password,
        timestamp: newResponse.createdAt
      });

      try {
        await events.updateOne(
          { id: eventId },
          { $push: { responses: newResponse } }
        );
      } catch (dbError) {
        console.error('Database Error during user creation:', {
          error: dbError,
          userName,
          eventId
        });
        throw dbError;
      }
    }

    const token = sign(
      { userName, eventId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const response = NextResponse.json({ 
      userName,
      message: 'Successfully signed in'
    });

    response.cookies.set({
      name: `auth_token_${eventId}`,
      value: token,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 60 * 60 * 24
    });

    return response;

  } catch (error: unknown) {
    console.error('Critical Error in POST /api/events/users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}