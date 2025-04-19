import React, { useState } from 'react';

const HowToUseModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('start');
  
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
      <div className="bg-white rounded-lg w-full max-w-md mx-auto max-h-[90vh] overflow-hidden flex flex-col">
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
        
        {/* Mobile Tab Navigation */}
        <div className="flex border-b overflow-x-auto md:hidden">
          <button 
            className={`px-3 py-2 text-sm font-medium ${activeTab === 'start' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('start')}
          >
            Getting Started
          </button>
          <button 
            className={`px-3 py-2 text-sm font-medium ${activeTab === 'colors' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('colors')}
          >
            Status Colors
          </button>
          <button 
            className={`px-3 py-2 text-sm font-medium ${activeTab === 'instructions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('instructions')}
          >
            How To
          </button>
          <button 
            className={`px-3 py-2 text-sm font-medium ${activeTab === 'notes' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
        </div>
        
        <div className="overflow-y-auto">
          <div className="p-3 m-2 bg-blue-50 rounded-md border border-blue-100">
            <p className="text-sm"><strong>This system only works if everyone uses it.</strong> Tell your friends about the app so we can all benefit!</p>
          </div>
          
          {/* Content sections - desktop shows all, mobile shows active tab */}
          <div className="p-4">
            {/* Getting Started Section */}
            <div className={`${(activeTab === 'start' || window.innerWidth >= 768) ? 'block' : 'hidden'}`}>
              <h3 className="font-semibold text-base mb-2">Getting Started</h3>
              <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm">
                <li>Enter your name when first visiting the app</li>
              </ol>
            </div>
            
            {/* Colors Section */}
            <div className={`${(activeTab === 'colors' || window.innerWidth >= 768) ? 'block' : 'hidden'}`}>
              <h3 className="font-semibold text-base mb-2">Machine Status Colors</h3>
              <ul className="mb-4 space-y-1 text-sm">
                <li><span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span> <strong>Green</strong>: Available</li>
                <li><span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span> <strong>Red</strong>: In use</li>
                <li><span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span> <strong>Yellow</strong>: Complete, awaiting pickup</li>
              </ul>
            </div>
            
            {/* Instructions Section */}
            <div className={`${(activeTab === 'instructions' || window.innerWidth >= 768) ? 'block' : 'hidden'}`}>
              <h3 className="font-semibold text-base mb-2">Instructions</h3>
              <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm">
                <li><strong>Claim a Machine</strong>: Click "Claim" on an available machine</li>
                <li><strong>During Use</strong>: The app will count down remaining time</li>
                <li><strong>Finishing Up</strong>: Click "Pick Up" when done or "Extend" if needed</li>
              </ol>
            </div>
            
            {/* Notes Section */}
            <div className={`${(activeTab === 'notes' || window.innerWidth >= 768) ? 'block' : 'hidden'}`}>
              <h3 className="font-semibold text-base mb-2">Important Notes</h3>
              <ul className="list-disc pl-5 mb-4 space-y-1 text-sm">
                <li>Only the person who claimed a machine can release it</li>
                <li>You can release a machine early if needed</li>
                <li>Machines auto-release 15 minutes after cycle ends</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="p-3 border-t mt-auto">
          <button
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm w-full"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowToUseModal;