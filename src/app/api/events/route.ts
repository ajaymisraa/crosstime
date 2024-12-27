import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Function to generate random string
const generateRandomId = () => {
  return crypto.randomBytes(10).toString('hex'); // 20 characters
};

// Add interface for response type
interface EventResponse {
  name: string;
  email?: string;
}

export async function POST(request: Request) {
  try {
    const { db } = await connectToDatabase();
    
    const data = await request.json();
    
    // Define required fields
    const requiredFields = [
      'id',
      'name',
      'selectedDates',
      'startTime',
      'endTime',
      'timezone',
      'timeSlots'
    ];

    // Check each required field
    const missingFields = requiredFields.filter(field => {
      if (field === 'timezone') {
        return !data[field]?.value || !data[field]?.label;
      }
      return !data[field] || 
        (Array.isArray(data[field]) && data[field].length === 0);
    });

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          receivedData: data
        }, 
        { status: 400 }
      );
    }

    // Add creation timestamp
    const eventData = {
      ...data,
      createdAt: new Date(),
    };
    
    const result = await db.collection('events').insertOne(eventData);
    
    return NextResponse.json({ 
      id: result.insertedId,
      ...eventData
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event: ' + (error as Error).message }, 
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    let currentUser = '';
    const cookieStore = await cookies();
const token = cookieStore.get(`auth_token_${id}`);
    
    if (token) {
      try {
        const decoded = verify(token.value, JWT_SECRET) as { userName: string };
        currentUser = decoded.userName;
      } catch (error) {
        console.error('Token verification failed:', error);
      }
    }

    const { db } = await connectToDatabase();
    const events = db.collection('events');
    const event = await events.findOne({ id });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Fix any type with proper interface
    if (event.hideResponses) {
      event.responses = event.responses.map((response: EventResponse) => {
        if (response.name.toLowerCase() === currentUser.toLowerCase()) {
          return response;
        } else {
          return {
            ...response,
            name: generateRandomId(),
            email: ''
          };
        }
      });
    }

    return NextResponse.json(event);

  } catch (error) {
    console.error('Error in GET /api/events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const eventData = await req.json();
    const cookieStore = await cookies();
    const authToken = cookieStore.get(`auth_token_${eventData.id}`);

    if (!authToken?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    verify(authToken.value, JWT_SECRET) as { userName: string };

    const { db } = await connectToDatabase();

    const result = await db.collection('events').findOneAndUpdate(
      { id: eventData.id },
      { $set: eventData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event: ' + (error as Error).message },
      { status: 500 }
    );
  }
}