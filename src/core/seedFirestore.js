// src/core/seedFirestore.js
// One-click Firestore database seeder for initial setup

import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth, isFirebaseConfigured } from './firebase'

export const SEED_DATA = {
  services: [
    { id: 'srv-car-basic', name: 'Car Basic Wash', vehicleType: 'car', price: 250, status: 'active' },
    { id: 'srv-car-prem',  name: 'Car Premium Wash', vehicleType: 'car', price: 350, status: 'active' },
    { id: 'srv-car-full',  name: 'Car Full Wash', vehicleType: 'car', price: 750, status: 'active' },
    { id: 'srv-bike-basic', name: 'Bike Basic Wash', vehicleType: 'bike', price: 100, status: 'active' },
    { id: 'srv-bike-prem',  name: 'Bike Premium Wash', vehicleType: 'bike', price: 150, status: 'active' },
    { id: 'srv-bike-full',  name: 'Bike Full Wash', vehicleType: 'bike', price: 200, status: 'active' },
  ],
  workers: [
    {
      id: 'worker-ravi',
      name: 'Ravi Kumar',
      username: 'ravi',
      role: 'worker',
      mobile: '9876543211',
      status: 'active',
    },
    {
      id: 'worker-arun',
      name: 'Arun Sharma',
      username: 'arun',
      role: 'worker',
      mobile: '9876543212',
      status: 'active',
    },
    {
      id: 'admin-manager',
      name: 'Admin Manager',
      username: 'admin',
      role: 'admin',
      mobile: '9876543210',
      status: 'active',
    },
  ],
  transactions: [
    {
      id: 'tx-1001',
      vehicleNumber: 'KA01NC8564',
      vehicleType: 'car',
      serviceId: 'srv-car-full',
      serviceName: 'Car Full Wash',
      amount: 750,
      hour: 8,
      workerId: 'worker-ravi',
      workerName: 'Ravi Kumar',
      ocrConfidence: 96,
      status: 'active',
    },
    {
      id: 'tx-1002',
      vehicleNumber: 'KA01JJ8846',
      vehicleType: 'car',
      serviceId: 'srv-car-prem',
      serviceName: 'Car Premium Wash',
      amount: 350,
      hour: 10,
      workerId: 'worker-arun',
      workerName: 'Arun Sharma',
      ocrConfidence: 94,
      status: 'active',
    },
    {
      id: 'tx-1003',
      vehicleNumber: 'KA03AN0368',
      vehicleType: 'bike',
      serviceId: 'srv-bike-prem',
      serviceName: 'Bike Premium Wash',
      amount: 150,
      hour: 11,
      workerId: 'worker-ravi',
      workerName: 'Ravi Kumar',
      ocrConfidence: 98,
      status: 'active',
    },
    {
      id: 'tx-1004',
      vehicleNumber: 'KA03MW6100',
      vehicleType: 'bike',
      serviceId: 'srv-bike-full',
      serviceName: 'Bike Full Wash',
      amount: 200,
      hour: 11,
      workerId: 'worker-arun',
      workerName: 'Arun Sharma',
      ocrConfidence: 91,
      status: 'active',
    },
  ],
}

/**
 * Seeds the active Firestore database with services, workers, and initial transactions.
 */
export async function seedFirestoreDatabase(onProgress) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase credentials are not configured in your .env file yet.')
  }

  const today = new Date().toISOString().slice(0, 10)
  const currentUser = auth?.currentUser

  // 1. Seed Current Admin Profile First if logged in
  if (currentUser) {
    if (onProgress) onProgress('Setting up admin credentials...')
    await setDoc(doc(db, 'workers', currentUser.uid), {
      id: currentUser.uid,
      name: currentUser.displayName || 'Admin Manager',
      email: currentUser.email || 'admin@washledger.com',
      username: 'admin',
      role: 'admin',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // 2. Seed Wash Services
  if (onProgress) onProgress('Seeding wash services...')
  for (const srv of SEED_DATA.services) {
    await setDoc(doc(db, 'services', srv.id), {
      ...srv,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // 3. Seed Worker Accounts
  if (onProgress) onProgress('Seeding worker accounts...')
  for (const w of SEED_DATA.workers) {
    await setDoc(doc(db, 'workers', w.id), {
      ...w,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // 4. Seed Initial Transactions
  if (onProgress) onProgress('Seeding sample ledger transactions...')
  for (const tx of SEED_DATA.transactions) {
    await setDoc(doc(db, 'transactions', tx.id), {
      ...tx,
      date: today,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  if (onProgress) onProgress('Seeding complete! ✅')
  return true
}
