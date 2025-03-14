// Global variables
let currentUser = null;
let userPoints = {
  total: 0,
  monthlyTotal: 0
};
let userTasks = [];
let deferredPrompt = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication state
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      initializeApp();
    } else {
      // Redirect to login page if not authenticated
      window.location.href = 'login.html';
    }
  });

  // DOM event listeners
  document.getElementById('logout-btn').addEventListener('click', logoutUser);
  document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());
  document.getElementById('add-routine-btn').addEventListener('click', () => openTaskModal());
  document.getElementById('import-json-btn').addEventListener('click', () => document.getElementById('json-file-input').click());
  document.getElementById('json-file-input').addEventListener('change', handleJsonImport);
  document.getElementById('export-json-btn').addEventListener('click', exportTasksToJson);
  document.getElementById('cancel-task').addEventListener('click', closeTaskModal);
  document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
  document.querySelector('.close-modal').addEventListener('click', closeTaskModal);
  
  // Install button (for PWA)
  const installButton = document.getElementById('install-app');
  installButton.style.display = 'none';
  installButton.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        installButton.style.display = 'none';
      });
    }
  });
});

// PWA installation event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-app').style.display = 'block';
});

// Initialize app after successful login
function initializeApp() {
  // Show loading spinner
  document.getElementById('app-loading').classList.remove('hidden');
  document.getElementById('main-container').classList.add('hidden');
  
  // Update UI with user info
  if (currentUser.photoURL) {
    document.getElementById('user-photo').src = currentUser.photoURL;
  } else {
    document.getElementById('user-photo').src = 'images/default-avatar.png';
  }
  document.getElementById('user-name').textContent = currentUser.displayName || currentUser.email;
  
  // Fetch user data
  fetchUserData().then(() => {
    // Hide loading spinner
    document.getElementById('app-loading').classList.add('hidden');
    document.getElementById('main-container').classList.remove('hidden');
    
    // Update UI based on whether user has tasks or not
    updateUI();
  }).catch(error => {
    console.error("Error initializing app:", error);
    alert("Failed to load your data. Please refresh the page.");
  });

  // Set up midnight reset timer
  setupMidnightReset();
}

