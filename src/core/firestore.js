// src/core/firestore.js — High performance data access layer
// Dual engine: Uses Firebase Firestore when configured, or Local Storage persistence

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import { db, isFirebaseConfigured } from './firebase'
import { DEMO_USERS } from './auth'

export const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  SERVICES:     'services',
  WORKERS:      'workers',
  AUDIT_LOGS:   'auditLogs',
}

// ─── DEFAULT SEED DATA ────────────────────────────────────────────────────────
const DEFAULT_SERVICES = [
  { id: 'srv-c1', name: 'Car Basic Wash', vehicleType: 'car', price: 250, status: 'active' },
  { id: 'srv-c2', name: 'Car Premium Wash', vehicleType: 'car', price: 350, status: 'active' },
  { id: 'srv-c3', name: 'Car Full Wash', vehicleType: 'car', price: 750, status: 'active' },
  { id: 'srv-b1', name: 'Bike Basic Wash', vehicleType: 'bike', price: 100, status: 'active' },
  { id: 'srv-b2', name: 'Bike Premium Wash', vehicleType: 'bike', price: 150, status: 'active' },
  { id: 'srv-b3', name: 'Bike Full Wash', vehicleType: 'bike', price: 200, status: 'active' },
]

function getInitialTransactions() {
  const today = new Date().toISOString().slice(0, 10)
  return [
    {
      id: 'tx-1001',
      vehicleNumber: 'KA01NC8564',
      vehicleType: 'car',
      serviceId: 'srv-c3',
      serviceName: 'Car Full Wash',
      amount: 750,
      date: today,
      hour: 8,
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
      workerId: 'demo-worker-01',
      workerName: 'Ravi Kumar',
      ocrConfidence: 96,
      status: 'active',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'tx-1002',
      vehicleNumber: 'KA01JJ8846',
      vehicleType: 'car',
      serviceId: 'srv-c2',
      serviceName: 'Car Premium Wash',
      amount: 350,
      date: today,
      hour: 10,
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      workerId: 'demo-worker-02',
      workerName: 'Arun Sharma',
      ocrConfidence: 94,
      status: 'active',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'tx-1003',
      vehicleNumber: 'KA03AN0368',
      vehicleType: 'bike',
      serviceId: 'srv-b2',
      serviceName: 'Bike Premium Wash',
      amount: 150,
      date: today,
      hour: 11,
      timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      workerId: 'demo-worker-01',
      workerName: 'Ravi Kumar',
      ocrConfidence: 98,
      status: 'active',
      createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    },
    {
      id: 'tx-1004',
      vehicleNumber: 'KA03MW6100',
      vehicleType: 'bike',
      serviceId: 'srv-b3',
      serviceName: 'Bike Full Wash',
      amount: 200,
      date: today,
      hour: 11,
      timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
      workerId: 'demo-worker-02',
      workerName: 'Arun Sharma',
      ocrConfidence: 91,
      status: 'active',
      createdAt: new Date(Date.now() - 3600000 * 1.2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    },
  ]
}

// ─── LOCAL STORAGE MANAGEMENT ────────────────────────────────────────────────
function getLocalItem(key, fallback) {
  try {
    const val = localStorage.getItem('wl_' + key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

function setLocalItem(key, val) {
  try {
    localStorage.setItem('wl_' + key, JSON.stringify(val))
  } catch (e) {
    console.error('Storage error:', e)
  }
}

// Memory listeners for real-time local sync
const localTxListeners = []

function notifyLocalTx() {
  const txs = getLocalTransactions()
  localTxListeners.forEach((fn) => fn(txs))
}

function getLocalTransactions() {
  let txs = getLocalItem('transactions', null)
  if (!txs) {
    txs = getInitialTransactions()
    setLocalItem('transactions', txs)
  }
  return txs
}

function getLocalServices() {
  let srv = getLocalItem('services', null)
  if (!srv) {
    srv = DEFAULT_SERVICES
    setLocalItem('services', srv)
  }
  return srv
}

// ─── TRANSACTIONS ───────────────────────────────────────────────────────────────

/**
 * Create a new wash transaction.
 * Written optimistically in < 200ms.
 */
export async function createTransaction(data, workerId, workerName) {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const hour = now.getHours()
  const cleanPlate = data.vehicleNumber.toUpperCase().replace(/[\s\-\.]/g, '')

  if (isFirebaseConfigured && db) {
    const txData = {
      idempotencyKey: data.idempotencyKey || uuidv4(),
      vehicleNumber:  cleanPlate,
      vehicleType:    data.vehicleType,
      serviceId:      data.serviceId,
      serviceName:    data.serviceName,
      amount:         Number(data.amount),
      date:           dateStr,
      hour,
      timestamp:      serverTimestamp(),
      workerId,
      workerName,
      ocrConfidence:  data.ocrConfidence ?? null,
      scanImageUrl:   data.scanImageUrl ?? null,
      status:         'active',
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
    }

    const ref = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), txData)

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      transactionId: ref.id,
      userId: workerId,
      action: 'created',
      field: null,
      oldValue: null,
      newValue: cleanPlate,
      createdAt: serverTimestamp(),
    })

    return ref.id
  }

  // Local storage mode:
  const newTx = {
    id: 'tx-' + Math.floor(1000 + Math.random() * 9000),
    idempotencyKey: data.idempotencyKey || uuidv4(),
    vehicleNumber:  cleanPlate,
    vehicleType:    data.vehicleType,
    serviceId:      data.serviceId,
    serviceName:    data.serviceName,
    amount:         Number(data.amount),
    date:           dateStr,
    hour,
    timestamp:      now.toISOString(),
    workerId,
    workerName,
    ocrConfidence:  data.ocrConfidence ?? 95,
    scanImageUrl:   data.scanImageUrl ?? null,
    status:         'active',
    createdAt:      now.toISOString(),
    updatedAt:      now.toISOString(),
  }

  const txs = getLocalTransactions()
  txs.unshift(newTx)
  setLocalItem('transactions', txs)

  // Append audit log
  const auditLogs = getLocalItem('auditLogs', [])
  auditLogs.unshift({
    id: 'aud-' + Date.now(),
    transactionId: newTx.id,
    userId: workerId,
    action: 'created',
    oldValue: null,
    newValue: cleanPlate,
    createdAt: now.toISOString(),
  })
  setLocalItem('auditLogs', auditLogs)

  notifyLocalTx()
  return newTx.id
}

