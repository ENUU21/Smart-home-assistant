import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  DocumentData,
  deleteDoc,
  doc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ESP32Data, HistoryDataPoint } from '../types';

// Initialize Firebase App
const app = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
// Use the custom database ID if available (ai-studio-kittensmarthomea-...)
export const customDb = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : null;

export const defaultDb = getFirestore(app);

// Default to the (default) database so that Spark plan users are connected and operational on startup!
let currentDb = defaultDb;

/**
 * Updates the active Firestore database target.
 */
export function setFirestoreDatabaseTarget(target: 'default' | 'custom') {
  if (target === 'custom' && customDb) {
    currentDb = customDb;
  } else {
    currentDb = defaultDb;
  }
}

/**
 * Returns the ID of the currently active Firestore database.
 */
export function getActiveDatabaseId(): string {
  if (customDb && currentDb === customDb && firebaseConfig.firestoreDatabaseId) {
    return firebaseConfig.firestoreDatabaseId;
  }
  return '(default)';
}

/**
 * Runs a Firestore operation with an automatic fallback to the (default) database 
 * if a permission or lookup error occurs on the custom database.
 */
async function runWithFallback<T>(
  operation: (dbInstance: any) => Promise<T>,
  operationType: OperationType,
  path: string
): Promise<T> {
  try {
    return await operation(currentDb);
  } catch (error: any) {
    const isPermissionError = 
      error?.code === 'permission-denied' || 
      error?.message?.includes('permission') || 
      error?.message?.includes('insufficient');
      
    if (customDb && currentDb === customDb && isPermissionError) {
      console.warn('[Firebase] Operation failed on custom database. Falling back to (default) database...');
      currentDb = defaultDb;
      try {
        return await operation(currentDb);
      } catch (fallbackError) {
        handleFirestoreError(fallbackError, operationType, path);
      }
    }
    handleFirestoreError(error, operationType, path);
  }
}

// Error Handling Infrastructure from Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves a new telemetry log to the Firestore "telemetry" collection.
 */
export async function saveTelemetry(data: Omit<ESP32Data, 'voice'> & { voice?: boolean }) {
  const path = 'telemetry';
  return runWithFallback(async (dbInstance) => {
    const telemetryCollection = collection(dbInstance, path);
    const docRef = await addDoc(telemetryCollection, {
      temperature: data.temperature,
      motion: data.motion,
      led: data.led,
      fan: data.fan,
      auto: data.auto,
      voice: data.voice ?? false,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  }, OperationType.WRITE, path);
}

/**
 * Saves a telemetry snapshot, handling any errors gracefully.
 * This is an alias for saveTelemetry to maintain compatibility.
 */
export async function logTelemetry(data: Omit<ESP32Data, 'voice'> & { voice?: boolean }) {
  return saveTelemetry(data);
}

/**
 * Fetches the recent telemetry records to build the analytics history graph.
 */
export async function getRecentTelemetry(limitCount: number = 15): Promise<HistoryDataPoint[]> {
  const path = 'telemetry';
  return runWithFallback(async (dbInstance) => {
    const telemetryCollection = collection(dbInstance, path);
    const q = query(telemetryCollection, orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    const points: HistoryDataPoint[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let timeStr = '';
      if (data.timestamp) {
        const date = typeof data.timestamp.toDate === 'function' 
          ? data.timestamp.toDate() 
          : new Date(data.timestamp);
        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } else {
        timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      points.push({
        time: timeStr,
        temperature: Number(data.temperature ?? 24),
        motion: data.motion ? 1 : 0,
        led: Number(data.led ?? 0),
        fan: Number(data.fan ?? 0),
      });
    });

    return points.reverse();
  }, OperationType.GET, path);
}

/**
 * Subscribes to real-time telemetry updates. Calls the callback with the latest document.
 * Returns the unsubscribe function.
 */
export function subscribeToLatestTelemetry(onUpdate: (data: ESP32Data & { id: string }) => void) {
  const path = 'telemetry';
  let unsubscribe: (() => void) | null = null;
  let isCancelled = false;

  const startSubscription = (dbInstance: any) => {
    // Unsubscribe from previous subscription if exists
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (e) {
        // silent catch
      }
    }

    const telemetryCollection = collection(dbInstance, path);
    const q = query(telemetryCollection, orderBy('timestamp', 'desc'), limit(1));

    unsubscribe = onSnapshot(q, (snapshot) => {
      if (isCancelled) return;
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        onUpdate({
          id: doc.id,
          temperature: Number(data.temperature ?? 24),
          motion: Boolean(data.motion),
          led: Number(data.led ?? 0),
          fan: Number(data.fan ?? 0),
          auto: Boolean(data.auto),
          voice: Boolean(data.voice),
        });
      }
    }, (error) => {
      if (isCancelled) return;
      
      const isPermissionError = 
        error?.code === 'permission-denied' || 
        error?.message?.includes('permission') || 
        error?.message?.includes('insufficient');
        
      if (customDb && dbInstance === customDb && isPermissionError) {
        console.warn('[Firebase] Subscription failed on custom database. Falling back to (default) database...');
        currentDb = defaultDb;
        startSubscription(currentDb);
      } else {
        handleFirestoreError(error, OperationType.GET, path);
      }
    });
  };

  startSubscription(currentDb);

  return () => {
    isCancelled = true;
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

/**
 * Prunes old telemetry documents to keep only the most recent N documents.
 * This runs to keep the database compact, responsive, and within free quotas.
 */
export async function pruneOldTelemetry(keepCount: number = 100): Promise<number> {
  const path = 'telemetry';
  return runWithFallback(async (dbInstance) => {
    const telemetryCollection = collection(dbInstance, path);
    // Fetch all documents ordered by timestamp descending
    const q = query(telemetryCollection, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.size > keepCount) {
      const docsToDelete = querySnapshot.docs.slice(keepCount);
      console.log(`[Firebase] Pruning ${docsToDelete.length} old telemetry records to keep max of ${keepCount}...`);
      
      const deletePromises = docsToDelete.map((docSnap) => 
        deleteDoc(doc(dbInstance, path, docSnap.id))
      );
      
      await Promise.all(deletePromises);
      return docsToDelete.length;
    }
    return 0;
  }, OperationType.DELETE, path);
}

export { currentDb as db };
