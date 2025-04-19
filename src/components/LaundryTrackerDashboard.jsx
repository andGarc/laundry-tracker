import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import HowToUseModal from './HowToUseModal';

const LaundryTrackerDashboard = () => {
  const [machines, setMachines] = useState({
    washer: { status: 'available', user: null, userId: null, timeRemaining: 0 },
    dryer: { status: 'available', user: null, userId: null, timeRemaining: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showHowToUse, setShowHowToUse] = useState(false);

  // Set up user identity on component mount
  useEffect(() => {
    // Try to get user ID from local storage
    const userId = localStorage.getItem('laundryUserId');
    const userName = localStorage.getItem('laundryUserName');
    
    if (userId && userName) {
      setCurrentUser({ id: userId, name: userName });
    } else {
      // First time visitor - prompt for name
      const newUserName = prompt('Welcome! Please enter your name to use the laundry tracker:');
      if (newUserName) {
        const newUserId = `user_${Date.now()}`;
        localStorage.setItem('laundryUserId', newUserId);
        localStorage.setItem('laundryUserName', newUserName);
        setCurrentUser({ id: newUserId, name: newUserName });
      }
    }
  }, []);

  // Fetch initial machine data and subscribe to changes
  useEffect(() => {
    fetchMachines();
    
    // Set up real-time subscription
    const machineSubscription = supabase
      .channel('machines-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'machines' 
      }, handleRealtimeUpdate)
      .subscribe();
    
    return () => {
      supabase.removeChannel(machineSubscription);
    };
  }, []);

  // Timer effect to decrease remaining time and update database
  useEffect(() => {
    if (loading) return;
    
    const timer = setInterval(async () => {
      setMachines(prevMachines => {
        const updatedMachines = { ...prevMachines };
        
        // Washer timer
        if (updatedMachines.washer.status === 'in-use' && updatedMachines.washer.timeRemaining > 0) {
          updatedMachines.washer.timeRemaining -= 1;
          
          if (updatedMachines.washer.timeRemaining === 0) {
            updatedMachines.washer.status = 'complete';
            updateMachineInDatabase('washer', updatedMachines.washer);
          } else if (updatedMachines.washer.timeRemaining % 15 === 0) {
            // Update database every 15 seconds to reduce writes
            updateMachineInDatabase('washer', updatedMachines.washer);
          }
        }
        
        // Dryer timer
        if (updatedMachines.dryer.status === 'in-use' && updatedMachines.dryer.timeRemaining > 0) {
          updatedMachines.dryer.timeRemaining -= 1;
          
          if (updatedMachines.dryer.timeRemaining === 0) {
            updatedMachines.dryer.status = 'complete';
            updateMachineInDatabase('dryer', updatedMachines.dryer);
          } else if (updatedMachines.dryer.timeRemaining % 15 === 0) {
            // Update database every 15 seconds to reduce writes
            updateMachineInDatabase('dryer', updatedMachines.dryer);
          }
        }
        
        return updatedMachines;
      });
    }, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(timer);
  }, [loading, currentUser]);
  
  const handleRealtimeUpdate = (payload) => {
    const { new: updatedMachine } = payload;
    if (updatedMachine) {
      setMachines(prevMachines => ({
        ...prevMachines,
        [updatedMachine.machine_type]: {
          status: updatedMachine.status,
          user: updatedMachine.user_name,
          userId: updatedMachine.user_id,
          timeRemaining: updatedMachine.time_remaining
        }
      }));
    }
  };

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('machines')
        .select('*');
        
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        const machinesObj = {};
        data.forEach(machine => {
          machinesObj[machine.machine_type] = {
            status: machine.status,
            user: machine.user_name,
            userId: machine.user_id,
            timeRemaining: machine.time_remaining
          };
        });
        setMachines(machinesObj);
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
      alert('Failed to load laundry machine status');
    } finally {
      setLoading(false);
    }
  };

  const updateMachineInDatabase = async (machineType, machineData) => {
    try {
      const { error } = await supabase
        .from('machines')
        .update({
          status: machineData.status,
          user_name: machineData.user,
          user_id: machineData.userId,
          time_remaining: machineData.timeRemaining,
          last_updated: new Date().toISOString()
        })
        .eq('machine_type', machineType);
        
      if (error) throw error;
    } catch (error) {
      console.error(`Error updating ${machineType}:`, error);
    }
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'available': return 'bg-green-500';
      case 'in-use': return 'bg-red-500';
      case 'complete': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };
  
  // Check if current user can interact with the machine
  const canUserInteract = (machine) => {
    if (!currentUser) return false;
    if (machines[machine].status === 'available') return true;
    return machines[machine].userId === currentUser.id;
  };
  
  const handleClaimMachine = async (machine) => {
    if (!currentUser) {
      alert('Please refresh the page and enter your name to use the laundry tracker.');
      return;
    }
    
    if (machines[machine].status === 'available') {
      // Set max time limits
      const maxTime = machine === 'washer' ? 30 : 60;
      const cycleTime = parseInt(prompt(`Enter cycle time (1 load ~${maxTime} mins):`, '30'));
      
      // Validate time input
      if (cycleTime > 0 && cycleTime <= maxTime) {
        const updatedMachine = {
          status: 'in-use',
          user: currentUser.name,
          userId: currentUser.id,
          timeRemaining: cycleTime * 60 // Convert to seconds
        };
        
        try {
          await updateMachineInDatabase(machine, updatedMachine);
          
          // Optimistic update
          setMachines(prevMachines => ({
            ...prevMachines,
            [machine]: updatedMachine
          }));
        } catch (error) {
          alert('Failed to claim machine. Please try again.');
        }
      } else {
        alert(`Please enter a valid time between 1 and ${maxTime} minutes.`);
      }
    }
  };

  // NEW FUNCTION: Handle extending time for a completed machine
  const handleExtendTime = async (machineType) => {
    if (!currentUser) return;
    
    if (['washer', 'dryer'].includes(machineType)) {
      const machine = machines[machineType];
      
      // Check if the current user owns this machine
      if (machine.userId !== currentUser.id) {
        alert(`Only ${machine.user} can extend the ${machineType} time.`);
        return;
      }
      
      // Only allow extension if the machine is in complete status
      if (machine.status === 'complete') {
        const extensionTime = machineType === 'washer' ? 30 : 60; // 30 mins for washer, 60 for dryer
        
        const updatedMachine = {
          status: 'in-use',
          user: machine.user,
          userId: machine.userId,
          timeRemaining: extensionTime * 60 // Convert to seconds
        };
        
        try {
          await updateMachineInDatabase(machineType, updatedMachine);
          
          // Optimistic update
          setMachines(prevMachines => ({
            ...prevMachines,
            [machineType]: updatedMachine
          }));
        } catch (error) {
          alert('Failed to extend time. Please try again.');
        }
      }
    }
  };

  const handleReleaseMachine = async (machineType) => {
    if (!currentUser) return;
    
    if (['washer', 'dryer'].includes(machineType)) {
      const machine = machines[machineType];
      const currentStatus = machine.status;
      
      // Check if the current user owns this machine
      if (machine.userId !== currentUser.id) {
        alert(`Only ${machine.user} can release this ${machineType}.`);
        return;
      }
      
      // Allow release for both in-use and complete statuses
      if (currentStatus === 'in-use' || currentStatus === 'complete') {
        if (window.confirm(`Are you sure you want to release the ${machineType}?`)) {
          const updatedMachine = {
            status: 'available',
            user: null,
            userId: null,
            timeRemaining: 0
          };
          
          try {
            await updateMachineInDatabase(machineType, updatedMachine);
            
            // Optimistic update
            setMachines(prevMachines => ({
              ...prevMachines,
              [machineType]: updatedMachine
            }));
          } catch (error) {
            alert('Failed to release machine. Please try again.');
          }
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
  
  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg flex justify-center">
        <p>Loading laundry status...</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Laundry Tracker</h1>
        <button 
          onClick={() => setShowHowToUse(true)}
          className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How to Use
        </button>
      </div>
      
      {/* Show the How To Use modal */}
      <HowToUseModal 
        isOpen={showHowToUse} 
        onClose={() => setShowHowToUse(false)} 
      />
      
      {currentUser && (
        <div className="mb-4 text-sm bg-blue-50 p-3 rounded">
          <div className="flex justify-between items-center">
            <p className="font-semibold">{currentUser.name}</p>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Washer */}
        <div className="border rounded-lg overflow-hidden">
          <div className={`p-3 text-white font-semibold ${getStatusColor(machines.washer.status)}`}>
            Washer
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
                  disabled={!currentUser}
                >
                  Claim
                </button>
              ) : machines.washer.status === 'complete' ? (
                <div className="flex flex-col items-end">
                  <div className="text-yellow-600 font-medium mb-1">Ready for pickup</div>
                  {/* New Extend button */}
                  {canUserInteract('washer') && (
                    <button 
                      onClick={() => handleExtendTime('washer')}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm mb-2"
                    >
                      Extend 30 min
                    </button>
                  )}
                  <button 
                    onClick={() => handleReleaseMachine('washer')}
                    className={`px-3 py-1 rounded text-sm ${
                      canUserInteract('washer')
                        ? "bg-blue-200 hover:bg-blue-300 text-blue-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!canUserInteract('washer')}
                  >
                    {canUserInteract('washer') ? 'Pick Up' : `Reserved for ${machines.washer.user}`}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  {canUserInteract('washer') ? (
                    <button 
                      onClick={() => handleReleaseMachine('washer')}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                    >
                      Early Release
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500 italic">Reserved for {machines.washer.user}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Dryer */}
        <div className="border rounded-lg overflow-hidden">
          <div className={`p-3 text-white font-semibold ${getStatusColor(machines.dryer.status)}`}>
            Dryer
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
                  disabled={!currentUser}
                >
                  Claim
                </button>
              ) : machines.dryer.status === 'complete' ? (
                <div className="flex flex-col items-end">
                  <div className="text-yellow-600 font-medium mb-1">Ready for pickup</div>
                  {/* New Extend button */}
                  {canUserInteract('dryer') && (
                    <button 
                      onClick={() => handleExtendTime('dryer')}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm mb-2"
                    >
                      Extend 60 min
                    </button>
                  )}
                  <button 
                    onClick={() => handleReleaseMachine('dryer')}
                    className={`px-3 py-1 rounded text-sm ${
                      canUserInteract('dryer')
                        ? "bg-blue-200 hover:bg-blue-300 text-blue-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!canUserInteract('dryer')}
                  >
                    {canUserInteract('dryer') ? 'Pick Up' : `Reserved for ${machines.dryer.user}`}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  {canUserInteract('dryer') ? (
                    <button 
                      onClick={() => handleReleaseMachine('dryer')}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                    >
                      Early Release
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500 italic">Reserved for {machines.dryer.user}</span>
                  )}
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