// Fetch user data from Firestore
async function fetchUserData() {
  // Get user document reference
  const userRef = db.collection('users').doc(currentUser.uid);
  const userDoc = await userRef.get();
  
  // If user exists in database
  if (userDoc.exists) {
    const userData = userDoc.data();
    
    // Get points
    userPoints.total = userData.totalPoints || 0;
    userPoints.monthlyTotal = userData.monthlyPoints || 0;
    
    // Update points display
    updatePointsDisplay();
    
    // Get tasks
    const tasksSnapshot = await userRef.collection('tasks').get();
    userTasks = [];
    tasksSnapshot.forEach(doc => {
      userTasks.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort tasks by start time
    userTasks.sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
  } else {
    // Create new user document if it doesn't exist
    await userRef.set({
      name: currentUser.displayName || '',
      email: currentUser.email,
      totalPoints: 0,
      monthlyPoints: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Update UI based on tasks
function updateUI() {
  // Show welcome screen or task list
  if (userTasks.length === 0) {
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('routine-list').classList.add('hidden');
    document.getElementById('pending-list').classList.add('hidden');
  } else {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('routine-list').classList.remove('hidden');
    
    // Render tasks
    renderTasks();
    
    // Check for pending tasks
    const pendingTasks = userTasks.filter(task => task.status === 'pending');
    if (pendingTasks.length > 0) {
      document.getElementById('pending-list').classList.remove('hidden');
      renderPendingTasks(pendingTasks);
    } else {
      document.getElementById('pending-list').classList.add('hidden');
    }
    
    // Update pending tasks count
    document.getElementById('pending-tasks').textContent = pendingTasks.length;
  }
}

// Render all tasks
function renderTasks() {
  const tasksContainer = document.getElementById('tasks-container');
  tasksContainer.innerHTML = '';
  
  userTasks.forEach(task => {
    // Skip rendering pending tasks in the main list
    if (task.status === 'pending') return;
    
    const taskElement = createTaskElement(task);
    tasksContainer.appendChild(taskElement);
  });
}

// Render pending tasks
function renderPendingTasks(pendingTasks) {
  const pendingContainer = document.getElementById('pending-tasks-container');
  pendingContainer.innerHTML = '';
  
  pendingTasks.forEach(task => {
    const taskElement = createTaskElement(task);
    pendingContainer.appendChild(taskElement);
  });
}

// Create task element
function createTaskElement(task) {
  const taskElement = document.createElement('div');
  taskElement.className = `task-item ${task.status === 'completed' ? 'completed-task' : ''}`;
  taskElement.dataset.id = task.id;
  
  // Format time display
  const startTime = formatTimeDisplay(task.startTime);
  const endTime = formatTimeDisplay(task.endTime);
  
  taskElement.innerHTML = `
    <div class="task-info">
      <div class="task-time">${startTime} - ${endTime}</div>
      <div class="task-title">${task.title}</div>
    </div>
    <div class="task-actions">
      <div class="task-points">+10 pts</div>
      ${task.status !== 'completed' ? `
      <button class="btn-icon complete-task" title="Mark as Complete">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>
      </button>
      ` : ''}
      <button class="btn-icon edit-task" title="Edit Task">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M15.728 9.686l-1.414-1.414L5 17.586V19h1.414l9.314-9.314zm1.414-1.414l1.414-1.414-1.414-1.414-1.414 1.414 1.414 1.414zM7.242 21H3v-4.242l12.728-12.728 4.242 4.242L7.242 21z"/></svg>
      </button>
      <button class="btn-icon delete-task" title="Delete Task">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>
      </button>
    </div>
  `;
  
  // Add event listeners to task buttons
  const completeBtn = taskElement.querySelector('.complete-task');
  if (completeBtn) {
    completeBtn.addEventListener('click', () => completeTask(task.id));
  }
  
  taskElement.querySelector('.edit-task').addEventListener('click', () => openTaskModal(task));
  taskElement.querySelector('.delete-task').addEventListener('click', () => deleteTask(task.id));
  
  return taskElement;
}

// Format time from 24h to 12h format
function formatTimeDisplay(time) {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Open task modal (for add/edit)
function openTaskModal(task = null) {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const modalTitle = document.getElementById('modal-title');
  
  // Reset form
  form.reset();
  
  if (task) {
    // Edit mode
    modalTitle.textContent = 'Edit Task';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('start-time').value = task.startTime;
    document.getElementById('end-time').value = task.endTime;
  } else {
    // Add mode
    modalTitle.textContent = 'Add New Task';
    document.getElementById('task-id').value = '';
  }
  
  modal.style.display = 'block';
}

// Close task modal
function closeTaskModal() {
  const modal = document.getElementById('task-modal');
  modal.style.display = 'none';
}

// Handle task form submit
async function handleTaskSubmit(e) {
  e.preventDefault();
  
  const taskId = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value;
  const startTime = document.getElementById('start-time').value;
  const endTime = document.getElementById('end-time').value;
  
  // Validate time range
  if (startTime >= endTime) {
    alert('End time must be after start time');
    return;
  }
  
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    
    if (taskId) {
      // Update existing task
      await userRef.collection('tasks').doc(taskId).update({
        title,
        startTime,
        endTime,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update task in local array
      const index = userTasks.findIndex(task => task.id === taskId);
      if (index !== -1) {
        userTasks[index] = {
          ...userTasks[index],
          title,
          startTime,
          endTime
        };
      }
    } else {
      // Add new task
      const newTaskRef = await userRef.collection('tasks').add({
        title,
        startTime,
        endTime,
        status: 'incomplete',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Add task to local array
      userTasks.push({
        id: newTaskRef.id,
        title,
        startTime,
        endTime,
        status: 'incomplete'
      });
    }
    
    // Sort tasks by start time
    userTasks.sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
    
    // Close modal and update UI
    closeTaskModal();
    updateUI();
    
  } catch (error) {
    console.error("Error saving task:", error);
    alert("Failed to save task. Please try again.");
  }
}

// Complete task
async function completeTask(taskId) {
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    const taskRef = userRef.collection('tasks').doc(taskId);
    
    // Get task
    const taskIndex = userTasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return;
    
    const task = userTasks[taskIndex];
    let pointsToAdd = 0;
    
    // Determine points based on status
    if (task.status === 'incomplete') {
      // Normal completion (+10 points)
      pointsToAdd = 10;
    } else if (task.status === 'pending') {
      // Late completion (+5 points, previously deducted 5)
      pointsToAdd = 5;
    }
    
    // Update task status in database
    await taskRef.update({
      status: 'completed',
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update points in database
    await userRef.update({
      totalPoints: firebase.firestore.FieldValue.increment(pointsToAdd),
      monthlyPoints: firebase.firestore.FieldValue.increment(pointsToAdd)
    });
    
    // Update local data
    userTasks[taskIndex].status = 'completed';
    userPoints.total += pointsToAdd;
    userPoints.monthlyTotal += pointsToAdd;
    
    // Update UI
    updatePointsDisplay();
    updateUI();
    
  } catch (error) {
    console.error("Error completing task:", error);
    alert("Failed to complete task. Please try again.");
  }
}

// Delete task
async function deleteTask(taskId) {
  if (!confirm("Are you sure you want to delete this task?")) return;
  
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    
    // Delete from database
    await userRef.collection('tasks').doc(taskId).delete();
    
    // Delete from local array
    userTasks = userTasks.filter(task => task.id !== taskId);
    
    // Update UI
    updateUI();
    
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Failed to delete task. Please try again.");
  }
}

// Export tasks to JSON
function exportTasksToJson() {
  if (userTasks.length === 0) {
    alert("You don't have any tasks to export.");
    return;
  }
  
  const tasksToExport = userTasks.map(({ id, createdAt, updatedAt, completedAt, ...rest }) => rest);
  const dataStr = JSON.stringify(tasksToExport, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportName = `daily-routine-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportName);
  linkElement.click();
}

// Handle JSON import
function handleJsonImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const tasks = JSON.parse(event.target.result);
      
      if (!Array.isArray(tasks)) {
        throw new Error("Invalid format: data must be an array");
      }
      
      if (tasks.length === 0) {
        alert("The imported file contains no tasks.");
        return;
      }
      
      // Validate task structure
      for (const task of tasks) {
        if (!task.title || !task.startTime || !task.endTime) {
          throw new Error("Invalid task format: each task must have title, startTime, and endTime");
        }
      }
      
      // Confirm import
      if (!confirm(`Import ${tasks.length} tasks? This will not affect your existing tasks.`)) {
        return;
      }
      
      // Import tasks
      await importTasks(tasks);
      
      // Reset file input
      e.target.value = '';
      
    } catch (error) {
      console.error("Error importing JSON:", error);
      alert(`Failed to import JSON: ${error.message}`);
    }
  };
  
  reader.readAsText(file);
}

// Import tasks from parsed JSON
async function importTasks(tasks) {
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    const batch = db.batch();
    
    const importedTasks = [];
    
    // Prepare batch of tasks to add
    for (const task of tasks) {
      const newTaskRef = userRef.collection('tasks').doc();
      
      batch.set(newTaskRef, {
        title: task.title,
        startTime: task.startTime,
        endTime: task.endTime,
        status: 'incomplete',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      importedTasks.push({
        id: newTaskRef.id,
        title: task.title,
        startTime: task.startTime,
        endTime: task.endTime,
        status: 'incomplete'
      });
    }
    
    // Commit the batch
    await batch.commit();
    
    // Add imported tasks to local array
    userTasks = [...userTasks, ...importedTasks];
    
    // Sort tasks by start time
    userTasks.sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
    
    // Update UI
    updateUI();
    
    alert(`Successfully imported ${tasks.length} tasks.`);
    
  } catch (error) {
    console.error("Error importing tasks:", error);
    alert("Failed to import tasks. Please try again.");
  }
}

// Update points display
function updatePointsDisplay() {
  document.getElementById('total-points').textContent = userPoints.total;
  document.getElementById('current-month-points').textContent = userPoints.monthlyTotal;
}

// Reset overdue tasks and handle points deduction
async function checkAndResetOverdueTasks() {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const isTwoAMIST = currentTime >= 2 * 60 && currentTime < 2 * 60 + 5;
  
  // Only run at 2 AM IST
  if (!isTwoAMIST) return;
  
  const isLastDayOfMonth = now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    const batch = db.batch();
    let pointsToDeduct = 0;
    
    for (const task of userTasks) {
      if (task.status === 'incomplete') {
        // Mark as pending and deduct points
        const taskRef = userRef.collection('tasks').doc(task.id);
        batch.update(taskRef, {
          status: 'pending',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local task status
        task.status = 'pending';
        pointsToDeduct += 5;
      }
    }
    
    // Reset monthly points at month end
    if (isLastDayOfMonth) {
      batch.update(userRef, {
        monthlyPoints: 0
      });
      userPoints.monthlyTotal = 0;
    }
    
    // Deduct points for incomplete tasks
    if (pointsToDeduct > 0) {
      batch.update(userRef, {
        totalPoints: firebase.firestore.FieldValue.increment(-pointsToDeduct),
        monthlyPoints: firebase.firestore.FieldValue.increment(-pointsToDeduct)
      });
      
      userPoints.total -= pointsToDeduct;
      if (!isLastDayOfMonth) {
        userPoints.monthlyTotal -= pointsToDeduct;
      }
    }
    
    // Commit changes
    await batch.commit();
    
    // Update UI
    updatePointsDisplay();
    updateUI();
    
  } catch (error) {
    console.error("Error resetting tasks:", error);
  }
}

// Set up timer for midnight task reset
function setupMidnightReset() {
  // Check for overdue tasks immediately
  checkAndResetOverdueTasks();
  
  // Set up periodic check (every hour)
  setInterval(checkAndResetOverdueTasks, 60 * 60 * 1000);
}

// Logout user
function logoutUser() {
  auth.signOut().then(() => {
    window.location.href = 'login.html';
  }).catch(error => {
    console.error("Error signing out:", error);
  });
}