import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ATMData, INITIAL_ATMS, INITIAL_SECURITY_ZONES, SecurityZoneData } from '../data/initialData';

// Initialize and sync Firestore database with initial South African ATM and Zone data
export async function initializeFirestoreData() {
  try {
    const atmsCollection = collection(db, 'atms');
    const existingSnap = await getDocs(atmsCollection);

    if (existingSnap.empty) {
      console.log('Seeding initial South African ATMs to Firestore...');
      for (const atm of INITIAL_ATMS) {
        await setDoc(doc(db, 'atms', atm.id), {
          ...atm,
          lastUpdated: new Date().toISOString()
        });
      }
    } else {
      // Ensure existing documents in Firestore have accessibility, availableNotes, and minWithdrawal fields populated
      for (const docSnap of existingSnap.docs) {
        const data = docSnap.data();
        const matchInitial = INITIAL_ATMS.find((a) => a.id === docSnap.id);
        const updates: any = {};

        if (data.accessibility === undefined) {
          updates.accessibility = matchInitial?.accessibility ?? (data.type === 'Mall/Indoor (Secure)' || data.type === 'Branch/Bank Lobby');
        }
        if (!data.availableNotes) {
          updates.availableNotes = matchInitial?.availableNotes ?? (data.status === 'online' ? ['R50', 'R100', 'R200'] : []);
        }
        if (data.minWithdrawal === undefined) {
          updates.minWithdrawal = matchInitial?.minWithdrawal ?? (data.status === 'online' ? 50 : 0);
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'atms', docSnap.id), updates);
        }
      }
    }

    const zonesCollection = collection(db, 'securityZones');
    const zonesSnap = await getDocs(zonesCollection);
    if (zonesSnap.empty) {
      console.log('Seeding initial South African Security Zones to Firestore...');
      for (const zone of INITIAL_SECURITY_ZONES) {
        await setDoc(doc(db, 'securityZones', zone.id), zone);
      }
    }
  } catch (err) {
    console.warn('Firestore initial seeding notice (using client state fallback if offline):', err);
  }
}

export async function reportATMStatus(
  atmId: string,
  status: 'online' | 'offline',
  userId: string,
  notes?: string,
  availableNotes?: string[],
  waitTimeMinutes?: number
) {
  try {
    const atmRef = doc(db, 'atms', atmId);
    const updates: any = {
      status,
      notes: notes || (status === 'online' ? 'Reported online and dispensing cash' : 'Reported offline by community member'),
      lastUpdated: 'Just now'
    };

    if (availableNotes) {
      updates.availableNotes = availableNotes;
      const hasR20 = availableNotes.includes('R20');
      const hasR50 = availableNotes.includes('R50');
      const hasR100 = availableNotes.includes('R100');
      const hasR200 = availableNotes.includes('R200');

      if (hasR20) updates.minWithdrawal = 20;
      else if (hasR50) updates.minWithdrawal = 50;
      else if (hasR100) updates.minWithdrawal = 100;
      else if (hasR200) updates.minWithdrawal = 200;
      else updates.minWithdrawal = 0;
    }
    
    if (waitTimeMinutes !== undefined) {
      updates.estimatedWaitTimeMinutes = waitTimeMinutes;
    }

    await updateDoc(atmRef, updates);

    const reportsRef = collection(db, 'atms', atmId, 'reports');
    await addDoc(reportsRef, {
      atmId,
      userId: userId || 'community-guest',
      status,
      notes: notes || '',
      availableNotes: availableNotes || [],
      waitTimeMinutes: waitTimeMinutes ?? 0,
      timestamp: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error reporting ATM status to Firestore:', error);
    return { success: false, error };
  }
}
