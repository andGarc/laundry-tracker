# Laundry Tracker App

A real-time application for tracking and managing shared laundry machines in multi-unit buildings or dormitories.

## Overview

The Laundry Tracker App helps users coordinate shared laundry machine usage by providing a real-time dashboard showing machine availability, current usage, and remaining cycle times. It reduces the hassle of checking physical machines and helps prevent laundry from being left unattended.

## Features

- **Real-time Tracking**: Monitor washer and dryer availability in real-time
- **Machine Claiming**: Users can claim a machine, set timer duration, and release when finished
- **User Identification**: Simple user registration with names stored in local storage
- **Countdown Timers**: Accurate countdown of remaining time for each machine
- **Browser Notifications**: Receive alerts when your laundry cycle is almost complete or finished
- **Multi-user Coordination**: Prevents conflicts with machine usage through user identification
- **Mobile-Friendly UI**: Responsive design works on all devices

## Tech Stack

- React.js for the frontend
- Supabase for real-time database
- TailwindCSS for styling
- Browser Notification API

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/laundry-tracker.git
cd laundry-tracker
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with your Supabase credentials
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up Supabase database with the following schema:

```sql
CREATE TABLE machines (
  id SERIAL PRIMARY KEY,
  machine_type TEXT NOT NULL,
  status TEXT NOT NULL,
  user_name TEXT,
  user_id TEXT,
  time_remaining INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial data
INSERT INTO machines (machine_type, status, user_name, user_id, time_remaining)
VALUES ('washer', 'available', NULL, NULL, 0);

INSERT INTO machines (machine_type, status, user_name, user_id, time_remaining)
VALUES ('dryer', 'available', NULL, NULL, 0);
```

5. Start the development server
```bash
npm start
```

## Usage

1. **First Visit**: Enter your name when prompted
2. **Claiming a Machine**: 
   - Click the "Claim" button on an available machine
   - Enter the estimated cycle time (max 60 min for washer, 120 min for dryer)
3. **Tracking Progress**: The app will count down remaining time
4. **Releasing a Machine**:
   - When cycle completes, the status changes to "Ready for pickup"
   - Click "Pick Up" to release the machine for others
   - You can also click "Early Release" to free the machine before the cycle ends

## Notification System

1. Click "Enable Notifications" to receive alerts
2. You'll receive notifications when:
   - Your laundry has 10 minutes remaining
   - Your laundry cycle is complete

## Deployment

You can deploy this app to any static hosting service:

```bash
npm run build
```

Then upload the contents of the `build` directory to your hosting provider.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.