# University Queue Management System (UQMS) 🎓

A modern, real-time queue management system built with the T3 Stack (Next.js, TypeScript, Tailwind CSS, Supabase).

![Kiosk Interface](https://your-screenshot-url-here)

## 🌟 Features

*   **Student Kiosk**: Touch-friendly interface for generating tickets (Faculty-based).
*   **Staff Dashboard**: Real-time queue management for agents.
*   **TV Display**: Public screen showing "Now Serving" tickets.
*   **Admin Panel**: Manage agent assignments and configurations.
*   **Hardware Bridge**: Local server to connect thermal printers.
*   **Real-time Updates**: Powered by Supabase Realtime.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Shadcn/UI.
*   **Backend**: Supabase (PostgreSQL, Auth, Realtime).
*   **Hardware**: Node.js/Fastify Bridge for Thermal Printers.

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js 18+
*   Supabase Account
*   Thermal Printer (Optional)

### 2. Setup

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/yourusername/uqms.git
    cd uqms
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables**:
    Create a `.env.local` file:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Database Setup**:
    Run the SQL scripts located in the `database/` folder (e.g., `master_setup.sql`) in your Supabase SQL Editor to create tables and triggers.

### 3. Running the App

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

*   **Kiosk**: `/kiosk`
*   **Dashboard**: `/dashboard`
*   **Display**: `/display`

### 4. Hardware Bridge (For Printers)

If you have a thermal printer:

1.  Navigate to hardware folder: `cd hardware`
2.  Install deps: `npm install`
3.  Run bridge: `npx tsx server.ts`

## 🔐 Admin & Roles

*   **Create Admin**: Sign up a user, then run `promote_admin.sql` in Supabase.
*   **Admin Panel**: Visit `/admin` to assign agents to departments.

## 📄 License
MIT
