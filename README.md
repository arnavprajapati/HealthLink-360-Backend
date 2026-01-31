<p align="center">
  <img src="https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js Badge"/>
  <img src="https://img.shields.io/badge/Express-5.1.0-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express Badge"/>
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Badge"/>
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="AI Badge"/>
</p>

<h1 align="center">🏥 HealthLink 360 - Backend</h1>

<p align="center">
  <strong>RESTful API Server for Healthcare Management Platform</strong>
</p>

---

## 📋 Overview

This is the backend server for **HealthLink 360**, a comprehensive healthcare management platform. Built with Express.js and MongoDB, it provides secure APIs for patient-doctor interactions, AI-powered health document analysis, and Google Calendar integration.

---

## 💻 Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Express.js** | 5.1.0 | Web Framework |
| **Mongoose** | 9.0.0 | MongoDB ODM |
| **@google/generative-ai** | 0.24.1 | Gemini AI Integration |
| **googleapis** | 167.0.0 | Google Calendar API |
| **firebase-admin** | 13.6.0 | Firebase Server SDK |
| **jsonwebtoken** | 9.0.2 | JWT Authentication |
| **bcryptjs** | 3.0.3 | Password Hashing |
| **cloudinary** | 2.8.0 | Cloud File Storage |
| **multer** | 2.0.2 | File Upload Handling |

---

## ✨ Features

### 🔐 Authentication System
Complete user authentication with email/password signup and login. Google OAuth integration using Firebase Admin SDK for social login. Email verification with OTP codes. Password reset functionality with secure token-based flow. JWT tokens stored in HttpOnly cookies with 7-day expiry.

### 📄 Health Document Analysis
Upload medical documents (PDF/images) to Cloudinary cloud storage. AI-powered document analysis using Google Gemini that extracts all test results from uploaded reports. Automatic comparison against normal ranges with status classification (normal, low, high, borderline, critical). Disease type detection and health condition identification. Enrichment with comprehensive health knowledge including causes, symptoms, and recommendations.

### 🎯 Health Goals Management
Create, update, and track health goals with multiple goal types (increase, decrease, maintain, range). Progress tracking with percentage calculations. Milestone system for recording progress checkpoints with dates, values, and notes. AI-powered goal analysis providing personalized insights, predictions, recommendations, and motivational messages. Google Calendar sync for goal deadlines and reminders.

### 👥 Doctor-Patient Connections
Connection request system where patients can request to connect with doctors. Doctors can view, accept, or reject incoming requests. Once connected, doctors can access patient's shared health logs and goals. Sharing controls allowing patients to specify which data is visible to which doctor.

### 📅 Appointment System
Doctors can create appointments for their patients. Patients can request appointments with connected doctors. Doctors respond to requests with accept/reject and optional reason. Appointment status tracking (pending, confirmed, completed, cancelled).

### 📝 Clinical Notes & Messaging
Secure note system for doctor-patient communication. Doctors create clinical notes categorized by type (general, prescription, follow-up, lab-results). Patients can view and reply to notes. Unread count tracking for new messages.

### 📅 Google Calendar Integration
OAuth 2.0 flow for Google Calendar authorization. Create calendar events for health goal deadlines and reminders. Fetch and display synced events. Delete events when goals are removed. Disconnect functionality to revoke access.

### 🤖 AI-Powered Features
Conversational AI health assistant using Gemini for patient queries. AI patient summary generation for doctors analyzing all patient data. Health knowledge base with 6 parameters (Hemoglobin, Blood Sugar, Blood Pressure, Cholesterol, Creatinine, TSH) including causes, symptoms, and recommendations.

---

## 🛡️ Security

| Feature | Implementation |
|---------|----------------|
| **JWT Authentication** | Stateless tokens with 7-day expiry |
| **HttpOnly Cookies** | Prevents XSS token theft |
| **Secure + SameSite=None** | Cross-domain cookie support |
| **Password Hashing** | bcrypt with salt rounds |
| **Role-Based Access** | Patient/Doctor route separation |
| **Firebase Admin** | Google token verification |
| **CORS Whitelist** | Origin-based access control |

---

## 📜 License

ISC License

---

## 👨‍💻 Author

**Arnav Prajapati** - [@arnavprajapati](https://github.com/arnavprajapati)
