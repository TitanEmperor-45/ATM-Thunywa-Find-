import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-remixatmthunywa-5f31a6c1-61dd-4119-864e-a5f4ddcaa571';
export const db = getFirestore(app, databaseId);
export const auth = getAuth();
