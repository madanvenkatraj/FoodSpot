'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function validateFirestoreConnection(): Promise<void> {
  if (typeof window === 'undefined' || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void validateFirestoreConnection();
}

export interface CustomerGoogleAuthResult {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  idToken: string;
}

/**
 * Authenticates a user exclusively for the Customer App workspace using Firebase Google Auth.
 */
export async function signInCustomerWithGoogle(): Promise<CustomerGoogleAuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;

  if (!user.email) {
    throw new Error('Google account did not provide a valid email address.');
  }

  const uid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const email = user.email.trim().toLowerCase().slice(0, 254);
  const displayName = (user.displayName || email.split('@')[0] || 'FoodHub Customer')
    .trim()
    .slice(0, 120);
  const photoURL = (user.photoURL || '').trim().slice(0, 1024);
  const profilePath = `customerProfiles/${uid}`;
  const profileRef = doc(db, 'customerProfiles', uid);

  try {
    const existingSnap = await getDoc(profileRef);
    if (!existingSnap.exists()) {
      await setDoc(profileRef, {
        uid,
        email,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        workspace: 'customer',
        pushNotificationsEnabled:
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(profileRef, {
        displayName,
        ...(photoURL ? { photoURL } : {}),
        pushNotificationsEnabled:
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    // Log structured Firestore error info if permissions or schema check failed,
    // without blocking Customer App session creation
    try {
      handleFirestoreError(err, OperationType.WRITE, profilePath);
    } catch {
      // handled
    }
  }

  const idToken = await user.getIdToken();

  return {
    uid,
    email,
    displayName,
    photoURL,
    emailVerified: user.emailVerified,
    idToken,
  };
}

export async function signOutFirebaseCustomer(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // ignore signout error
  }
}
