console.log('=== APP.JS LOADED ===');

// ========================================
// OJT HOURS TRACKER - MAIN APPLICATION
// ========================================

// Global Variables
let currentUser = null;
let totalRequiredHours = 486;
let timeEntries = [];

// DOM Elements
let heroSection, appSection, loginBtn, logoutBtn, ctaLoginBtn;
let userInfo, userName, userPhoto, timeEntryForm, historyList, totalRequiredHoursInput;
let progressPercentage, completedHours, totalHours, remainingHours, progressCircle, historyTotalHours;

// ========================================
// TOAST NOTIFICATION (Y2K Style)
// ========================================

function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.y2k-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'y2k-toast' + (type === 'error' ? ' toast-error' : '');
    toast.innerHTML = `<span>${type === 'error' ? '✖' : '✔'}</span> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

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

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }

    console.log('✅ DOM loaded');

    // Init DOM elements
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

    progressPercentage = document.getElementById('progressPercentage');
    completedHours = document.getElementById('completedHours');
    totalHours = document.getElementById('totalHours');
    remainingHours = document.getElementById('remainingHours');
    progressCircle = document.getElementById('progressCircle');
    historyTotalHours = document.getElementById('historyTotalHours');

    console.log('✅ DOM elements initialized');

    await waitForFirebase();

    setupEventListeners();
    setupAuthObserver();

    // Default to today's date
    document.getElementById('entryDate').valueAsDate = new Date();

    console.log('✅ App initialized!');
}

// ========================================
// AUTHENTICATION
// ========================================

async function loginWithGoogle() {
    console.log('🔐 Login button clicked!');

    if (!window.firebaseAuth || !window.firebaseModules) {
        showToast('Firebase still loading. Please wait...', 'error');
        return;
    }

    try {
        const result = await window.firebaseModules.signInWithPopup(
            window.firebaseAuth,
            window.googleProvider
        );
        currentUser = result.user;
        console.log('✅ User logged in:', currentUser.displayName);
    } catch (error) {
        console.error('❌ Login error:', error);
        if (error.code === 'auth/popup-blocked') {
            showToast('Popup blocked! Please allow popups and try again.', 'error');
        } else if (error.code === 'auth/unauthorized-domain') {
            showToast('Domain not authorized. Check Firebase settings.', 'error');
        } else {
            showToast('Login failed: ' + error.message, 'error');
        }
    }
}

async function logout() {
    try {
        await window.firebaseModules.signOut(window.firebaseAuth);
        currentUser = null;
        timeEntries = [];
        showHeroSection();
        showToast('Logged out successfully.');
        console.log('User logged out');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed.', 'error');
    }
}

function setupAuthObserver() {
    window.firebaseModules.onAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            currentUser = user;
            userName.textContent = user.displayName;
            userPhoto.src = user.photoURL;

            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            userInfo.style.display = 'flex';

            await loadUserData();
            await loadTimeEntries();

            showAppSection();
        } else {
            currentUser = null;

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

    loginBtn.addEventListener('click', () => {
        console.log('Nav login clicked');
        loginWithGoogle();
    });

    ctaLoginBtn.addEventListener('click', () => {
        console.log('CTA login clicked');
        loginWithGoogle();
    });

    logoutBtn.addEventListener('click', logout);
    timeEntryForm.addEventListener('submit', handleFormSubmit);

    totalRequiredHoursInput.addEventListener('change', async () => {
        totalRequiredHours = parseInt(totalRequiredHoursInput.value) || 486;
        await saveUserData();
        updateProgress();
    });

    // ★ Quick +8h button
    const quickAdd8hBtn = document.getElementById('quickAdd8hBtn');
    if (quickAdd8hBtn) {
        quickAdd8hBtn.addEventListener('click', handleQuickAdd8h);
    }

    console.log('✅ Event listeners ready');
}

// ========================================
// QUICK +8H HANDLER
// ========================================

async function handleQuickAdd8h() {
    // Ensure a date is set — default to today if empty
    const dateInput = document.getElementById('entryDate');
    if (!dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    // Fill morning: 08:00 – 12:00
    document.getElementById('morningIn').value  = '08:00';
    document.getElementById('morningOut').value = '12:00';

    // Fill afternoon: 13:00 – 17:00
    document.getElementById('afternoonIn').value  = '13:00';
    document.getElementById('afternoonOut').value = '17:00';

    // Clear evening
    document.getElementById('eveningIn').value  = '';
    document.getElementById('eveningOut').value = '';

    // Submit
    await handleFormSubmit(new Event('submit', { cancelable: true }));
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
            await saveUserData();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

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
        console.log('User data saved');
    } catch (error) {
        console.log('User data save attempt:', error.message);
    }
}

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
            timeEntries.push({ id: doc.id, ...doc.data() });
        });

        renderTimeEntries();
        updateProgress();
    } catch (error) {
        console.error('Error loading time entries:', error);
        // Fallback without orderBy
        try {
            const q = window.firebaseModules.query(
                window.firebaseModules.collection(window.firebaseDb, 'timeEntries'),
                window.firebaseModules.where('userId', '==', currentUser.uid)
            );
            const querySnapshot = await window.firebaseModules.getDocs(q);
            timeEntries = [];
            querySnapshot.forEach((doc) => {
                timeEntries.push({ id: doc.id, ...doc.data() });
            });
            timeEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
            renderTimeEntries();
            updateProgress();
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
        }
    }
}

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
        showToast(`✔ Entry saved! +${entryData.totalHours.toFixed(1)} hours logged.`);
        await loadTimeEntries();
    } catch (error) {
        console.error('Error adding time entry:', error);
        showToast('Failed to save entry. Try again.', 'error');
    }
}

async function deleteTimeEntry(entryId) {
    if (!currentUser) return;
    if (!confirm('Delete this entry?')) return;

    try {
        await window.firebaseModules.deleteDoc(
            window.firebaseModules.doc(window.firebaseDb, 'timeEntries', entryId)
        );
        console.log('Time entry deleted:', entryId);
        showToast('Entry deleted.');
        await loadTimeEntries();
    } catch (error) {
        console.error('Error deleting time entry:', error);
        showToast('Failed to delete entry.', 'error');
    }
}

// ========================================
// TIME CALCULATIONS
// ========================================

function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;

    const [inHours, inMinutes] = timeIn.split(':').map(Number);
    const [outHours, outMinutes] = timeOut.split(':').map(Number);

    const inTotal  = inHours  * 60 + inMinutes;
    const outTotal = outHours * 60 + outMinutes;

    let diff = outTotal - inTotal;
    if (diff < 0) diff += 24 * 60; // overnight

    return diff / 60;
}

function formatTime(time) {
    if (!time) return '--:--';
    return time;
}

// ========================================
// FORM HANDLING
// ========================================

async function handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const date        = document.getElementById('entryDate').value;
    const morningIn   = document.getElementById('morningIn').value;
    const morningOut  = document.getElementById('morningOut').value;
    const afternoonIn = document.getElementById('afternoonIn').value;
    const afternoonOut= document.getElementById('afternoonOut').value;
    const eveningIn   = document.getElementById('eveningIn').value;
    const eveningOut  = document.getElementById('eveningOut').value;

    if (!date) {
        showToast('Please select a date.', 'error');
        return;
    }

    const morningHours   = calculateHours(morningIn, morningOut);
    const afternoonHours = calculateHours(afternoonIn, afternoonOut);
    const eveningHours   = calculateHours(eveningIn, eveningOut);
    const totalHoursCalc = morningHours + afternoonHours + eveningHours;

    if (totalHoursCalc === 0) {
        showToast('Please enter at least one time shift.', 'error');
        return;
    }

    const entryData = {
        date: date,
        morning:   { timeIn: morningIn,   timeOut: morningOut,   hours: morningHours },
        afternoon: { timeIn: afternoonIn, timeOut: afternoonOut, hours: afternoonHours },
        evening:   { timeIn: eveningIn,   timeOut: eveningOut,   hours: eveningHours },
        totalHours: totalHoursCalc
    };

    await addTimeEntry(entryData);

    // Reset form, restore today's date
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
                <svg width="60" height="60" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" stroke="url(#emptyGradient2)" stroke-width="2" opacity="0.4"/>
                    <path d="M32 20V32L40 40" stroke="url(#emptyGradient2)" stroke-width="2" stroke-linecap="round"/>
                    <defs>
                        <linearGradient id="emptyGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%"   style="stop-color:#ff2d78"/>
                            <stop offset="100%" style="stop-color:#00f5ff"/>
                        </linearGradient>
                    </defs>
                </svg>
                <p>No entries yet</p>
                <span>Start tracking your OJT hours above</span>
            </div>
        `;
        return;
    }

    historyList.innerHTML = timeEntries.map(entry => {
        // Parse date safely (avoid timezone offset issues)
        const [year, month, day] = entry.date.split('-').map(Number);
        const entryDate = new Date(year, month - 1, day);
        const formattedDate = entryDate.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).toUpperCase();

        return `
            <div class="history-entry">
                <div class="entry-header">
                    <div class="entry-date">${formattedDate}</div>
                    <div class="entry-total">${entry.totalHours.toFixed(2)} hrs</div>
                </div>
                <div class="entry-details">
                    ${entry.morning.hours > 0 ? `
                        <div class="entry-shift">
                            <strong>AM:</strong> ${formatTime(entry.morning.timeIn)} – ${formatTime(entry.morning.timeOut)}
                            (${entry.morning.hours.toFixed(2)}h)
                        </div>
                    ` : ''}
                    ${entry.afternoon.hours > 0 ? `
                        <div class="entry-shift">
                            <strong>PM:</strong> ${formatTime(entry.afternoon.timeIn)} – ${formatTime(entry.afternoon.timeOut)}
                            (${entry.afternoon.hours.toFixed(2)}h)
                        </div>
                    ` : ''}
                    ${entry.evening.hours > 0 ? `
                        <div class="entry-shift">
                            <strong>EVE:</strong> ${formatTime(entry.evening.timeIn)} – ${formatTime(entry.evening.timeOut)}
                            (${entry.evening.hours.toFixed(2)}h)
                        </div>
                    ` : ''}
                </div>
                <div class="entry-actions">
                    <button class="btn-delete" onclick="deleteTimeEntry('${entry.id}')">[ Delete ]</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateProgress() {
    // SVG radius in new HTML is 110
    const RADIUS = 110;
    const circumference = 2 * Math.PI * RADIUS;

    const totalCompleted = timeEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
    const remaining      = Math.max(0, totalRequiredHours - totalCompleted);
    const percentage     = Math.min(100, (totalCompleted / totalRequiredHours) * 100);

    progressPercentage.textContent = `${Math.round(percentage)}%`;
    completedHours.textContent     = totalCompleted.toFixed(1);
    totalHours.textContent         = totalRequiredHours;
    remainingHours.textContent     = remaining.toFixed(1);
    historyTotalHours.textContent  = totalCompleted.toFixed(1);

    // Update stroke dashoffset
    const offset = circumference - (percentage / 100) * circumference;
    progressCircle.style.strokeDasharray  = circumference;
    progressCircle.style.strokeDashoffset = offset;
}

// Expose deleteTimeEntry globally
window.deleteTimeEntry = deleteTimeEntry;

// ========================================
// START
// ========================================

initializeApp();