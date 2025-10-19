# 💬 Tauri Chat App

A modern, cross-platform chat application built with **Tauri**, **React**, **Vite**, and **TypeScript**.  
It supports **group messaging**, **private messaging**, and has a **WebRTC-based voice call** infrastructure (currently disabled).  
All user and chat data are stored securely in **Firebase**.

---

## 🚀 Features

- 🗨️ **Group Chat** – Create or join chat rooms and message multiple users in real-time.  
- 💬 **Private Chat** – Send direct messages between users.  
- 🔊 **Voice Call (WebRTC)** – Built-in infrastructure for one-on-one audio calls (coming soon).  
- ☁️ **Firebase Integration** – Authentication, real-time database, and data storage.  
- ⚡ **Fast & Lightweight** – Powered by Tauri and Vite for blazing-fast performance.  
- 🔒 **Cross-Platform Security** – Desktop app that uses the native system environment for enhanced security.  

---

## 🧠 Tech Stack

| Technology | Description |
|-------------|-------------|
| **Tauri** | Rust-based framework for building secure desktop apps |
| **React** | UI library for creating dynamic and reactive interfaces |
| **Vite** | Lightning-fast build tool and dev server |
| **TypeScript** | Type-safe JavaScript for better code reliability |
| **Firebase** | Cloud backend for authentication and data storage |
| **WebRTC** | Real-time voice communication engine |

---

## 🛠️ Getting Started

Follow these steps to run the project locally on your machine.

### 1. Clone the Repository

```bash
git clone https://github.com/Onur-Aba/messaging-app-desktop.git
cd messaging-app-desktop
```
2. Install Dependencies
```bash

npm install
```
3. Configure Firebase
Create a Firebase project at Firebase Console
and add your configuration to a .env file in the root directory:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
4. Run the Application
Run the Tauri development environment:

```bash
npm run tauri dev
```
💡 This will start the React + Vite dev server and open the Tauri desktop app window.

## ⚠️ Firebase Rules

For testing purposes only, you can temporarily allow all reads and writes by using:

```bash
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ Warning: Never leave these rules in production.
This setting makes your entire Firestore database publicly accessible.