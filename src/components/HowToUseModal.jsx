// HowToUseModal.jsx
import React from 'react';

const HowToUseModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-90vh overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">How to Use Laundry Tracker</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-2">Getting Started</h3>
          <ol className="list-decimal pl-5 mb-4 space-y-2">
            <li>Enter your name when first visiting the app</li>
            <li>Enable notifications to get alerts when your laundry is done</li>
          </ol>
          
          <h3 className="font-semibold text-lg mb-2">Machine Status Colors</h3>
          <ul className="mb-4 space-y-2">
            <li><span className="inline-block w-4 h-4 bg-green-500 rounded-full mr-2"></span> <strong>Green</strong>: Machine is available</li>
            <li><span className="inline-block w-4 h-4 bg-red-500 rounded-full mr-2"></span> <strong>Red</strong>: Machine is in use</li>
            <li><span className="inline-block w-4 h-4 bg-yellow-500 rounded-full mr-2"></span> <strong>Yellow</strong>: Laundry cycle is complete, waiting for pickup</li>
          </ul>
          
          <h3 className="font-semibold text-lg mb-2">Using a Machine</h3>
          <ol className="list-decimal pl-5 mb-4 space-y-2">
            <li><strong>Claim a Machine</strong>: Click "Claim" on an available machine and enter the cycle time</li>
            <li><strong>During Use</strong>: The app will count down remaining time</li>
            <li><strong>Notifications</strong>: You'll get alerts at 10 minutes remaining and when complete</li>
            <li><strong>Finishing Up</strong>: Click "Pick Up" when you've collected your laundry</li>
          </ol>
          
          <h3 className="font-semibold text-lg mb-2">Important Notes</h3>
          <ul className="list-disc pl-5 mb-4 space-y-2">
            <li>Only the person who claimed a machine can release it</li>
            <li>The washer has a max cycle time of 60 minutes</li>
            <li>The dryer has a max cycle time of 120 minutes</li>
            <li>You can release a machine early if needed</li>
          </ul>
        </div>
        
        <div className="p-4 border-t flex justify-end">
          <button 
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowToUseModal;