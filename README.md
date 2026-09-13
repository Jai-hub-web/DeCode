# ⚡ DCode 

DCode is a blazing-fast, cyber-themed, browser-based IDE. It allows you to create projects, write code in multiple languages, seamlessly execute your programs, and get instant AI-powered fixes when things go wrong.

![DCode Screenshot](https://raw.githubusercontent.com/divyansh23saklani-rgb/VaporCode/main/docs/screenshot.png) *(Note: Add a screenshot here later)*

## ✨ Features

- **Multi-Language Support**: Write and execute code in 8 different languages (TypeScript, JavaScript, Python, Java, C++, C, Go, Rust).
- **Interactive AI Debugger**: Encounter a bug? Click "✨ Ask AI to Fix" to instantly have Groq's high-speed AI analyze your error and suggest code changes. You can even chat with the AI for follow-up explanations!
- **Persistent Workspaces**: Your projects and files are automatically saved using a robust SQLite database.
- **Cyber-Aesthetic UI**: A meticulously designed dark mode interface featuring smooth animations (Framer Motion) and a premium code editing experience (Monaco Editor).
- **One-Click Export**: Easily download your entire project as a `.zip` archive.

## 🛠️ Tech Stack

**Frontend:**
- React 19 & Vite
- Tailwind CSS (v4)
- Framer Motion (Animations)
- Monaco Editor
- Lucide React (Icons)

**Backend:**
- Node.js & Fastify
- Prisma ORM (SQLite)
- Groq SDK (Llama-3.3-70b-versatile for AI Debugging)
- Archiver (for ZIP exports)

## 🚀 Getting Started

### Prerequisites
1. Node.js (v20+)
2. A free API key from [Groq Console](https://console.groq.com)
3. Compilers installed locally if you plan to run non-JavaScript languages (e.g., `python`, `javac`, `g++`, `rustc`, `go`).

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/divyansh23saklani-rgb/VaporCode.git
   cd VaporCode
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory (or use the existing one) and add your database URL and Groq API key:
   ```env
   DATABASE_URL="file:./dev.db"
   GROQ_API_KEY="your_groq_api_key_here"
   PORT=3001
   ```

4. **Initialize the Database**
   ```bash
   npx prisma db push
   ```

### Running the App

You'll need two terminal windows to run the frontend and backend simultaneously.

**1. Start the Backend Server**
```bash
npm run server
```
*The API will start running on `http://localhost:3001`.*

**2. Start the Frontend Development Server**
```bash
npm run dev
```
*Vite will start the UI. Open the provided `localhost` link in your browser.*

## 🤖 How the AI Debugger Works

DCode intercepts your terminal execution errors. If an error is detected, the "Ask AI" button becomes available. When clicked:
1. The backend securely packages your current code and the exact error trace.
2. It sends it to Groq's `llama-3.3-70b-versatile` model for lightning-fast analysis.
3. The AI returns a human-readable explanation and a corrected code block.
4. You can chat with the AI for more context, or simply hit **"Apply Latest Fix"** to inject the solution back into your editor!

## 📝 License

This project is licensed under the MIT License.