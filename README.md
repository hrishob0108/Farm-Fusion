# 🌱 Farm Fusion AI - Full Stack Event Registration Platform

**Farm Fusion AI** is a production-ready, modern, premium full-stack Event Registration Platform built for a national-level AI + Agriculture hackathon.

It features an Apple-quality glassmorphism user interface, seamless single-route navigation (`/`), real-time countdown timer, dynamic team member collapsible accordions, client-side PDF registration receipt generation, instant UPI/QR payment upload, and a feature-complete JWT-authenticated Admin Portal with analytics, status management, and CSV/Excel/PDF data exports.

---

## 🚀 Tech Stack

### Frontend (`client/`)
- **Core**: React.js (Vite) - **JavaScript Only** (No TypeScript)
- **Styling**: Tailwind CSS v4, Glassmorphism, Custom SVG Circuit & Leaf Animations
- **Animations**: Framer Motion, Canvas Confetti
- **State & Routing**: React Router DOM (Single Route `/`), React Context API
- **Forms & Validation**: React Hook Form, Zod
- **Networking**: Axios, TanStack React Query
- **Utilities**: Lucide Icons, React Dropzone, React Hot Toast, jsPDF, XLSX, PapaParse, Browser Image Compression

### Backend (`server/`)
- **Core**: Node.js, Express.js
- **Database**: MongoDB & Mongoose (with automated Memory Fallback mode for offline/demo running)
- **File Storage**: Multer
- **Security**: JWT Authentication, bcrypt, Helmet, CORS, Morgan
- **Documentation**: Swagger OpenAPI 3.0 at `/api/docs`

---

## 📂 Folder Structure

```
farm-fusion-ai/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Navbar, Footer, BackgroundEffects, LoadingScreen, ScrollToTop
│   │   │   ├── countdown/      # CountdownTimer
│   │   │   ├── registration/   # StepIndicator, HeroHome, RegistrationForm, PaymentSection, SuccessSection
│   │   │   └── admin/          # AdminModal, AdminDashboard
│   │   ├── context/            # EventContext, AuthContext
│   │   ├── hooks/
│   │   ├── services/           # receiptGenerator.js, exportUtils.js
│   │   ├── utils/              # validators.js, imageCompressor.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── server/
    ├── config/                 # db.js, swagger.js
    ├── controllers/            # eventController.js, registrationController.js, adminController.js
    ├── middleware/             # authMiddleware.js, uploadMiddleware.js, errorHandler.js
    ├── models/                 # Event.js, Registration.js, Admin.js, ActivityLog.js
    ├── routes/                 # eventRoutes.js, registrationRoutes.js, adminRoutes.js
    ├── utils/                  # seed.js
    ├── uploads/                # Static Multer storage
    ├── .env.example
    ├── package.json
    └── server.js
```

---

## ⚡ Quick Start & Setup Instructions

### 1. Install Server Dependencies & Seed Database
```bash
cd server
npm install
npm run seed     # Initializes default Event config and default Admin credentials
```

### 2. Start Express Backend Server
```bash
npm start        # Runs Express API server on http://localhost:5000
```
- **Swagger Documentation**: Available at `http://localhost:5000/api/docs`

### 3. Install Client Dependencies & Start Frontend
In a new terminal:
```bash
cd client
npm install
npm run dev      # Starts Vite dev server on http://localhost:5173
```

---

## 🔐 Default Admin Credentials

- **Username**: `admin`
- **Password**: `admin1289`

Click **Admin Portal** in the top navigation bar to sign in, inspect registrations, approve/reject payments, download reports, or edit live event settings.

---

## 🔑 Main Features & Highlights

1. **Single Route Journey (`/`)**:
   - `Home` → `Registration` → `Payment` → `Success` on a unified URL.
2. **Dynamic Team Members**:
   - `maxMembers` controlled live by backend; generates collapsible member cards (`▼ Member 1`, `▼ Member 2`, etc.).
3. **Form Auto-Save**:
   - Restores draft registration details from `localStorage` if refreshed.
4. **Duplicate Prevention**:
   - Rejects duplicate Team Names or Registration Numbers.
5. **PDF Receipt Download**:
   - Generates official styled PDF registration receipt upon submission.
6. **Admin Operations**:
   - Manage payments, view high-res screenshots, update live countdowns/UPI/QR code, and export to CSV, Excel, or PDF.
