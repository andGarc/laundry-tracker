import React from 'react';

const HowToUseModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  // Close modal when clicking outside the content
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-full max-w-md mx-auto max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white p-3 border-b z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">How to Use Laundry Tracker</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-3 m-2 bg-blue-50 rounded-md border border-blue-100">
          <p className="text-sm"><strong>This system only works if everyone uses it.</strong> Tell your friends about the app so we can all benefit! The more people who use it, the more accurate it becomes.</p>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-base mb-2">Getting Started</h3>
          <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm">
            <li>Enter your name when first visiting the app</li>
          </ol>
          
          <h3 className="font-semibold text-base mb-2">Machine Status Colors</h3>
          <ul className="mb-4 space-y-1 text-sm">
            <li><span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span> <strong>Green</strong>: Machine is available</li>
            <li><span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span> <strong>Red</strong>: Machine is in use</li>
            <li><span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span> <strong>Yellow</strong>: Laundry cycle is complete, waiting for pickup</li>
          </ul>
          
          <h3 className="font-semibold text-base mb-2">Instructions</h3>
          <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm">
            <li><strong>Claim a Machine</strong>: Click "Claim" on an available machine and enter the cycle time</li>
            <li><strong>During Use</strong>: The app will count down remaining time</li>
            <li><strong>Finishing Up</strong>: Click "Pick Up" when you've collected your laundry or click "Extend" if you need more time</li>
          </ol>
          
          <h3 className="font-semibold text-base mb-2">Important Notes</h3>
          <ul className="list-disc pl-5 mb-4 space-y-1 text-sm">
            <li>Only the person who claimed a machine can release it</li>
            <li>You can release a machine early if needed</li>
            <li>Machine will automatically be released 15 minutes after cycle ends</li>
          </ul>
        </div>
        <div className="p-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowToUseModal;