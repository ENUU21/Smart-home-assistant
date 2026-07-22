# 🐱 KITTEN — Smart Home & Environment Assistant

> **Futuristic Glassmorphic IoT Dashboard for KITTEN Smart Home & Climate Automation System**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.1-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Flash-8E75FF?logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)

**KITTEN** is an advanced, full-stack IoT dashboard and smart home automation hub. Featuring a responsive glassmorphic cyber-aesthetic, real-time sensor monitoring, hardware actuator control, Gemini AI voice intelligence, Firebase cloud synchronization, and a discrete habit tracker with milestone achievements.

---

## 🌟 Key Features

### 🌡️ Live Environmental Telemetry & Comfort Metrics
- **Real-Time Sensor Feed**: Tracks room temperature (°C), relative humidity (%), motion activity via PIR sensor, and live indoor comfort scoring.
- **Microclimate Simulation Engine**: Built-in hardware simulation mode allows full testing of climate responses, noise fluctuations, and device feedback loops without physical hardware connected.

### 💡 Actuator & Climate Controls
- **Dimmable LED Lighting**: Smooth 0–100% PWM slider with quick preset levels (Off, Nightlight, Ambient, Task Light, Max).
- **Multi-Speed Climate Fan**: PWM fan control with custom Arrival Pre-Cooling schedules (pre-cools 5 minutes before scheduled office/school arrival).
- **Ultrasonic Humidifier**: Moisture control with automated dry-room activation and live water level reservoir telemetry & refilling alerts.
- **Smart Automation Presets**: One-click operational profiles including **Energy Saver**, **Cool & Refresh**, **Night Sleep**, **Party / Disco Mode**, and **Auto AI Climate Control**.

### 🎙️ Gemini AI Voice Assistant & Intelligence
- **Natural Vocal Processing**: Powered by the official `@google/genai` TypeScript SDK (Gemini 2.5 Flash model) via a secure server-side Express API proxy.
- **Intelligent Home Commands**: Interpret natural language commands like *"Make it cooler"*, *"Turn on dim night lights"*, *"What's the weather report?"*, or *"Run environment diagnostics"*.
- **Predictive AI Trend Pre-Cooling**: Learns arrival routines based on consecutive room entrance patterns and automatically pre-cools the room 5 minutes ahead of expected arrival.
- **AI Weekly Environment Reports**: Generates detailed analytical summaries, climate recommendations, and usage breakdowns.
- **Interactive Creative Overlays**: Fun vocal-triggered modes including Disco, Ghost/Haunted, Hyper-Speed, Purring, and Core Destruction/Rebuild sequence.

### ☁️ Cloud & ESP32 Microcontroller Synchronization
- **Firestore Real-Time Sync**: Synchronizes telemetry and control state across sessions using Firebase Firestore real-time listeners.
- **Automated Database Optimization**: Automatically prunes older telemetry logs on startup to keep database size optimized and within free tier limits.
- **Flexible Hardware Interfaces**: Supports both direct local IP HTTP REST requests to physical ESP32 microcontrollers and cloud-pollable Firestore document targets.

### 🎯 Discrete Habit Tracker & Achievements
- **Hidden Incident Tracker**: Accessible via secret key combination (`Ctrl+Shift+T` / `Ctrl+Shift+H`) or top navigation shortcut.
- **Calendar History Grid**: View, edit, or log incidents for specific past or present dates with interactive monthly navigation.
- **Consistency Scoring**: Live calculation of monthly clean percentages and streak counts.
- **Milestone Achievements**: Badge unlock system rewarding progress with badges such as *7 Day Keeper*, *14 Day Guardian*, *30 Day Zen Master*, *Early Bird*, and *Consistency Champion*.

### 📊 Time-Series Analytics & Audit Terminal
- **Interactive Visual Charts**: Powered by Recharts to display historical trends for temperature, humidity, lighting levels, fan speed, and humidifier usage.
- **Live Activity Feed**: Real-time logging terminal recording device commands, automation triggers, connection updates, and system events.

---

## 🏗️ Architecture & Tech Stack

```
           +---------------------------------------------------+
           |             Browser Glassmorphic UI               |
           |   (React 19, Vite, Tailwind CSS v4, Motion)     |
           +-------------------------+-------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
+-----------------------------+             +-----------------------------+
|    Express Node.js Server   |             |     Firebase Firestore      |
|  (Gemini AI Proxy Router)   |             | (Telemetry & Control Sync)  |
+--------------+--------------+             +--------------+--------------+
               |                                           |
               v                                           v
+-----------------------------+             +-----------------------------+
|    Google Gemini 2.5 Flash   |             |     ESP32 Microcontroller   |
|        (@google/genai)      |             | (Physical Sensors/Actuators)|
+-----------------------------+             +-----------------------------+
```

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4, Glassmorphism, Custom Theme Colors
- **Animation**: Motion (`motion/react`)
- **Data Visualization**: Recharts & Lucide React Icons

### Backend
- **Server**: Express.js running TypeScript directly in dev (`tsx`) and bundled for production via `esbuild` CommonJS (`dist/server.cjs`)
- **AI Integration**: Google Gen AI SDK (`@google/genai`)
- **Cloud Database**: Firebase Firestore v12

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Gemini API Key**: Obtain a key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/kitten-smart-home.git
   cd kitten-smart-home
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` (or configure in your deployment platform):
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 📜 Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| **`dev`** | `npm run dev` | Launches the Express + Vite unified dev server using `tsx` on port `3000`. |
| **`build`** | `npm run build` | Compiles frontend assets via Vite and bundles `server.ts` into `dist/server.cjs` via `esbuild`. |
| **`start`** | `npm start` | Starts the production server via `node dist/server.cjs`. |
| **`lint`** | `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`). |

---

## 📡 ESP32 REST API Reference

When connecting a physical ESP32 board directly in local HTTP mode, configure the ESP32 IP in the dashboard settings panel (`http://<ESP32_IP>`). The dashboard interacts with these endpoints:

| Endpoint | Method | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/data` | `GET` | — | Returns JSON payload with current sensor readings and device states. |
| `/led` | `GET` | `?value=0..255` | Adjusts LED PWM brightness level. |
| `/fan` | `GET` | `?value=0..255` | Adjusts climate fan PWM speed. |
| `/humidifier` | `GET` | `?value=0..255` | Adjusts ultrasonic humidifier intensity. |
| `/auto` | `GET` | `?enabled=true/false` | Toggles automatic environment control mode on the hardware. |
| `/voice` | `GET` | — | Triggers microphone listen cycle on hardware. |

### Sample ESP32 JSON Response (`/data`)
```json
{
  "temperature": 23.5,
  "humidity": 48.0,
  "motion": true,
  "led": 120,
  "fan": 60,
  "humidifier": 0,
  "auto": false,
  "voice": false
}
```

---

## 🔒 Security & Best Practices

- **Server-Side API Proxying**: The Gemini API key is accessed exclusively server-side within `server.ts` and is never exposed to client-side bundles.
- **Graceful Initialization**: Third-party services and Firebase instances initialize defensively with fallback support for offline simulation.
- **Port Binding**: Dev and production servers bind to `0.0.0.0:3000` for Cloud Run container compatibility.

---

## 📄 License

This project is licensed under the Apache License 2.0. See the file for details.