/**
 * Check for duplicate scan: same vehicle number within `windowMinutes`.
 */
export async function checkDuplicate(vehicleNumber, windowMinutes = 60) {
  const cleanPlate = vehicleNumber.toUpperCase().replace(/[\s\-\.]/g, '')
  const cutoffTime = Date.now() - windowMinutes * 60 * 1000
  const today = new Date().toISOString().slice(0, 10)

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('vehicleNumber', '==', cleanPlate),
        where('date', '==', today),
        where('status', '==', 'active'),
        orderBy('timestamp', 'desc'),
        limit(1)
      )
      const snap = await getDocs(q)
      if (snap.empty) return null
      const recent = snap.docs[0].data()
      if (recent.timestamp && recent.timestamp.toDate().getTime() >= cutoffTime) {
        return { id: snap.docs[0].id, ...recent }
      }
      return null
    } catch (err) {
      console.warn('Firestore duplicate check fallback:', err)
    }
  }

  // Local storage check
  const txs = getLocalTransactions()
  const matched = txs.find((t) => {
    if (t.vehicleNumber !== cleanPlate || t.status !== 'active') return false
    const txTime = new Date(t.timestamp).getTime()
    return txTime >= cutoffTime
  })
  return matched || null
}

/**
 * Subscribe to today's transactions for a worker.
 */
export function subscribeTodayWorkerTransactions(workerId, callback) {
  const today = new Date().toISOString().slice(0, 10)

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('workerId', '==', workerId),
        where('date', '==', today),
        orderBy('timestamp', 'desc')
      )
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
    } catch (err) {
      console.warn('Firestore subscription fallback:', err)
    }
  }

  // Local sync
  const handler = (allTxs) => {
    const filtered = allTxs.filter((t) => t.workerId === workerId && t.date === today)
    callback(filtered)
  }
  localTxListeners.push(handler)
  handler(getLocalTransactions())

  return () => {
    const idx = localTxListeners.indexOf(handler)
    if (idx !== -1) localTxListeners.splice(idx, 1)
  }
}

/**
 * Subscribe to all today's transactions (admin).
 */
export function subscribeTodayTransactions(callback) {
  const today = new Date().toISOString().slice(0, 10)

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('date', '==', today),
        orderBy('timestamp', 'desc')
      )
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
    } catch (err) {
      console.warn('Firestore subscription fallback:', err)
    }
  }

  const handler = (allTxs) => {
    const filtered = allTxs.filter((t) => t.date === today)
    callback(filtered)
  }
  localTxListeners.push(handler)
  handler(getLocalTransactions())

  return () => {
    const idx = localTxListeners.indexOf(handler)
    if (idx !== -1) localTxListeners.splice(idx, 1)
  }
}

/**
 * Fetch transactions with filters (admin ledger).
 */
