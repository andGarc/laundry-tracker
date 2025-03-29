import React, { useState, useEffect } from 'react';

const LaundryTrackerDashboard = () => {
  const [machines, setMachines] = useState({
    washer: { status: 'available', user: null, timeRemaining: 0 },
    dryer: { status: 'available', user: null, timeRemaining: 0 }
  });

  // Timer effect to decrease remaining time
  useEffect(() => {
    const timer = setInterval(() => {
      setMachines(prevMachines => {
        const updatedMachines = { ...prevMachines };
        
        // Washer timer
        if (updatedMachines.washer.status === 'in-use' && updatedMachines.washer.timeRemaining > 0) {
          updatedMachines.washer.timeRemaining -= 1;
          if (updatedMachines.washer.timeRemaining === 0) {
            updatedMachines.washer.status = 'complete';
          }
        }
        
        // Dryer timer
        if (updatedMachines.dryer.status === 'in-use' && updatedMachines.dryer.timeRemaining > 0) {
          updatedMachines.dryer.timeRemaining -= 1;
          if (updatedMachines.dryer.timeRemaining === 0) {
            updatedMachines.dryer.status = 'complete';
          }
        }
        
        return updatedMachines;
      });
    }, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(timer);
  }, []);
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'available': return 'bg-green-500';
      case 'in-use': return 'bg-red-500';
      case 'complete': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };
  
  const handleClaimMachine = (machine) => {
    if (machines[machine].status === 'available') {
      const userName = prompt('Enter your name or apartment number:');
      if (userName) {
        // Set max time limits
        const maxTime = machine === 'washer' ? 60 : 120;
        const cycleTime = parseInt(prompt(`Enter estimated cycle time in minutes (max ${maxTime}):`, '30'));
        
        // Validate time input
        if (cycleTime > 0 && cycleTime <= maxTime) {
          setMachines(prevMachines => ({
            ...prevMachines,
            [machine]: {
              status: 'in-use',
              user: userName,
              timeRemaining: cycleTime * 60 // Convert to seconds
            }
          }));
        } else {
          alert(`Please enter a valid time between 1 and ${maxTime} minutes.`);
        }
      }
    }
  };

  const handleReleaseMachine = (machineType) => {
    if (['washer', 'dryer'].includes(machineType)) {
      const currentStatus = machines[machineType].status;
      
      // Allow release for both in-use and complete statuses
      if (currentStatus === 'in-use' || currentStatus === 'complete') {
        if (window.confirm(`Are you sure you want to release the ${machineType}?`)) {
          setMachines(prevMachines => ({
            ...prevMachines,
            [machineType]: {
              status: 'available',
              user: null,
              timeRemaining: 0
            }
          }));
        }
      }
    }
  };
  
  // Helper function to format time
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold text-center mb-6">Laundry Status</h1>
      
      <div className="space-y-6">
        {/* Washer */}
        <div className="border rounded-lg overflow-hidden">
          <div className={`p-3 text-white font-semibold ${getStatusColor(machines.washer.status)}`}>
            Washer (Max 60 min)
          </div>
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">
                  Status: <span className="capitalize">{machines.washer.status.replace('-', ' ')}</span>
                </p>
                {machines.washer.user && (
                  <p className="text-sm text-gray-600">In use by: {machines.washer.user}</p>
                )}
                {machines.washer.timeRemaining > 0 && (
                  <p className="text-sm text-gray-600">
                    Time remaining: {formatTime(machines.washer.timeRemaining)}
                  </p>
                )}
              </div>
              
              {machines.washer.status === 'available' ? (
                <button 
                  onClick={() => handleClaimMachine('washer')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Claim
                </button>
              ) : machines.washer.status === 'complete' ? (
                <div className="flex flex-col items-end">
                  <div className="text-yellow-600 font-medium mb-1">Ready for pickup</div>
                  <button 
                    onClick={() => handleReleaseMachine('washer')}
                    className="bg-blue-200 hover:bg-blue-300 text-blue-700 px-3 py-1 rounded text-sm"
                  >
                    Pick Up
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <div className="text-gray-500 text-sm mb-1">
                    Available in {formatTime(machines.washer.timeRemaining)}
                  </div>
                  <button 
                    onClick={() => handleReleaseMachine('washer')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                  >
                    Early Release
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Dryer */}
        <div className="border rounded-lg overflow-hidden">
          <div className={`p-3 text-white font-semibold ${getStatusColor(machines.dryer.status)}`}>
            Dryer (Max 120 min)
          </div>
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">
                  Status: <span className="capitalize">{machines.dryer.status.replace('-', ' ')}</span>
                </p>
                {machines.dryer.user && (
                  <p className="text-sm text-gray-600">In use by: {machines.dryer.user}</p>
                )}
                {machines.dryer.timeRemaining > 0 && (
                  <p className="text-sm text-gray-600">
                    Time remaining: {formatTime(machines.dryer.timeRemaining)}
                  </p>
                )}
              </div>
              
              {machines.dryer.status === 'available' ? (
                <button 
                  onClick={() => handleClaimMachine('dryer')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Claim
                </button>
              ) : machines.dryer.status === 'complete' ? (
                <div className="flex flex-col items-end">
                  <div className="text-yellow-600 font-medium mb-1">Ready for pickup</div>
                  <button 
                    onClick={() => handleReleaseMachine('dryer')}
                    className="bg-blue-200 hover:bg-blue-300 text-blue-700 px-3 py-1 rounded text-sm"
                  >
                    Pick Up
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <div className="text-gray-500 text-sm mb-1">
                    Available in {formatTime(machines.dryer.timeRemaining)}
                  </div>
                  <button 
                    onClick={() => handleReleaseMachine('dryer')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                  >
                    Early Release
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center text-gray-500 text-sm">
        Last updated: Just now
      </div>
    </div>
  );
};

export default LaundryTrackerDashboard;
