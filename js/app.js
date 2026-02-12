console.log('=== APP.JS LOADED ===');

// ========================================
// OJT HOURS TRACKER - MAIN APPLICATION
// ========================================

// Global Variables
let currentUser = null;
let totalRequiredHours = 486;
let timeEntries = [];

// DOM Elements - will be initialized after DOM loads
let heroSection, appSection, loginBtn, logoutBtn, ctaLoginBtn;
let userInfo, userName, userPhoto, timeEntryForm, historyList, totalRequiredHoursInput;
let progressPercentage, completedHours, totalHours, remainingHours, progressCircle, historyTotalHours;

// ========================================
// WAIT FOR FIREBASE TO LOAD
// ========================================

function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = setInterval(() => {
            if (window.firebaseAuth && window.firebaseDb && window.firebaseModules) {
                clearInterval(checkFirebase);
                console.log('✅ Firebase loaded successfully!');
                resolve();
            } else {
                console.log('⏳ Waiting for Firebase...');
            }
        }, 100);
    });
}

// ========================================
// INITIALIZE APP
// ========================================

async function initializeApp() {
    console.log('🚀 Initializing app...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    console.log('✅ DOM loaded');
    
    // Initialize DOM elements
    heroSection = document.getElementById('heroSection');
    appSection = document.getElementById('appSection');
    loginBtn = document.getElementById('loginBtn');
    logoutBtn = document.getElementById('logoutBtn');
    ctaLoginBtn = document.getElementById('ctaLoginBtn');
    userInfo = document.getElementById('userInfo');
    userName = document.getElementById('userName');
    userPhoto = document.getElementById('userPhoto');
    timeEntryForm = document.getElementById('timeEntryForm');
    historyList = document.getElementById('historyList');
    totalRequiredHoursInput = document.getElementById('totalRequiredHours');
    
    // Progress Elements
    progressPercentage = document.getElementById('progressPercentage');
    completedHours = document.getElementById('completedHours');
    totalHours = document.getElementById('totalHours');
    remainingHours = document.getElementById('remainingHours');
    progressCircle = document.getElementById('progressCircle');
    historyTotalHours = document.getElementById('historyTotalHours');
    
    console.log('✅ DOM elements initialized');
    console.log('Login button:', loginBtn);
    console.log('CTA button:', ctaLoginBtn);
    
    // Wait for Firebase to load
    await waitForFirebase();
    
    // Set up event listeners AFTER Firebase is loaded
    setupEventListeners();
    
    // Set up auth state observer
    setupAuthObserver();
    
    // Set today's date as default
    document.getElementById('entryDate').valueAsDate = new Date();
    
    console.log('✅ App initialized successfully!');
}

// ========================================
// AUTHENTICATION
// ========================================

// Login with Google
async function loginWithGoogle() {
    console.log('🔐 Login button clicked!');
    
    if (!window.firebaseAuth || !window.firebaseModules) {
        console.error('❌ Firebase not loaded yet!');
        alert('Please wait a moment and try again. Firebase is still loading...');
        return;
    }
    
    try {
        console.log('Attempting Google sign-in...');
        const result = await window.firebaseModules.signInWithPopup(
            window.firebaseAuth,
            window.googleProvider
        );
        currentUser = result.user;
        console.log('✅ User logged in:', currentUser.displayName);
    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'auth/popup-blocked') {
            alert('Popup was blocked! Please allow popups for this site and try again.');
        } else if (error.code === 'auth/unauthorized-domain') {
            alert('This domain is not authorized. Please add it in Firebase Console → Authentication → Settings → Authorized domains.');
        } else {
            alert('Login failed: ' + error.message);
        }
    }
}

// Logout
async function logout() {
    try {
        await window.firebaseModules.signOut(window.firebaseAuth);
        currentUser = null;
        timeEntries = [];
        showHeroSection();
        console.log('User logged out');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Set up Auth State Observer
function setupAuthObserver() {
    window.firebaseModules.onAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            currentUser = user;
            userName.textContent = user.displayName;
            userPhoto.src = user.photoURL;
            
            // Show logged in UI
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            userInfo.style.display = 'flex';
            
            // Load user data
            await loadUserData();
            await loadTimeEntries();
            
            // Show app section
            showAppSection();
        } else {
            currentUser = null;
            
            // Show logged out UI
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            userInfo.style.display = 'none';
            
            showHeroSection();
        }
    });
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Login buttons
    loginBtn.addEventListener('click', () => {
        console.log('Nav login button clicked');
        loginWithGoogle();
    });
    
    ctaLoginBtn.addEventListener('click', () => {
        console.log('CTA login button clicked');
        loginWithGoogle();
    });
    
    // Logout button
    logoutBtn.addEventListener('click', logout);
    
    // Form submission
    timeEntryForm.addEventListener('submit', handleFormSubmit);
    
    // Total hours input
    totalRequiredHoursInput.addEventListener('change', async () => {
        totalRequiredHours = parseInt(totalRequiredHoursInput.value) || 486;
        await saveUserData();
        updateProgress();
    });
    
    console.log('✅ Event listeners set up');
}

