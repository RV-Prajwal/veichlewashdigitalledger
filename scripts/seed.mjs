// scripts/seed.mjs
// Command line seeding tool for Firestore database

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import * as dotenv from 'dotenv'

dotenv.config()

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

const SERVICES = [
  { id: 'srv-car-basic', name: 'Car Basic Wash', vehicleType: 'car', price: 250, status: 'active' },
  { id: 'srv-car-prem',  name: 'Car Premium Wash', vehicleType: 'car', price: 350, status: 'active' },
  { id: 'srv-car-full',  name: 'Car Full Wash', vehicleType: 'car', price: 750, status: 'active' },
  { id: 'srv-bike-basic', name: 'Bike Basic Wash', vehicleType: 'bike', price: 100, status: 'active' },
  { id: 'srv-bike-prem',  name: 'Bike Premium Wash', vehicleType: 'bike', price: 150, status: 'active' },
  { id: 'srv-bike-full',  name: 'Bike Full Wash', vehicleType: 'bike', price: 200, status: 'active' },
]

const WORKERS = [
  { id: 'worker-ravi', name: 'Ravi Kumar', username: 'ravi', role: 'worker', mobile: '9876543211', status: 'active' },
  { id: 'worker-arun', name: 'Arun Sharma', username: 'arun', role: 'worker', mobile: '9876543212', status: 'active' },
]

async function runSeed() {
  console.log(`🚀 Connecting to Firestore project: ${firebaseConfig.projectId}...`)

  const adminEmail = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@washledger.com'
  const adminPassword = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin123'

  let user = null
  try {
    console.log(`🔐 Authenticating as ${adminEmail}...`)
    const res = await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    user = res.user
    console.log(`✓ Authenticated as ${adminEmail} (UID: ${user.uid})`)
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        console.log(`Creating admin account ${adminEmail}...`)
        const res = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword)
        user = res.user
        console.log(`✓ Created admin user (UID: ${user.uid})`)
      } catch (createErr) {
        console.error('Auth error:', createErr.message)
        process.exit(1)
      }
    } else {
      console.error('Auth error:', err.message)
      process.exit(1)
    }
  }

  // 1. MUST seed the current Admin profile document FIRST into workers/{uid}
  // Because security rules require an existing admin profile before allowing other collections
  console.log(`🌱 1/3 Establishing admin profile in workers/${user.uid}...`)
  await setDoc(doc(db, 'workers', user.uid), {
    id: user.uid,
    name: 'Admin Manager',
    email: user.email,
    username: 'admin',
    role: 'admin',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  console.log('✓ Admin profile created and authorized!')

  // 2. Services
  console.log('🌱 2/3 Seeding services...')
  for (const s of SERVICES) {
    await setDoc(doc(db, 'services', s.id), { ...s, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    console.log(`   ✓ Service: ${s.name} (₹${s.price})`)
  }

  // 3. Workers
  console.log('🌱 3/3 Seeding workers...')
  for (const w of WORKERS) {
    await setDoc(doc(db, 'workers', w.id), { ...w, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    console.log(`   ✓ Worker: ${w.name}`)
  }

  console.log('\n🎉 SUCCESS: Firestore database is now completely initialized and seeded!')
  process.exit(0)
}

runSeed().catch((e) => {
  console.error('\n❌ Seeding failed:', e.message || e)
  process.exit(1)
})
