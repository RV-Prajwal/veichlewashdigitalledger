# 🚗 WashLedger — Digital Vehicle Wash Management & Analytics System

Progressive Web App (PWA) designed to replace handwritten paper ledgers with fast, camera-based vehicle & plate recognition, automated pricing, and live analytics.

---

## ⚡ Core Guarantee: Scan to Ledger in < 2 Seconds

1. **Pre-warmed AI Models at Login**:
   - `TensorFlow.js` with `lite_mobilenet_v2` for on-device vehicle type detection (Car vs. Bike).
   - `Tesseract.js` web worker with Indian license plate character whitelisting and single-word PSM mode pre-initialized in the background.
2. **On-Device OCR Execution**:
   - Zero roundtrip network latency during plate reading.
   - Plate auto-cropping + zone-aware character correction (fixing `O/0`, `I/1`, `B/8` based on Indian plate syntax).
3. **Sub-200ms Optimistic Writes**:
   - Writes directly to local IndexedDB/Firestore cache first, rendering the success state immediately to the worker while cloud replication happens asynchronously.

---

## 📱 Features

- **Worker PWA Mobile View**:
  - One-tap `📷 SCAN VEHICLE` flow.
  - Live viewfinder with reticle, flip camera, and torch controls.
  - Manual entry & sample plate simulation buttons for instant testing.
  - Recent washes stream with today's count & revenue.
  - Duplicate scan warning for vehicles serviced in the last hour.
- **Admin Dashboard**:
  - Real-time KPI cards (Today's Washes, Revenue, Car/Bike distribution).
  - Hourly activity bar chart (8 AM to 8 PM) to track peak operational hours.
  - Service popularity distribution.
- **Searchable Digital Ledger**:
  - Full filter suite: Date range, Vehicle Type (Car/Bike), Service, Worker.
  - Column sorting (Timestamp, Vehicle Number, Amount).
  - Inline price editing with automated administrative audit trail.
  - One-click CSV export.
- **Vehicle Lifetime History**:
  - Search any license plate to calculate total lifetime visits, total spend, customer favorite service, and complete visit timeline.
- **Services & Pricing Management**:
  - Configure wash packages (Car Full Wash ₹750, Premium ₹350, Basic ₹250, Bike Full Wash ₹200, etc.).
- **Worker Accountability**:
  - Track individual worker transaction throughput and revenue attribution.

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173`.

---

## 🔐 Accounts for Testing

- **Worker View (Default)**: `ravi@washledger.com` (password: `worker`)
- **Admin View**: `admin@washledger.com` (password: `admin`)
- Easily switch between Worker scanner and Admin view from the top header or login screen with 1-click test buttons.

---

## ☁️ Connecting to Firebase Firestore

When you are ready to connect to your live Firebase project, copy `.env.example` to `.env` and fill in your keys:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

If these environment variables are omitted, **WashLedger runs in standalone local mode** (persisting transactions, services, and workers to local storage) so you can test and demonstrate the full system immediately!