// ========================================
// UI TRANSITIONS
// ========================================

function showAppSection() {
    heroSection.style.display = 'none';
    appSection.style.display = 'block';
    updateProgress();
}

function showHeroSection() {
    heroSection.style.display = 'flex';
    appSection.style.display = 'none';
}

// ========================================
// DATABASE OPERATIONS
// ========================================

// Load User Settings
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const q = window.firebaseModules.query(
            window.firebaseModules.collection(window.firebaseDb, 'users'),
            window.firebaseModules.where('userId', '==', currentUser.uid)
        );
        
        const userDoc = await window.firebaseModules.getDocs(q);
        
        if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            totalRequiredHours = userData.totalRequiredHours || 486;
            totalRequiredHoursInput.value = totalRequiredHours;
        } else {
            // Create user document
            await saveUserData();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Save User Settings
async function saveUserData() {
    if (!currentUser) return;
    
    try {
        const usersRef = window.firebaseModules.collection(window.firebaseDb, 'users');
        
        await window.firebaseModules.addDoc(usersRef, {
            userId: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            totalRequiredHours: totalRequiredHours,
            updatedAt: new Date().toISOString()
        });
        
        console.log('User data saved/updated');
    } catch (error) {
        console.log('User data save attempt:', error.message);
    }
}

// Load Time Entries
async function loadTimeEntries() {
    if (!currentUser) return;
    
    try {
        const q = window.firebaseModules.query(
            window.firebaseModules.collection(window.firebaseDb, 'timeEntries'),
            window.firebaseModules.where('userId', '==', currentUser.uid),
            window.firebaseModules.orderBy('date', 'desc')
        );
        
        const querySnapshot = await window.firebaseModules.getDocs(q);
        timeEntries = [];
        
        querySnapshot.forEach((doc) => {
            timeEntries.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderTimeEntries();
        updateProgress();
    } catch (error) {
        console.error('Error loading time entries:', error);
        // If orderBy fails (index not created), try without ordering
        try {
            const q = window.firebaseModules.query(
                window.firebaseModules.collection(window.firebaseDb, 'timeEntries'),
                window.firebaseModules.where('userId', '==', currentUser.uid)
            );
            
            const querySnapshot = await window.firebaseModules.getDocs(q);
            timeEntries = [];
            
            querySnapshot.forEach((doc) => {
                timeEntries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Sort manually
            timeEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            renderTimeEntries();
            updateProgress();
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
        }
    }
}

// Add Time Entry
async function addTimeEntry(entryData) {
    if (!currentUser) return;
    
    try {
        const docRef = await window.firebaseModules.addDoc(
            window.firebaseModules.collection(window.firebaseDb, 'timeEntries'),
            {
                ...entryData,
                userId: currentUser.uid,
                createdAt: new Date().toISOString()
            }
        );
        
        console.log('Time entry added:', docRef.id);
        await loadTimeEntries();
    } catch (error) {
        console.error('Error adding time entry:', error);
        alert('Failed to add time entry. Please try again.');
    }
}

// Delete Time Entry
async function deleteTimeEntry(entryId) {
    if (!currentUser) return;
    
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
        await window.firebaseModules.deleteDoc(
            window.firebaseModules.doc(window.firebaseDb, 'timeEntries', entryId)
        );
        
        console.log('Time entry deleted:', entryId);
        await loadTimeEntries();
    } catch (error) {
        console.error('Error deleting time entry:', error);
        alert('Failed to delete entry. Please try again.');
    }
}

// ========================================
// TIME CALCULATIONS
// ========================================

function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;
    
    const [inHours, inMinutes] = timeIn.split(':').map(Number);
    const [outHours, outMinutes] = timeOut.split(':').map(Number);
    
    const inTotalMinutes = inHours * 60 + inMinutes;
    const outTotalMinutes = outHours * 60 + outMinutes;
    
    let diffMinutes = outTotalMinutes - inTotalMinutes;
    
    // Handle overnight shifts
    if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
    }
    
    return diffMinutes / 60;
}

function formatTime(time) {
    if (!time) return '--:--';
    return time;
}

// ========================================
// FORM HANDLING
// ========================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const date = document.getElementById('entryDate').value;
    const morningIn = document.getElementById('morningIn').value;
    const morningOut = document.getElementById('morningOut').value;
    const afternoonIn = document.getElementById('afternoonIn').value;
    const afternoonOut = document.getElementById('afternoonOut').value;
    const eveningIn = document.getElementById('eveningIn').value;
    const eveningOut = document.getElementById('eveningOut').value;
    
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    const morningHours = calculateHours(morningIn, morningOut);
    const afternoonHours = calculateHours(afternoonIn, afternoonOut);
    const eveningHours = calculateHours(eveningIn, eveningOut);
    const totalHours = morningHours + afternoonHours + eveningHours;
    
    if (totalHours === 0) {
        alert('Please enter at least one time shift');
        return;
    }
    
    const entryData = {
        date: date,
        morning: {
            timeIn: morningIn,
            timeOut: morningOut,
            hours: morningHours
        },
        afternoon: {
            timeIn: afternoonIn,
            timeOut: afternoonOut,
            hours: afternoonHours
        },
        evening: {
            timeIn: eveningIn,
            timeOut: eveningOut,
            hours: eveningHours
        },
        totalHours: totalHours
    };
    
    await addTimeEntry(entryData);
    
    // Reset form
    timeEntryForm.reset();
    document.getElementById('entryDate').valueAsDate = new Date();
}

// ========================================
// RENDER FUNCTIONS
// ========================================

function renderTimeEntries() {
    if (timeEntries.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="url(#emptyGradient)" stroke-width="2" opacity="0.3"/>
                    <path d="M32 20V32L40 40" stroke="url(#emptyGradient)" stroke-width="2" stroke-linecap="round"/>
                    <defs>
                        <linearGradient id="emptyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#8b5cf6"/>
                            <stop offset="100%" style="stop-color:#ec4899"/>
                        </linearGradient>
                    </defs>
                </svg>
                <p>No time entries yet</p>
                <span>Start tracking your OJT hours above</span>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = timeEntries.map(entry => {
        const entryDate = new Date(entry.date);
        const formattedDate = entryDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        return `
            <div class="history-entry">
                <div class="entry-header">
                    <div class="entry-date">${formattedDate}</div>
                    <div class="entry-total">${entry.totalHours.toFixed(2)} hours</div>
                </div>
                <div class="entry-details">
                    ${entry.morning.hours > 0 ? `
                        <div class="entry-shift">
                            <strong>Morning:</strong> ${formatTime(entry.morning.timeIn)} - ${formatTime(entry.morning.timeOut)} 
                            (${entry.morning.hours.toFixed(2)} hrs)
                        </div>
                    ` : ''}
                    ${entry.afternoon.hours > 0 ? `
                        <div class="entry-shift">
                            <strong>Afternoon:</strong> ${formatTime(entry.afternoon.timeIn)} - ${formatTime(entry.afternoon.timeOut)} 
                            (${entry.afternoon.hours.toFixed(2)} hrs)
                        </div>
                    ` : ''}
                    ${entry.evening.hours > 0 ? `
                        <div class="entry-shift">
                            <strong>Evening:</strong> ${formatTime(entry.evening.timeIn)} - ${formatTime(entry.evening.timeOut)} 
                            (${entry.evening.hours.toFixed(2)} hrs)
                        </div>
                    ` : ''}
                </div>
                <div class="entry-actions">
                    <button class="btn-delete" onclick="deleteTimeEntry('${entry.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateProgress() {
    const totalCompleted = timeEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
    const remaining = Math.max(0, totalRequiredHours - totalCompleted);
    const percentage = Math.min(100, (totalCompleted / totalRequiredHours) * 100);
    
    // Update text
    progressPercentage.textContent = `${Math.round(percentage)}%`;
    completedHours.textContent = totalCompleted.toFixed(1);
    totalHours.textContent = totalRequiredHours;
    remainingHours.textContent = remaining.toFixed(1);
    historyTotalHours.textContent = totalCompleted.toFixed(1);
    
    // Update circular progress
    const circumference = 2 * Math.PI * 120; // radius = 120
    const offset = circumference - (percentage / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;
}

// Make deleteTimeEntry available globally
window.deleteTimeEntry = deleteTimeEntry;

// ========================================
// START THE APP
// ========================================

initializeApp();