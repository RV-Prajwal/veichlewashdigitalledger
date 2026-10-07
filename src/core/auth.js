// src/core/auth.js — Auth helpers with auto-provisioning and fallback support

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'

// Default Demo Users for testing
export const DEMO_USERS = [
  {
    uid: 'demo-admin-01',
    email: 'admin@washledger.com',
    password: 'admin',
    name: 'Admin Manager',
    role: 'admin',
    mobile: '9876543210',
    username: 'admin',
    status: 'active',
  },
  {
    uid: 'demo-worker-01',
    email: 'ravi@washledger.com',
    password: 'worker',
    name: 'Ravi Kumar',
    role: 'worker',
    mobile: '9876543211',
    username: 'ravi',
    status: 'active',
  },
  {
    uid: 'demo-worker-02',
    email: 'arun@washledger.com',
    password: 'worker',
    name: 'Arun Sharma',
    role: 'worker',
    mobile: '9876543212',
    username: 'arun',
    status: 'active',
  },
]

const LOCAL_SESSION_KEY = 'washledger_local_session'

let localAuthListeners = []

function notifyLocalAuth(user) {
  localAuthListeners.forEach((fn) => fn(user))
}

/**
 * Sign in and return the user's Firestore profile (includes role).
 * Automatically provisions accounts on first login so the user never gets stuck!
 */
export async function signIn(email, password, forceLocal = false) {
  const cleanEmail = email.trim().toLowerCase()
  const matchedDemo = DEMO_USERS.find((u) => u.email.toLowerCase() === cleanEmail)

  if (!forceLocal && isFirebaseConfigured && auth && db) {
    let cred = null
    try {
      // 1. Try standard sign-in
      cred = await signInWithEmailAndPassword(auth, cleanEmail, password)
    } catch (err) {
      console.warn('Initial Firebase signIn attempt:', err.code, err.message)

      // 2. If user doesn't exist yet in Firebase Auth, auto-register them
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-login-credentials'
      ) {
        try {
          // Firebase Auth requires password >= 6 chars; pad if needed
          const securePass = password.length >= 6 ? password : password + '123456'
          cred = await createUserWithEmailAndPassword(auth, cleanEmail, securePass)
          console.log('✓ Successfully auto-provisioned user in Firebase Auth:', cleanEmail)
        } catch (createErr) {
          if (createErr.code === 'auth/operation-not-allowed') {
            throw new Error(
              'Email/Password sign-in is not enabled in Firebase Console. Please go to Authentication → Sign-in method → enable Email/Password, or use Local Demo mode below.'
            )
          }
          // If already exists or error, throw clearer message
          throw new Error(`Firebase Auth: ${createErr.message}`)
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is not enabled in Firebase Console. Please go to Authentication → Sign-in method → enable Email/Password, or use Local Demo mode below.'
        )
      } else {
        throw err
      }
    }

    if (cred && cred.user) {
      // Retrieve or provision profile in Firestore 'workers' collection
      let profile = await getUserProfile(cred.user.uid)
      if (!profile) {
        const defaultRole = cleanEmail.includes('admin') ? 'admin' : 'worker'
        const defaultName = matchedDemo ? matchedDemo.name : cleanEmail.split('@')[0]
        profile = {
          id: cred.user.uid,
          name: defaultName,
          email: cleanEmail,
          role: defaultRole,
          username: cleanEmail.split('@')[0],
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        try {
          await setDoc(doc(db, 'workers', cred.user.uid), profile)
        } catch (setDocErr) {
          console.warn('Could not write worker profile to Firestore (check rules):', setDocErr)
        }
      }
      return { user: cred.user, profile }
    }
  }

  // ─── LOCAL STORAGE FALLBACK ──────────────────────────────────────────────
  const matched = matchedDemo || {
    uid: 'local-custom-' + Date.now(),
    email: cleanEmail,
    name: cleanEmail.split('@')[0],
    role: cleanEmail.includes('admin') ? 'admin' : 'worker',
    username: cleanEmail.split('@')[0],
    status: 'active',
  }

  const sessionData = {
    uid: matched.uid,
    email: matched.email,
    displayName: matched.name,
    role: matched.role,
  }
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionData))
  notifyLocalAuth(sessionData)
  return { user: sessionData, profile: matched }
}

/**
 * Fetch worker/admin profile.
 */
export async function getUserProfile(uid) {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, 'workers', uid))
      if (snap.exists()) return { id: snap.id, ...snap.data() }
    } catch (e) {
      console.warn('getUserProfile error:', e)
    }
    return null
  }

  const demoUser = DEMO_USERS.find((u) => u.uid === uid)
  return demoUser ? { id: demoUser.uid, ...demoUser } : null
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (isFirebaseConfigured && auth) {
    try {
      await firebaseSignOut(auth)
    } catch {}
  }
  localStorage.removeItem(LOCAL_SESSION_KEY)
  notifyLocalAuth(null)
}

/**
 * Subscribe to auth state changes.
 */
export function subscribeToAuth(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        callback(firebaseUser)
      } else {
        const saved = localStorage.getItem(LOCAL_SESSION_KEY)
        if (saved) {
          try {
            callback(JSON.parse(saved))
            return
          } catch {}
        }
        callback(null)
      }
    })
  }

  // Local auth listener
  localAuthListeners.push(callback)
  const saved = localStorage.getItem(LOCAL_SESSION_KEY)
  if (saved) {
    try {
      callback(JSON.parse(saved))
    } catch {
      callback(null)
    }
  } else {
    callback(null)
  }

  return () => {
    localAuthListeners = localAuthListeners.filter((fn) => fn !== callback)
  }
}
