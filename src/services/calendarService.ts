import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { auth } from '../firebaseConfig';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
];

const provider = new GoogleAuthProvider();
CALENDAR_SCOPES.forEach((scope) => {
  provider.addScope(scope);
});

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initCalendarAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const signInWithCalendar = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Calendar access token');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Calendar sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const calendarSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

export async function fetchCalendarEvents(): Promise<CalendarEventItem[]> {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('Google Calendar access token not available. Please sign in.');
  }

  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    now
  )}&maxResults=20&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch calendar events');
  }

  const data = await response.json();
  return data.items || [];
}

export async function createAtmVisitEvent(params: {
  atmName: string;
  address: string;
  startTime: string; // ISO string
  durationMinutes?: number;
  safetyTips?: string;
}): Promise<CalendarEventItem> {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('Google Calendar access token not available. Please sign in.');
  }

  const start = new Date(params.startTime);
  const end = new Date(start.getTime() + (params.durationMinutes || 30) * 60000);

  const eventPayload = {
    summary: `ATM Visit: ${params.atmName}`,
    location: params.address,
    description: `Safe ATM cash withdrawal appointment scheduled via ATM Thunywa.\n\nSafety Guidelines:\n- Avoid street ATMs after dark.\n- Cover keypad when entering PIN.\n- Never accept unsolicited help from strangers.\n\n${params.safetyTips || ''}`,
    start: {
      dateTime: start.toISOString()
    },
    end: {
      dateTime: end.toISOString()
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 10 }
      ]
    }
  };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to create calendar event');
  }

  return await response.json();
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('Google Calendar access token not available.');
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok && response.status !== 204) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to delete calendar event');
  }
}
