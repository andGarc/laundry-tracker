import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import HowToUseModal from './HowToUseModal';

const LaundryTrackerDashboard = () => {
  const [machines, setMachines] = useState({
    washer: { 
      status: 'available', 
      user: null, 
      userId: null, 
      startTimestamp: null,
      cycleDurationSeconds: 0,
      timeRemaining: 0, 
      completeTimestamp: null 
    },
    dryer: { 
      status: 'available', 
      user: null, 
      userId: null, 
      startTimestamp: null,
      cycleDurationSeconds: 0,
      timeRemaining: 0, 
      completeTimestamp: null 
    }
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationTimeoutRef = useRef(null);

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

  // Monitor machines' status and show notifications
  useEffect(() => {
    if (loading) return;

    const monitorTimer = setInterval(() => {
      const now = Date.now();
      const updatedMachines = { ...machines };
      let shouldUpdate = false;
      
      // Check for machines about to be auto-released
      Object.entries(updatedMachines).forEach(([machineType, machine]) => {
        if (machine.status === 'complete' && machine.completeTimestamp) {
          const minutesSinceComplete = (now - machine.completeTimestamp) / (1000 * 60);
          const minutesRemaining = 15 - minutesSinceComplete;
          
          // Show notification when 5 minutes and 1 minute remain
          if (Math.floor(minutesRemaining) === 5 && Math.ceil(minutesRemaining % 1 * 60) === 0) {
            addNotification(`${machineType.charAt(0).toUpperCase() + machineType.slice(1)} will be auto-released in 5 minutes!`, 'warning');
          } else if (Math.floor(minutesRemaining) === 1 && Math.ceil(minutesRemaining % 1 * 60) === 0) {
            addNotification(`${machineType.charAt(0).toUpperCase() + machineType.slice(1)} will be auto-released in 1 minute!`, 'warning');
          }
          
          // Update UI timer
          updatedMachines[machineType] = {
            ...machine,
            autoReleaseIn: Math.max(0, Math.floor(minutesRemaining))
          };
          shouldUpdate = true;
        }
      });
      
      if (shouldUpdate) {
        setMachines(updatedMachines);
      }
    }, 1000);

    return () => clearInterval(monitorTimer);
  }, [loading, machines]);

  // Client-side timer effect to update UI countdown
  useEffect(() => {
    if (loading) return;
    
    const timer = setInterval(() => {
      setMachines(prevMachines => {
        const updatedMachines = { ...prevMachines };
        let shouldUpdate = false;
        
        // Update washer time
        if (updatedMachines.washer.status === 'in-use' && updatedMachines.washer.timeRemaining > 0) {
          updatedMachines.washer.timeRemaining -= 1;
          shouldUpdate = true;
          
          // Check if cycle just completed
          if (updatedMachines.washer.timeRemaining === 0) {
            updatedMachines.washer.status = 'complete';
            updatedMachines.washer.completeTimestamp = Date.now();
            updateMachineStatusToComplete('washer', updatedMachines.washer.user, updatedMachines.washer.userId);
          }
        }
        
        // Update dryer time
        if (updatedMachines.dryer.status === 'in-use' && updatedMachines.dryer.timeRemaining > 0) {
          updatedMachines.dryer.timeRemaining -= 1;
          shouldUpdate = true;
          
          // Check if cycle just completed
          if (updatedMachines.dryer.timeRemaining === 0) {
            updatedMachines.dryer.status = 'complete';
            updatedMachines.dryer.completeTimestamp = Date.now();
            updateMachineStatusToComplete('dryer', updatedMachines.dryer.user, updatedMachines.dryer.userId);
          }
        }
        
        return shouldUpdate ? updatedMachines : prevMachines;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, currentUser]);

  // Helper function to calculate remaining time based on server timestamps
  const calculateTimeRemaining = (startTimestamp, durationSeconds) => {
    if (!startTimestamp) return 0;
    
    const startTime = new Date(startTimestamp).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
    
    return remainingSeconds;
  };
  
  const handleRealtimeUpdate = (payload) => {
    const { new: updatedMachine, old: previousMachine } = payload;
    
    if (updatedMachine) {
      // Check if a machine status changed from complete to available (auto-released)
      if (previousMachine && 
          previousMachine.status === 'complete' && 
          updatedMachine.status === 'available' &&
          previousMachine.user_id) {
        
        // Show notification about auto-release
        const machineName = updatedMachine.machine_type.charAt(0).toUpperCase() + updatedMachine.machine_type.slice(1);
        const userName = previousMachine.user_name;
        addNotification(`${machineName} has been auto-released! ${userName}'s laundry may still be inside.`, 'info');
      }
      
      // Calculate current remaining time based on server timestamps
      let timeRemaining = 0;
      if (updatedMachine.status === 'in-use' && updatedMachine.start_timestamp) {
        timeRemaining = calculateTimeRemaining(
          updatedMachine.start_timestamp,
          updatedMachine.cycle_duration_seconds
        );
        
        // If time has actually run out, treat as complete even if DB hasn't updated yet
        if (timeRemaining === 0) {
          updatedMachine.status = 'complete';
          if (!updatedMachine.complete_timestamp) {
            updatedMachine.complete_timestamp = new Date().toISOString();
            // Update DB to mark as complete
            updateMachineStatusToComplete(
              updatedMachine.machine_type,
              updatedMachine.user_name,
              updatedMachine.user_id
            );
          }
        }
      }
      
      setMachines(prevMachines => ({
        ...prevMachines,
        [updatedMachine.machine_type]: {
          status: updatedMachine.status,
          user: updatedMachine.user_name,
          userId: updatedMachine.user_id,
          startTimestamp: updatedMachine.start_timestamp,
          cycleDurationSeconds: updatedMachine.cycle_duration_seconds,
          timeRemaining: timeRemaining,
          completeTimestamp: updatedMachine.complete_timestamp ? 
            new Date(updatedMachine.complete_timestamp).getTime() : null
        }
      }));
    }
  };

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove notification after 5 seconds
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    notificationTimeoutRef.current = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
          // Calculate current time remaining
          let timeRemaining = 0;
          let status = machine.status;
          let completeTimestamp = machine.complete_timestamp;
          
          if (status === 'in-use' && machine.start_timestamp) {
            timeRemaining = calculateTimeRemaining(
              machine.start_timestamp,
              machine.cycle_duration_seconds
            );
            
            // If time has run out but status hasn't been updated
            if (timeRemaining === 0) {
              status = 'complete';
              if (!completeTimestamp) {
                completeTimestamp = new Date().toISOString();
                // Update DB to mark as complete
                updateMachineStatusToComplete(
                  machine.machine_type,
                  machine.user_name,
                  machine.user_id
                );
              }
            }
          }
          
          machinesObj[machine.machine_type] = {
            status: status,
            user: machine.user_name,
            userId: machine.user_id,
            startTimestamp: machine.start_timestamp,
            cycleDurationSeconds: machine.cycle_duration_seconds,
            timeRemaining: timeRemaining,
            completeTimestamp: completeTimestamp ? 
              new Date(completeTimestamp).getTime() : null
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
  
  // Function to update database when machine completes
  const updateMachineStatusToComplete = async (machineType, userName, userId) => {
    try {
      const { error } = await supabase
        .from('machines')
        .update({
          status: 'complete',
          complete_timestamp: new Date().toISOString(),
          last_updated: new Date().toISOString()
        })
        .eq('machine_type', machineType);
        
      if (error) throw error;
      
      // Show notification
      if (userId === currentUser?.id) {
        addNotification(`Your ${machineType} cycle is complete!`, 'success');
      } else {
        addNotification(`${userName}'s ${machineType} cycle is complete!`, 'info');
      }
    } catch (error) {
      console.error(`Error updating ${machineType} to complete:`, error);
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
          start_timestamp: machineData.startTimestamp,
          cycle_duration_seconds: machineData.cycleDurationSeconds,
          complete_timestamp: machineData.completeTimestamp ? 
            new Date(machineData.completeTimestamp).toISOString() : null,
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
  
  const getNotificationColor = (type) => {
    switch(type) {
      case 'success': return 'bg-green-100 border-green-500 text-green-700';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'error': return 'bg-red-100 border-red-500 text-red-700';
      default: return 'bg-blue-100 border-blue-500 text-blue-700';
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
        const now = new Date();
        
        const updatedMachine = {
          status: 'in-use',
          user: currentUser.name,
          userId: currentUser.id,
          startTimestamp: now.toISOString(),
          cycleDurationSeconds: cycleTime * 60, // Convert to seconds
          timeRemaining: cycleTime * 60, // For UI display
          completeTimestamp: null
        };
        
        try {
          await updateMachineInDatabase(machine, updatedMachine);
          
          // Optimistic update
          setMachines(prevMachines => ({
            ...prevMachines,
            [machine]: updatedMachine
          }));
          
          // Show notification
          addNotification(`You claimed the ${machine}!`, 'success');
        } catch (error) {
          alert('Failed to claim machine. Please try again.');
        }
      } else {
        alert(`Please enter a valid time between 1 and ${maxTime} minutes.`);
      }
    }
  };

  // Handle extending time for a completed machine
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
        const now = new Date();
        
        const updatedMachine = {
          status: 'in-use',
          user: machine.user,
          userId: machine.userId,
          startTimestamp: now.toISOString(),
          cycleDurationSeconds: extensionTime * 60,
          timeRemaining: extensionTime * 60,
          completeTimestamp: null
        };
        
        try {
          await updateMachineInDatabase(machineType, updatedMachine);
          
          // Optimistic update
          setMachines(prevMachines => ({
            ...prevMachines,
            [machineType]: updatedMachine
          }));
          
          // Show notification
          addNotification(`Extended ${machineType} cycle for ${extensionTime} minutes.`, 'success');
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
            startTimestamp: null,
            cycleDurationSeconds: 0,
            timeRemaining: 0,
            completeTimestamp: null
          };
          
          try {
            await updateMachineInDatabase(machineType, updatedMachine);
            
            // Optimistic update
            setMachines(prevMachines => ({
              ...prevMachines,
              [machineType]: updatedMachine
            }));
            
            // Show notification
            addNotification(`You released the ${machineType}.`, 'success');
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

  // Helper function to calculate minutes until auto-release
  const getAutoReleaseCountdown = (completeTimestamp) => {
    if (!completeTimestamp) return 0;
    
    const minutesSinceComplete = (Date.now() - completeTimestamp) / (1000 * 60);
    const minutesRemaining = Math.max(0, 15 - Math.floor(minutesSinceComplete));
    return minutesRemaining;
  };

  // Helper function to get time formatting
  const getTimeRemainingStyle = (minutes) => {
    if (minutes <= 2) return 'text-red-600 font-bold animate-pulse';
    if (minutes <= 5) return 'text-orange-600 font-semibold';
    return 'text-orange-600';
  };
  
  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg flex justify-center">
        <p>Loading laundry status...</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg relative">
      {/* Notification system */}
      <div className="fixed top-4 right-4 left-4 z-50 flex flex-col gap-2 pointer-events-none md:w-96 md:left-auto">
        {notifications.map(notification => (
          <div 
            key={notification.id} 
            className={`${getNotificationColor(notification.type)} border-l-4 p-3 shadow-lg rounded pointer-events-auto flex justify-between items-center`}
          >
            <span>{notification.message}</span>
            <button 
              onClick={() => removeNotification(notification.id)} 
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

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
                {machines.washer.status === 'complete' && machines.washer.completeTimestamp && (
                  <p className={`text-xs ${getTimeRemainingStyle(getAutoReleaseCountdown(machines.washer.completeTimestamp))}`}>
                    Ready for pickup (auto-release in {getAutoReleaseCountdown(machines.washer.completeTimestamp)} min)
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
                  {/* Extend button */}
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
                {machines.dryer.status === 'complete' && machines.dryer.completeTimestamp && (
                  <p className={`text-xs ${getTimeRemainingStyle(getAutoReleaseCountdown(machines.dryer.completeTimestamp))}`}>
                    Ready for pickup (auto-release in {getAutoReleaseCountdown(machines.dryer.completeTimestamp)} min)
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
                  {/* Extend button */}
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