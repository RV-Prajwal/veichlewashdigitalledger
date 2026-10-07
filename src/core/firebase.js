// src/core/firebase.js
// Firebase initialization — single instance for the whole app
// Supports real Firebase Firestore as well as offline/local demo storage mode

import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'undefined' &&
  firebaseConfig.projectId
)

let app = null
let authInstance = null
let dbInstance = null
let storageInstance = null

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    authInstance = getAuth(app)
    dbInstance = getFirestore(app)
    storageInstance = getStorage(app)

    // Enable offline persistence (writes cache locally first → < 2s guarantee)
    enableMultiTabIndexedDbPersistence(dbInstance).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: multiple tabs open — persistence enabled in first tab only.')
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence: browser does not support IndexedDB.')
      }
    })
  } catch (err) {
    console.warn('Failed to initialize Firebase with provided credentials, falling back to local mode:', err)
  }
} else {
  console.info('Firebase environment variables not detected. Running in high-performance local demo mode (persisted to localStorage & IndexedDB).')
}

export const auth = authInstance
export const db = dbInstance
export const storage = storageInstance
export default app
