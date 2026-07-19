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
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { ESP32Data, HistoryDataPoint, Song, TaskCompletion } from '../types';

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

// Initialize Storage
export const storage = getStorage(app);

// Initialize Firestore
// Use the custom database ID if available (ai-studio-kittensmarthomea-...)
export const customDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : null;

export const defaultDb = getFirestore(app);

// Use the custom database if present, otherwise fallback to the default database
let currentDb = customDb || defaultDb;

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
      humidity: data.humidity,
      motion: data.motion,
      led: data.led,
      fan: data.fan,
      humidifier: data.humidifier,
      auto: data.auto,
      voice: data.voice ?? false,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  }, OperationType.WRITE, path);
}

/**
 * Retrieves the latest control state from Firestore.
 * If it doesn't exist, initializes it with defaults.
 */
export async function getControlState(): Promise<Partial<ESP32Data> & { songUrl?: string; songName?: string; isPlaying?: boolean; volume?: number }> {
  const path = 'control';
  return runWithFallback(async (dbInstance) => {
    const controlDocRef = doc(dbInstance, path, 'esp32');
    const docSnap = await getDoc(controlDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        led: data.led !== undefined ? Number(data.led) : undefined,
        fan: data.fan !== undefined ? Number(data.fan) : undefined,
        humidifier: data.humidifier !== undefined ? Number(data.humidifier) : undefined,
        auto: data.auto !== undefined ? Boolean(data.auto) : undefined,
        voice: data.voice !== undefined ? Boolean(data.voice) : undefined,
        songUrl: data.songUrl,
        songName: data.songName,
        isPlaying: data.isPlaying,
        volume: data.volume,
      };
    } else {
      // Document does not exist (recreated database), initialize with default control values
      const initialControl = {
        led: 50,
        fan: 1,
        humidifier: 0,
        auto: true,
        voice: false,
        songUrl: '',
        songName: '',
        isPlaying: false,
        volume: 50,
      };
      await setDoc(controlDocRef, {
        ...initialControl,
        lastUpdated: serverTimestamp(),
      });
      return initialControl;
    }
  }, OperationType.GET, path);
}

/**
 * Saves the latest control state (LED, Fan, Auto, Voice, Song details) to a single known document.
 * This makes it simple for an ESP32 to retrieve controls with a direct read.
 */
export async function saveControlState(data: Partial<ESP32Data> & { songUrl?: string; songName?: string; isPlaying?: boolean; volume?: number }) {
  const path = 'control';
  return runWithFallback(async (dbInstance) => {
    const controlDoc = doc(dbInstance, path, 'esp32');
    
    const payload: Record<string, any> = {
      lastUpdated: serverTimestamp(),
    };

    if (data.led !== undefined) payload.led = Number(data.led);
    if (data.fan !== undefined) payload.fan = Number(data.fan);
    if (data.humidifier !== undefined) payload.humidifier = Number(data.humidifier);
    if (data.auto !== undefined) payload.auto = Boolean(data.auto);
    if (data.voice !== undefined) payload.voice = Boolean(data.voice);
    if (data.songUrl !== undefined) payload.songUrl = String(data.songUrl);
    if (data.songName !== undefined) payload.songName = String(data.songName);
    if (data.isPlaying !== undefined) payload.isPlaying = Boolean(data.isPlaying);
    if (data.volume !== undefined) payload.volume = Number(data.volume);

    await setDoc(controlDoc, payload, { merge: true });
  }, OperationType.WRITE, path);
}

/**
 * Saves an uploaded song's metadata to Firestore "songs" collection.
 */
export async function saveSongMetadata(song: Omit<Song, 'id'>): Promise<string> {
  const path = 'songs';
  return runWithFallback(async (dbInstance) => {
    const songsCollection = collection(dbInstance, path);
    const docRef = await addDoc(songsCollection, {
      name: song.name,
      desc: song.desc,
      url: song.url,
      path: song.path || '',
      uploadedAt: serverTimestamp(),
    });
    return docRef.id;
  }, OperationType.WRITE, path);
}

/**
 * Fetches the list of custom songs uploaded by the user from Firestore "songs" collection.
 */
export async function getSongsList(): Promise<Song[]> {
  const path = 'songs';
  return runWithFallback(async (dbInstance) => {
    const songsCollection = collection(dbInstance, path);
    const q = query(songsCollection, orderBy('uploadedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const songs: Song[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      songs.push({
        id: docSnap.id,
        name: String(data.name || 'Unnamed Track'),
        desc: String(data.desc || 'Uploaded Track'),
        url: String(data.url || ''),
        path: String(data.path || ''),
        uploadedAt: data.uploadedAt,
      });
    });
    return songs;
  }, OperationType.GET, path);
}

/**
 * Deletes a song document from Firestore.
 */
export async function deleteSongMetadata(id: string): Promise<void> {
  const path = 'songs';
  return runWithFallback(async (dbInstance) => {
    await deleteDoc(doc(dbInstance, path, id));
  }, OperationType.DELETE, path);
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
        temperature: (data.temperature !== null && data.temperature !== undefined) ? Number(data.temperature) : null,
        humidity: (data.humidity !== null && data.humidity !== undefined) ? Number(data.humidity) : null,
        motion: data.motion ? 1 : 0,
        led: Number(data.led ?? 0),
        fan: Number(data.fan ?? 0),
        humidifier: Number(data.humidifier ?? 0),
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
          temperature: (data.temperature !== null && data.temperature !== undefined) ? Number(data.temperature) : null,
          humidity: (data.humidity !== null && data.humidity !== undefined) ? Number(data.humidity) : null,
          motion: Boolean(data.motion),
          led: Number(data.led ?? 0),
          fan: Number(data.fan ?? 0),
          humidifier: Number(data.humidifier ?? 0),
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

/**
 * Saves or updates a task completion count for a specific date and task name.
 */
export async function saveTaskCompletion(taskName: string, dateStr: string, count: number): Promise<void> {
  const path = 'tasks';
  return runWithFallback(async (dbInstance) => {
    // Generate document ID as taskName + "_" + dateStr or use structured fields
    const docId = `${encodeURIComponent(taskName)}_${dateStr}`;
    const docRef = doc(dbInstance, path, docId);
    await setDoc(docRef, {
      taskName,
      date: dateStr,
      count: Number(count),
      lastUpdated: serverTimestamp()
    }, { merge: true });
  }, OperationType.WRITE, path);
}

/**
 * Fetches all task completions for a specific task name.
 */
export async function getTaskCompletions(taskName: string): Promise<TaskCompletion[]> {
  const path = 'tasks';
  return runWithFallback(async (dbInstance) => {
    const tasksCollection = collection(dbInstance, path);
    const querySnapshot = await getDocs(tasksCollection);
    const completions: TaskCompletion[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.taskName === taskName) {
        completions.push({
          date: String(data.date),
          count: Number(data.count),
          taskName: String(data.taskName),
        });
      }
    });
    return completions;
  }, OperationType.GET, path);
}

export { currentDb as db };
