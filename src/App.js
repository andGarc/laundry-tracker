import React from 'react';
import LaundryTrackerDashboard from './components/LaundryTrackerDashboard';

function App() {
  return (
    <div className="App min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <LaundryTrackerDashboard />
        <div className="mt-8 text-center text-gray-500 text-sm">
          Laundry Tracker v1.0
        </div>
        <div className="text-center text-gray-500 text-sm">
          <a href="mailto:garcia.andres@proton.me" className="hover:underline">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;