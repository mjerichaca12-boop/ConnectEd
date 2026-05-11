# ConnectEd 🎓

ConnectEd is a modern Learning Management System (LMS) designed for seamless interaction between students and teachers. It features real-time messaging, AI-powered learning assistance, and streamlined material management.

## 🚀 Features

- **AI Learning Coach:** Context-aware assistant powered by Groq Cloud (Qwen 2.5).
- **Real-time Messaging:** Direct and group chats for instant collaboration.
- **Subject Management:** Organized view of materials, assignments, and announcements.
- **Cross-Platform:** Built with React Native (Expo) for iOS and Android.

## 🛠️ Project Structure

- `/mobile`: React Native Expo application.
- `/backend`: Node.js Express server with Supabase integration.

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Expo CLI
- Supabase Account
- Groq Cloud API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mjerichaca12-boop/ConnectEd.git
   ```

2. Setup Backend:
   ```bash
   cd backend
   npm install
   # Create a .env file based on .env.example
   node index.js
   ```

3. Setup Mobile:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```

## 📄 License
MIT
