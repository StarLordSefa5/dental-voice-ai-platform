# 🦷 Autonomous Dental Clinic Voice AI & Operations Platform

An enterprise-ready, autonomous clinic management platform powered by **Voice AI (Vapi.ai)**, **Cal.com API v2**, **n8n**, **React**, and **Supabase**. The system answers patient calls 24/7, performs natural language triage, checks live doctor availability, and synchronizes appointments with zero human intervention.

---

## 🚀 Key Highlights & Architecture

* **Autonomous Voice Inbound Agent (Vapi.ai):** Low-latency (~1.2s) conversational pipeline using **Deepgram Nova 2 (Turkish)** for STT and **GPT-4o Mini** for real-time reasoning and tool calling.
* **Function Calling & Dynamic Tooling:** The voice assistant executes real-time functions:
  * `musaitlik`: Checks real-time calendar availability.
  * `randevu_olustur`: Books new slots into the clinic schedule.
  * `Randevu_Guncelle_Iptal`: Modifies or cancels existing appointments.
  * `randevu_sorgula`: Inquires active appointment details.
  * `gecikme_bildir`: Handles late arrival notifications.
* **Intelligent Triage & Orchestration (n8n):** Routes clinical complaints to relevant specialists (e.g., Implant & Surgery to Dr. Emre, General Checkup to Dr. Zeynep).
* **Two-Way Calendar Sync (Cal.com v2 API):** Locks calendar slots dynamically and prevents double-booking.
* **Live Receptionist & Doctor Console (React + Supabase):** Real-time clinic dashboard that receives instantaneous appointment updates and cancellation events via WebSocket subscriptions.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Vite, Modern CSS
* **Database & Realtime:** Supabase (PostgreSQL, Realtime WebSockets)
* **Voice AI Pipeline:** Vapi.ai, Deepgram Nova-2, OpenAI GPT-4o Mini
* **Workflow Automation:** n8n (Webhooks & Logic Engine)
* **Scheduling Engine:** Cal.com API v2

---

## 📋 Getting Started

### 1. Clone the repository
```bash
git clone [https://github.com/StarLordSefa5/dental-voice-ai-platform.git](https://github.com/StarLordSefa5/dental-voice-ai-platform.git)
cd dental-voice-ai-platform
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and provide your credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CAL_API_KEY=your_cal_api_key
```

### 4. Run the development server
```bash
npm run dev
```

---

## 👤 Author
Developed by **Sefa Elgün**  
* GitHub: [@StarLordSefa5](https://github.com/StarLordSefa5)```