export async function fetchTransactions({
  dateFrom,
  dateTo,
  vehicleType,
  workerId,
  serviceId,
  searchQuery,
  sortField = 'timestamp',
  sortDir = 'desc',
} = {}) {
  let list = []

  if (isFirebaseConfigured && db) {
    try {
      let constraints = [orderBy(sortField, sortDir), limit(100)]
      if (dateFrom) constraints.push(where('date', '>=', dateFrom))
      if (dateTo)   constraints.push(where('date', '<=', dateTo))
      if (vehicleType && vehicleType !== 'all') constraints.push(where('vehicleType', '==', vehicleType))
      if (workerId) constraints.push(where('workerId', '==', workerId))
      if (serviceId) constraints.push(where('serviceId', '==', serviceId))

      const q = query(collection(db, COLLECTIONS.TRANSACTIONS), ...constraints)
      const snap = await getDocs(q)
      list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (err) {
      console.warn('Firestore fetch fallback:', err)
      list = getLocalTransactions()
    }
  } else {
    list = getLocalTransactions()
  }

  // Filter in memory for maximum speed and flexible searches
  return list.filter((t) => {
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    if (vehicleType && vehicleType !== 'all' && t.vehicleType !== vehicleType) return false
    if (workerId && workerId !== 'all' && t.workerId !== workerId) return false
    if (serviceId && serviceId !== 'all' && t.serviceId !== serviceId) return false
    if (searchQuery) {
      const q = searchQuery.toUpperCase().replace(/[\s\-\.]/g, '')
      if (!t.vehicleNumber.includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    const aVal = a[sortField] || a.timestamp
    const bVal = b[sortField] || b.timestamp
    return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
  })
}

/**
 * Fetch vehicle history by registration number.
 */
export async function fetchVehicleHistory(vehicleNumber) {
  const clean = vehicleNumber.toUpperCase().replace(/[\s\-\.]/g, '')
  const all = isFirebaseConfigured && db
    ? await fetchTransactions({ searchQuery: clean })
    : getLocalTransactions()

  return all.filter((t) => t.vehicleNumber.includes(clean))
}

/**
 * Admin: update a transaction field with audit log.
 */
export async function adminUpdateTransaction(txId, field, newValue, adminId) {
  if (isFirebaseConfigured && db) {
    const ref = doc(db, COLLECTIONS.TRANSACTIONS, txId)
    const snap = await getDoc(ref)
    const old = snap.exists() ? snap.data()[field] : null

    await updateDoc(ref, { [field]: newValue, updatedAt: serverTimestamp() })
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      transactionId: txId,
      userId: adminId,
      action: 'modified',
      field,
      oldValue: old,
      newValue,
      createdAt: serverTimestamp(),
    })
    return
  }

  // Local storage
  const txs = getLocalTransactions()
  const idx = txs.findIndex((t) => t.id === txId)
  if (idx !== -1) {
    const old = txs[idx][field]
    txs[idx][field] = newValue
    txs[idx].updatedAt = new Date().toISOString()
    setLocalItem('transactions', txs)

    const auditLogs = getLocalItem('auditLogs', [])
    auditLogs.unshift({
      id: 'aud-' + Date.now(),
      transactionId: txId,
      userId: adminId,
      action: 'modified',
      field,
      oldValue: old,
      newValue,
      createdAt: new Date().toISOString(),
    })
    setLocalItem('auditLogs', auditLogs)
    notifyLocalTx()
  }
}

// ─── SERVICES ───────────────────────────────────────────────────────────────────

export async function fetchServices(vehicleType = null) {
  let list = []
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, COLLECTIONS.SERVICES), where('status', '==', 'active'))
      const snap = await getDocs(q)
      list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch {
      list = getLocalServices()
    }
  } else {
    list = getLocalServices()
  }

  if (vehicleType) {
    return list.filter((s) => s.vehicleType === vehicleType && s.status === 'active')
  }
  return list.filter((s) => s.status === 'active')
}

export async function createService(data) {
  if (isFirebaseConfigured && db) {
    return addDoc(collection(db, COLLECTIONS.SERVICES), {
      ...data,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const srv = getLocalServices()
  const newSrv = {
    id: 'srv-' + Date.now(),
    ...data,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  srv.push(newSrv)
  setLocalItem('services', srv)
  return newSrv.id
}

export async function updateService(id, data) {
  if (isFirebaseConfigured && db) {
    return updateDoc(doc(db, COLLECTIONS.SERVICES, id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  const srv = getLocalServices()
  const idx = srv.findIndex((s) => s.id === id)
  if (idx !== -1) {
    srv[idx] = { ...srv[idx], ...data, updatedAt: new Date().toISOString() }
    setLocalItem('services', srv)
  }
}

// ─── WORKERS ────────────────────────────────────────────────────────────────────

export async function fetchWorkers() {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.WORKERS))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch {
      return DEMO_USERS
    }
  }
  return getLocalItem('workers', DEMO_USERS)
}

export async function updateWorker(id, data) {
  if (isFirebaseConfigured && db) {
    return updateDoc(doc(db, COLLECTIONS.WORKERS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  const workers = getLocalItem('workers', DEMO_USERS)
  const idx = workers.findIndex((w) => w.uid === id || w.id === id)
  if (idx !== -1) {
    workers[idx] = { ...workers[idx], ...data }
    setLocalItem('workers', workers)
  }
}
