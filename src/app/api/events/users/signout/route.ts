import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      { message: 'Successfully signed out' },
      { status: 200 }
    );

    // Delete cookie with the same options it was set with
    response.cookies.delete(`auth_token_${eventId}`);

    return response;

  } catch (error: unknown) {
    console.error('Error in POST /api/events/users/signout:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign out';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}