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
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [browserNotificationsSupported, setBrowserNotificationsSupported] = useState(false);
  const [notifications, setNotifications] = useState({
    washer: { tenMinWarning: false, complete: false },
    dryer: { tenMinWarning: false, complete: false }
  });
  const [showHowToUse, setShowHowToUse] = useState(false);
  // For in-app notifications
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const notificationTimeoutRef = useRef(null);

  // Set up user identity and notifications on component mount
  useEffect(() => {
    // Check if browser notifications are supported
    const isNotificationSupported = 'Notification' in window;
    setBrowserNotificationsSupported(isNotificationSupported);

    // Try to get user ID from local storage
    const userId = localStorage.getItem('laundryUserId');
    const userName = localStorage.getItem('laundryUserName');
    
    // Get notification preferences from local storage
    const storedNotificationPref = localStorage.getItem('laundryNotificationsEnabled');
    if (storedNotificationPref !== null) {
      setNotificationsEnabled(storedNotificationPref === 'true');
    }
    
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

    // Check notification permission if supported
    if (isNotificationSupported) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save notification preference when it changes
  useEffect(() => {
    localStorage.setItem('laundryNotificationsEnabled', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  // Cleanup notification timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
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
          
          // Check for notifications if they're enabled
          if (notificationsEnabled && currentUser && updatedMachines.washer.userId === currentUser.id) {
            // 10 minute warning notification
            if (updatedMachines.washer.timeRemaining === 600 && !notifications.washer.tenMinWarning) {
              sendNotification('Washer', '10 minutes remaining on your laundry!');
              setNotifications(prev => ({
                ...prev,
                washer: { ...prev.washer, tenMinWarning: true }
              }));
            }
            
            // Completion notification
            if (updatedMachines.washer.timeRemaining === 0 && !notifications.washer.complete) {
              sendNotification('Washer', 'Your laundry is done!');
              setNotifications(prev => ({
                ...prev,
                washer: { ...prev.washer, complete: true }
              }));
            }
          }
          
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
          
          // Check for notifications if they're enabled
          if (notificationsEnabled && currentUser && updatedMachines.dryer.userId === currentUser.id) {
            // 10 minute warning notification
            if (updatedMachines.dryer.timeRemaining === 600 && !notifications.dryer.tenMinWarning) {
              sendNotification('Dryer', '10 minutes remaining on your laundry!');
              setNotifications(prev => ({
                ...prev,
                dryer: { ...prev.dryer, tenMinWarning: true }
              }));
            }
            
            // Completion notification
            if (updatedMachines.dryer.timeRemaining === 0 && !notifications.dryer.complete) {
              sendNotification('Dryer', 'Your laundry is done!');
              setNotifications(prev => ({
                ...prev,
                dryer: { ...prev.dryer, complete: true }
              }));
            }
          }
          
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
  }, [loading, currentUser, notifications, notificationsEnabled]);
  
  const sendNotification = (machine, message) => {
    // Only send if notifications are enabled
    if (!notificationsEnabled) return;
    
    // Browser notification if supported and permission granted
    if (browserNotificationsSupported && notificationPermission === 'granted') {
      new Notification(`Laundry Alert: ${machine}`, {
        body: message,
        icon: '/favicon.ico' // Replace with your app's icon
      });
    } else {
      // Fallback to in-app notification
      const newNotification = {
        id: Date.now(),
        title: `${machine}`,
        message: message,
        timestamp: new Date()
      };
      
      setInAppNotifications(prev => [newNotification, ...prev.slice(0, 2)]); // Keep only last 3 notifications
      
      // Auto-dismiss in-app notification after 10 seconds
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      
      notificationTimeoutRef.current = setTimeout(() => {
        setInAppNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, 10000);
    }
  };

  const requestNotificationPermission = async () => {
    if (browserNotificationsSupported) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      // If permission was granted, make sure notifications are enabled
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      }
      
      return permission;
    }
    
    // If notifications aren't supported, just enable in-app notifications
    setNotificationsEnabled(true);
    return 'denied';
  };
  
  // Toggle notifications on/off
  const toggleNotifications = () => {
    // If browser notifications are supported and aren't granted yet but we're turning them on
    if (browserNotificationsSupported && notificationPermission !== 'granted' && !notificationsEnabled) {
      requestNotificationPermission().then((permission) => {
        if (permission === 'granted' || !browserNotificationsSupported) {
          setNotificationsEnabled(true);
        }
      });
    } else {
      // Otherwise just toggle the current state
      setNotificationsEnabled(!notificationsEnabled);
    }
  };
  
  // Dismiss a specific in-app notification
  const dismissNotification = (notificationId) => {
    setInAppNotifications(prev => prev.filter(n => n.id !== notificationId));
  };
  
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
      
      // Reset notification flags when a machine becomes available
      if (updatedMachine.status === 'available') {
        setNotifications(prev => ({
          ...prev,
          [updatedMachine.machine_type]: { tenMinWarning: false, complete: false }
        }));
      }
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
    
    // Request notification permission when claiming a machine if notifications are enabled
    // and browser notifications are supported
    if (notificationsEnabled && browserNotificationsSupported && notificationPermission === 'default') {
      await requestNotificationPermission();
    }
    
    if (machines[machine].status === 'available') {
      // Set max time limits
      const maxTime = machine === 'washer' ? 60 : 120;
      const cycleTime = parseInt(prompt(`Enter estimated cycle time in minutes (max ${maxTime}):`, '30'));
      
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
          
          // Reset notification flags
          setNotifications(prev => ({
            ...prev,
            [machine]: { tenMinWarning: false, complete: false }
          }));
          
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
            
            // Reset notification flags
            setNotifications(prev => ({
              ...prev,
              [machineType]: { tenMinWarning: false, complete: false }
            }));
            
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

  // Helper function to format notification timestamp
  const formatNotificationTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        <h1 className="text-2xl font-bold">Laundry Status</h1>
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
      
      {/* In-app notifications */}
      {inAppNotifications.length > 0 && (
        <div className="mb-4">
          {inAppNotifications.map(notification => (
            <div 
              key={notification.id} 
              className="flex justify-between items-start p-3 mb-2 bg-blue-50 border-l-4 border-blue-500 rounded shadow-sm"
            >
              <div>
                <div className="font-medium">
                  {notification.title} Alert
                </div>
                <div className="text-sm">{notification.message}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatNotificationTime(notification.timestamp)}
                </div>
              </div>
              <button 
                onClick={() => dismissNotification(notification.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      
      {currentUser && (
        <div className="mb-4 text-sm bg-blue-50 p-3 rounded">
          <div className="flex justify-between items-center">
            <p className="font-semibold">{currentUser.name}</p>
            
            <div className="flex items-center space-x-2">
              {browserNotificationsSupported && notificationPermission !== 'granted' ? (
                <button
                  onClick={requestNotificationPermission}
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                >
                  Enable Notifications
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className={`text-xs ${notificationsEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {browserNotificationsSupported ? 'Notifications' : 'In-app Alerts'}: {notificationsEnabled ? 'ON' : 'OFF'}
                  </span>
                  
                  {/* Toggle Switch */}
                  <button 
                    onClick={toggleNotifications} 
                    className={`relative inline-flex items-center h-5 rounded-full w-10 transition-colors focus:outline-none ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {!browserNotificationsSupported && notificationsEnabled && (
            <p className="text-xs text-gray-600 mt-1">
              Your browser doesn't support notifications - using in-app alerts instead
            </p>
          )}
        </div>
      )}
      
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
                  disabled={!currentUser}
                >
                  Claim
                </button>
              ) : machines.washer.status === 'complete' ? (
                <div className="flex flex-col items-end">
                  <div className="text-yellow-600 font-medium mb-1">Ready for pickup</div>
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
                  <div className="text-gray-500 text-sm mb-1">
                    Available in {formatTime(machines.washer.timeRemaining)}
                  </div>
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
                  disabled={!currentUser}
                >
                  Claim
                </button>
              ) : machines.dryer.status === 'complete' ? (
                <div className="flex flex-col items-end">
                  <div className="text-yellow-600 font-medium mb-1">Ready for pickup</div>
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
                  <div className="text-gray-500 text-sm mb-1">
                    Available in {formatTime(machines.dryer.timeRemaining)}
                  </div>
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