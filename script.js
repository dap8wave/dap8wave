// Import all the functions we need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, onSnapshot, doc, deleteDoc, updateDoc, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyALA7TACwHPpAGolV_aYxuVgBEWmizI6CA",
    authDomain: "wave-check-cc19a.firebaseapp.com",
    projectId: "wave-check-cc19a",
    storageBucket: "wave-check-cc19a.appspot.com",
    messagingSenderId: "448503442369",
    appId: "1:448503442369:web:ff5123572f9c2386c69d40"
};

// Initialize Firebase and get references to the services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================================================
// LOGGING UTILITIES
// ======================================================================
// Logs of site activity are stored in the "logs" collection. Each log
// document records the timestamp, the station (if applicable), the
// email/badge of the user performing the action and a description of
// the action performed. A helper function is provided to write a new
// log entry to Firestore. If the write fails, it is silently ignored
// to avoid interrupting the user flow.

// Reference to the logs collection
const logsCollectionRef = collection(db, 'logs');

/**
 * Add a log entry to the Firestore logs collection. This function
 * attempts to write a document with the provided fields. If an error
 * occurs (e.g. network failure) it will be printed to the console
 * but will not disrupt the user experience.
 *
 * @param {string} action - A short action identifier (e.g. 'createAccount')
 * @param {string} details - A human-readable description of the event
 * @param {string|null} stationId - The station ID related to the action (optional)
 */
async function addLog(action, details, stationId = null) {
    try {
        // Determine the user performing the action from the session if available
        let userIdentifier = 'Unknown';
        try {
            const current = sessionStorage.getItem('currentUser');
            if (current) {
                const userObj = JSON.parse(current);
                // Prefer the email; fall back to badgeId if available
                if (userObj.email) userIdentifier = userObj.email;
                else if (userObj.badgeId) userIdentifier = userObj.badgeId;
            }
        } catch (err) {
            // Ignore JSON parse errors; userIdentifier will remain 'Unknown'
        }
        await addDoc(logsCollectionRef, {
            timestamp: Date.now(),
            stationId: stationId,
            user: userIdentifier,
            action: action,
            details: details
        });
    } catch (error) {
        console.error('Error logging event:', error);
    }
}

// ======================================================================
// ACCOUNT AND AUTHENTICATION UTILITIES
// ======================================================================

// Collection reference for employee/admin accounts. Accounts created
// via the admin panel are stored in this Firestore collection and
// include email, password, badgeId, role and stations.
const accountsCollectionRefMain = collection(db, 'accounts');

// In-memory cache of loaded accounts. Populated on page load when
// required (e.g. on the homepage) so we don't query Firestore for
// every authentication attempt.
let allAccounts = [];

// Default demo credentials. These allow access without an account in
// the database and are treated as a Developer role with full access.
const demoCredentials = {
    email: 'admin@example.com',
    password: 'admin123',
    badge: '12345',
    role: 'Developer'
};

/**
 * Load all account documents from Firestore into the allAccounts
 * array. Should be called once during initialization on pages that
 * require authentication (e.g. homepage). If there is a failure
 * retrieving accounts the list will remain empty, and only demo
 * credentials will be recognised.
 */
async function loadAccounts() {
    try {
        const snapshot = await getDocs(accountsCollectionRefMain);
        allAccounts = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { id: docSnap.id, ...data };
        });
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

/**
 * Attempt to authenticate a user based on provided credentials. This
 * function will check the demo credentials first, then search the
 * loaded accounts for a matching email/password or badge ID. The
 * returned object will contain role and station information if the
 * account exists. Returns null if no matching account is found.
 *
 * @param {string|null} email The email address to authenticate.
 * @param {string|null} password The password to authenticate.
 * @param {string|null} badge The badge ID to authenticate.
 * @returns {Object|null} The authenticated user object or null.
 */
function authenticateAccount(email, password, badge) {
    // Check demo credentials (email/password or badge)
    if (email && password && email === demoCredentials.email && password === demoCredentials.password) {
        return { email: demoCredentials.email, role: demoCredentials.role, stations: [] };
    }
    if (badge && badge === demoCredentials.badge) {
        return { badgeId: demoCredentials.badge, role: demoCredentials.role, stations: [] };
    }
    // Check loaded accounts array
    for (const acc of allAccounts) {
        // Compare email/password if both provided
        if (email && password && acc.email === email && acc.password === password) {
            return { ...acc };
        }
        // Compare badge ID if provided
        if (badge && acc.badgeId && acc.badgeId === badge) {
            return { ...acc };
        }
    }
    return null;
}

/**
 * Update the visibility of login and logout buttons based on the
 * current session. When a user is logged in, the login button is
 * hidden and the logout button is shown; when logged out the
 * opposite is true. Called after login/logout actions and on page
 * initialization on pages where login controls exist (e.g. homepage).
 */
function updateHeaderUI() {
    const current = sessionStorage.getItem('currentUser');
    const user = current ? JSON.parse(current) : null;
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (loginBtn && logoutBtn) {
        if (user) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
        } else {
            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
        }
    }
}

// ======================================================================
// MAIN SCRIPT LOGIC
// ======================================================================
document.addEventListener('DOMContentLoaded', function() {

    const stationPageWrapper = document.querySelector('.station-page-wrapper');

    /**
     * Retrieve the currently logged-in user from sessionStorage. The user
     * object contains the email, role and assigned stations. If there is
     * no logged-in user, null is returned.
     */
    function getCurrentUser() {
        try {
            const data = sessionStorage.getItem('currentUser');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Determine whether the given user has permission to access a station.
     * Developer, L4+ and L3 roles always have full access. Otherwise
     * the station must be listed in the user's stations array.
     *
     * @param {Object} user - The current user object
     * @param {string} stationId - The station ID to check
     * @returns {boolean} Whether the user may access the station
     */
    function hasAccessToStation(user, stationId) {
        if (!user || !stationId) return false;
        const elevatedRoles = ['Developer', 'L4+', 'L3'];
        if (elevatedRoles.includes(user.role)) return true;
        if (Array.isArray(user.stations)) {
            return user.stations.includes(stationId);
        }
        return false;
    }

    if (stationPageWrapper) {
        // Access control for station pages based on logged-in accounts
        const stationId = stationPageWrapper.dataset.stationId;
        const currentUser = getCurrentUser();
        if (!currentUser) {
            alert('You must log in to access this page.');
            window.location.href = 'index.html';
            return;
        }
        if (hasAccessToStation(currentUser, stationId)) {
            initializeStationPageLogic(stationPageWrapper, stationId);
        } else {
            alert('You do not have permission to access this station.');
            window.location.href = 'index.html';
        }
    } else {
        // Not a station page – initialize home page login functionality
        initializeHomePage();
    }
});


// ======================================================================
// ALL STATION PAGE LOGIC
// ======================================================================

function initializeStationPageLogic(stationPageWrapper, stationId) {
    // --- Firestore Collection References ---
    const daListCollectionRef = collection(db, 'stations', stationId, 'drivers');
    const rosterCollectionRef = collection(db, 'stations', stationId, 'roster');

    // --- Element References ---
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const daListTableBody = document.getElementById('da-list-table-body');
    const rosterTableBody = document.getElementById('roster-table-body');
    const companyContainer = document.getElementById('company-stats-container');
    const addDaForm = document.getElementById('add-da-form');
    const bulkDaForm = document.getElementById('bulk-da-form');
    const resetDaListBtn = document.getElementById('reset-da-list-btn');
    const addDriverToRosterForm = document.getElementById('add-roster-form');
    const bulkRosterForm = document.querySelector('#caproster-content .bulk-roster-form');
    const resetRosterBtn = document.getElementById('reset-roster-btn');
    const waveCheckForm = document.getElementById('wave-check-form');
    const scannerOutput = document.getElementById('scanner-output');
    const missingDriversModal = document.getElementById('missing-drivers-modal');
    const closeButtonMissing = document.querySelector('.close-button-missing');

    // --- Tab Switching Logic ---
    function activateTab(activeLink, targetPaneId) {
        tabLinks.forEach(innerLink => innerLink.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        activeLink.classList.add('active');
        const targetPane = document.getElementById(targetPaneId);
        if (targetPane) targetPane.classList.add('active');
    }

    tabLinks.forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const targetId = link.getAttribute('data-tab');
            if (targetId === 'da-list-content') {
                // Access to the DA-List is restricted to Developer and L4+ roles only
                try {
                    const userData = sessionStorage.getItem('currentUser');
                    const user = userData ? JSON.parse(userData) : null;
                    if (user && ['Developer','L4+'].includes(user.role)) {
                        activateTab(link, targetId);
                    } else {
                        alert('You do not have permission to access the DA-List.');
                    }
                } catch (error) {
                    alert('Unable to verify permissions.');
                }
            } else {
                activateTab(link, targetId);
            }
        });
    });
    
    // --- Missing Drivers Modal Logic ---
    function openMissingModal() { if (missingDriversModal) missingDriversModal.style.display = 'flex'; }
    function closeMissingModal() { if (missingDriversModal) missingDriversModal.style.display = 'none'; }
    if(closeButtonMissing) closeButtonMissing.addEventListener('click', closeMissingModal);
    window.addEventListener('click', (event) => { 
        if (event.target == missingDriversModal) closeMissingModal();
    });

    // --- Wave Check Logic ---
    if (waveCheckForm) {
        waveCheckForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const scanInput = waveCheckForm.querySelector('.manual-badge-input');
            const badgeIdValue = scanInput.value.trim();
            if (!badgeIdValue) return;

            const badgeIdAsString = badgeIdValue;
            const badgeIdAsNumber = parseInt(badgeIdValue, 10);
            
            const qString = query(rosterCollectionRef, where("badgeId", "==", badgeIdAsString));
            let querySnapshot = await getDocs(qString);

            if (querySnapshot.empty && !isNaN(badgeIdAsNumber)) {
                const qNumber = query(rosterCollectionRef, where("badgeId", "==", badgeIdAsNumber));
                querySnapshot = await getDocs(qNumber);
            }
            if (querySnapshot.empty) {
                scannerOutput.innerHTML = `<h2 class="status-heading status-error">DRIVER NOT FOUND</h2><p>The Badge ID "${badgeIdValue}" was not found on today's roster.</p>`;
            } else {
                const rosterDoc = querySnapshot.docs[0];
                const driverData = rosterDoc.data();
                if (driverData.status === 'Checked In') {
                    scannerOutput.innerHTML = `<h2 class="status-heading status-info">ALREADY CHECKED IN</h2><div class="scan-details"><p><strong>Name:</strong> ${driverData.name}</p><p><strong>Badge ID:</strong> ${driverData.badgeId}</p></div>`;
                } else {
                    await updateDoc(rosterDoc.ref, { status: 'Checked In' });
                    scannerOutput.innerHTML = `<h2 class="status-heading status-success">CHECK-IN SUCCESSFUL</h2><div class="scan-details"><p><strong>Name:</strong> ${driverData.name}</p><p><strong>Transporter ID:</strong> ${driverData.transporterId}</p><p><strong>Badge ID:</strong> ${driverData.badgeId}</p><p><strong>Start Time:</strong> ${driverData.startTime}</p><p><strong>Company Name:</strong> ${driverData.firmenname}</p></div>`;
                }
            }
            scanInput.value = '';
        });
    }

    // --- Master Driver Database (DA-List) Logic ---
    onSnapshot(daListCollectionRef, snapshot => {
        if (!daListTableBody) return;
        daListTableBody.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const driver = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `<td>${driver.userId || ''}</td><td>${driver.name || ''}</td><td>${driver.badgeId || ''}</td><td>${driver.companyName || ''}</td><td>${driver.transporterId || ''}</td><td class="actions-cell"><button class="action-btn btn-delete" data-collection="drivers" data-id="${doc.id}">Delete</button></td>`;
            daListTableBody.appendChild(row);
        });
    });
    
    if (addDaForm) {
        addDaForm.addEventListener('submit', async event => {
            event.preventDefault();
            const newDriver = {
                userId: addDaForm.userId.value,
                name: addDaForm.name.value,
                badgeId: addDaForm.badgeId.value,
                companyName: addDaForm.companyName.value,
                transporterId: addDaForm.transporterId.value
            };
            await addDoc(daListCollectionRef, newDriver);
            // Log the addition of a driver to the master DA list
            addLog('addDa', `Added driver ${newDriver.name} (Badge: ${newDriver.badgeId}) to the master list`, stationId);
            addDaForm.reset();
        });
    }

    if (bulkDaForm) {
        bulkDaForm.addEventListener('submit', event => {
            event.preventDefault();
            const fileInput = document.getElementById('excel-upload');
            const file = fileInput.files[0];
            if (!file) return alert("Please select a file to upload.");
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    if (jsonData.length === 0) return alert("The selected file is empty or could not be read.");
                    const batch = writeBatch(db);
                    let processedCount = 0;
                    jsonData.forEach(row => {
                        const newDriver = { userId: row['User ID'] || '', name: row['Employee Name'] || '', badgeId: row['Badge ID'] || '', companyName: row['Company Name'] || '', transporterId: row['Transporter ID'] || '' };
                        if (newDriver.userId && newDriver.name && newDriver.badgeId) {
                            const newDocRef = doc(daListCollectionRef);
                            batch.set(newDocRef, newDriver);
                            processedCount++;
                        }
                    });
                    if (processedCount > 0) {
                        await batch.commit();
                        alert(`${processedCount} drivers were successfully imported from the file!`);
                        // Log the bulk import action
                        addLog('bulkImportDA', `Imported ${processedCount} drivers into the master list`, stationId);
                    } else {
                        alert("No valid drivers found. Please check Excel headers: 'User ID', 'Employee Name', 'Badge ID'.");
                    }
                    bulkDaForm.reset();
                } catch (error) {
                    alert("An error occurred while processing the file.");
                    console.error("Excel import error:", error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
    
    if (resetDaListBtn) {
        resetDaListBtn.addEventListener('click', async () => {
            const confirmation = confirm(`DANGER: Are you sure you want to permanently delete the ENTIRE Master Driver Database for ${stationId}? This cannot be undone.`);
            if (confirmation) {
                const querySnapshot = await getDocs(daListCollectionRef);
                if (querySnapshot.empty) return alert('Master Driver Database is already empty.');
                const batch = writeBatch(db);
                querySnapshot.forEach(docSnap => { batch.delete(docSnap.ref); });
                try {
                    await batch.commit();
                    alert(`The Master Driver Database for ${stationId} has been successfully cleared.`);
                    // Log the reset action
                    addLog('resetDAList', `Cleared the master DA list for station ${stationId}`, stationId);
                } catch (error) {
                    alert('An error occurred while clearing the database.');
                    console.error("Error clearing collection: ", error);
                }
            }
        });
    }
    
    // --- Daily Roster (CapRoster) & Dashboard Logic ---
    onSnapshot(rosterCollectionRef, snapshot => {
        if(!rosterTableBody) return;
        rosterTableBody.innerHTML = '';
        let checkedInCount = 0;
        let rescueCount = 0;
        let companyData = {};
        snapshot.docs.forEach(doc => {
            const driver = doc.data();
            const row = document.createElement('tr');
            let statusClass = 'status-awaiting';
            if (driver.status === 'Checked In') statusClass = 'status-checked-in';
            else if (driver.status === 'On Rescue') statusClass = 'status-on-rescue';
            row.className = statusClass;
            row.innerHTML = `<td>${driver.transporterId || 'N/A'}</td><td>${driver.badgeId || 'N/A'}</td><td>${driver.name}</td><td>${driver.startTime}</td><td>${driver.firmenname}</td><td>${driver.status}</td><td class="actions-cell"><button class="action-btn btn-edit" data-collection="roster" data-id="${doc.id}">Edit</button><button class="action-btn btn-rescue" data-collection="roster" data-id="${doc.id}">Rescue</button><button class="action-btn btn-check-in" data-collection="roster" data-id="${doc.id}">Check-In</button><button class="action-btn btn-delete" data-collection="roster" data-id="${doc.id}">Delete</button></td>`;
            rosterTableBody.appendChild(row);
            if (driver.status === 'Checked In') checkedInCount++;
            if (driver.status === 'On Rescue') rescueCount++;
            const company = driver.firmenname || 'Unknown';
            if (!companyData[company]) { companyData[company] = { total: 0, checkedIn: 0 }; }
            companyData[company].total++;
            if (driver.status === 'Checked In') companyData[company].checkedIn++;
        });
        const totalDrivers = snapshot.docs.length;
        const remainingDrivers = totalDrivers - checkedInCount - rescueCount;
        const progress = totalDrivers > 0 ? Math.round((checkedInCount / totalDrivers) * 100) : 0;
        document.getElementById('total-drivers').innerText = totalDrivers;
        document.getElementById('checked-in-drivers').innerText = checkedInCount;
        document.getElementById('remaining-drivers').innerText = remainingDrivers;
        document.getElementById('rescue-drivers').innerText = rescueCount;
        const progressBar = document.getElementById('check-in-progress-bar');
        progressBar.style.width = `${progress}%`;
        progressBar.innerText = `${progress}%`;
        companyContainer.innerHTML = '<h4>Drivers by Company</h4>';
        for (const companyName in companyData) {
            const stats = companyData[companyName];
            const missing = stats.total - stats.checkedIn;
            const companyCard = document.createElement('div');
            companyCard.className = 'company-card';
            companyCard.innerHTML = `<span class="company-name">${companyName}</span><span class="company-ratio">${stats.checkedIn} / ${stats.total}</span><button class="missing-btn" data-company="${companyName}">${missing} Missing</button>`;
            companyContainer.appendChild(companyCard);
        }
    });

    if (addDriverToRosterForm) {
        addDriverToRosterForm.addEventListener('submit', async event => {
            event.preventDefault();
            const badgeId = addDriverToRosterForm.badgeId.value.trim();
            const name = addDriverToRosterForm.name.value.trim();
            const startTime = addDriverToRosterForm.startTime.value.trim();
            const firmenname = addDriverToRosterForm.firmenname.value.trim();
            if (!badgeId || !name || !startTime || !firmenname) { return alert("Please fill out all fields."); }
            const q = query(daListCollectionRef, where("badgeId", "==", badgeId));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                await addDoc(daListCollectionRef, { badgeId: badgeId, name: name, companyName: firmenname, userId: 'N/A', transporterId: 'N/A' });
                alert(`New driver with Badge ID ${badgeId} was saved to the permanent DA-List for ${stationId}.`);
                // Log creation of new master driver
                addLog('createMasterDriver', `New driver ${name} (Badge: ${badgeId}) saved to master list`, stationId);
            }
            const rosterDriver = {
                badgeId: badgeId,
                name: name,
                startTime: startTime,
                firmenname: firmenname,
                status: 'Awaiting',
                transporterId: `AT-${stationId.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`
            };
            await addDoc(rosterCollectionRef, rosterDriver);
            // Log addition to the daily roster
            addLog('addRoster', `Added ${name} (Badge: ${badgeId}) to the daily roster for ${stationId}`, stationId);
            addDriverToRosterForm.reset();
        });
    }
    
    if (bulkRosterForm) {
        bulkRosterForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const textArea = bulkRosterForm.querySelector('textarea');
            const bulkText = textArea.value.trim();
            if (!bulkText) return alert('Bulk roster box is empty.');
            const confirmation = confirm(`Are you sure you want to DELETE the current roster for ${stationId} and overwrite it?`);
            if (!confirmation) return;
            try {
                const daListSnapshot = await getDocs(daListCollectionRef);
                const daListMap = new Map(daListSnapshot.docs.map(doc => [doc.data().transporterId, doc.data()]));
                const oldRosterSnapshot = await getDocs(rosterCollectionRef);
                const deleteBatch = writeBatch(db);
                oldRosterSnapshot.forEach(doc => { deleteBatch.delete(doc.ref); });
                await deleteBatch.commit();
                const lines = bulkText.split('\n');
                const rosterAddBatch = writeBatch(db);
                const daListAddBatch = writeBatch(db);
                let newDriversAddedToDA = 0;
                let rosterCount = 0;
                lines.forEach(line => {
                    if (!line.trim()) return;
                    const columns = line.split('\t').map(item => item.trim());
                    if (columns.length >= 9) {
                        const newRosterDriver = {
                            transporterId: columns[0], name: columns[1], status: columns[2],
                            startTime: columns[5], firmenname: columns[8], badgeId: 'N/A'
                        };
                        if (daListMap.has(newRosterDriver.transporterId)) {
                            const masterDriver = daListMap.get(newRosterDriver.transporterId);
                            newRosterDriver.badgeId = masterDriver.badgeId;
                        } else {
                            const newMasterDriver = {
                                userId: `NEW-${newRosterDriver.transporterId}`, name: newRosterDriver.name,
                                badgeId: 'NEEDS UPDATE', companyName: newRosterDriver.firmenname,
                                transporterId: newRosterDriver.transporterId
                            };
                            const newDaListDocRef = doc(daListCollectionRef);
                            daListAddBatch.set(newDaListDocRef, newMasterDriver);
                            newDriversAddedToDA++;
                        }
                        const newRosterDocRef = doc(rosterCollectionRef);
                        rosterAddBatch.set(newRosterDocRef, newRosterDriver);
                        rosterCount++;
                    }
                });
                if (newDriversAddedToDA > 0) { await daListAddBatch.commit(); }
                if (rosterCount > 0) { await rosterAddBatch.commit(); }
                let alertMessage = `${rosterCount} drivers were added to the new roster for ${stationId}.`;
                if (newDriversAddedToDA > 0) {
                    alertMessage += `\n${newDriversAddedToDA} new drivers were discovered and saved to the master DA-List.`;
                }
                alert(alertMessage);
                // Log bulk roster upload
                addLog('bulkRosterUpload', `Uploaded roster with ${rosterCount} entries and added ${newDriversAddedToDA} new master drivers`, stationId);
                textArea.value = '';
            } catch (error) {
                alert('An error occurred while processing the roster.');
                console.error("Bulk roster error: ", error);
            }
        });
    }
    
    if (resetRosterBtn) {
        resetRosterBtn.addEventListener('click', async () => {
            const confirmation = confirm(`Are you sure you want to delete the ENTIRE daily roster for ${stationId}?`);
            if (confirmation) {
                const querySnapshot = await getDocs(rosterCollectionRef);
                if (querySnapshot.empty) { return alert('The daily roster is already empty.'); }
                const batch = writeBatch(db);
                querySnapshot.forEach(docSnap => {
                    batch.delete(docSnap.ref);
                });
                try {
                    await batch.commit();
                    alert(`The daily roster for ${stationId} has been successfully cleared.`);
                    // Log the roster reset
                    addLog('resetRoster', `Cleared the daily roster for station ${stationId}`, stationId);
                } catch (error) {
                    alert('An error occurred while clearing the roster.');
                    console.error("Error clearing collection: ", error);
                }
            }
        });
    }
    
    if (stationPageWrapper) {
        stationPageWrapper.addEventListener('click', async (event) => {
            const target = event.target;
            if (target.classList.contains('action-btn')) {
                const id = target.dataset.id;
                const collectionName = target.dataset.collection;
                if (!id || !collectionName) return;
                const docRef = doc(db, 'stations', stationId, collectionName, id);
            if (target.classList.contains('btn-delete')) {
                    if (confirm('Are you sure you want to permanently delete this entry?')) {
                        await deleteDoc(docRef);
                        // Log deletion of entry
                        addLog('deleteEntry', `Deleted entry ${id} from ${collectionName} at station ${stationId}`, stationId);
                    }
                } else if (target.classList.contains('btn-check-in')) {
                    await updateDoc(docRef, { status: 'Checked In' });
                    addLog('updateStatus', `Checked in driver with ID ${id} at station ${stationId}`, stationId);
                } else if (target.classList.contains('btn-rescue')) {
                    await updateDoc(docRef, { status: 'On Rescue' });
                    addLog('updateStatus', `Marked driver with ID ${id} as On Rescue at station ${stationId}`, stationId);
                } else if (target.classList.contains('btn-edit')) {
                    try {
                        const rosterDoc = await getDoc(docRef);
                        if (!rosterDoc.exists()) return alert('Driver not found in roster.');
                        const currentDriver = rosterDoc.data();
                        const newName = prompt("Enter the new Employee Name:", currentDriver.name);
                        const newBadgeId = prompt("Enter the new Badge ID:", currentDriver.badgeId);
                        if ((newName && newName !== currentDriver.name) || (newBadgeId && newBadgeId !== currentDriver.badgeId)) {
                            await updateDoc(docRef, {
                                name: newName || currentDriver.name,
                                badgeId: newBadgeId || currentDriver.badgeId
                            });
                            // Log roster update
                            addLog('editRoster', `Updated roster entry ${id}: name changed to ${newName || currentDriver.name}, badge to ${newBadgeId || currentDriver.badgeId}`, stationId);
                            const masterDriverQuery = query(daListCollectionRef, where("transporterId", "==", currentDriver.transporterId));
                            const masterDriverSnapshot = await getDocs(masterDriverQuery);
                            if (!masterDriverSnapshot.empty) {
                                const masterDocId = masterDriverSnapshot.docs[0].id;
                                const masterDocRef = doc(db, 'stations', stationId, 'drivers', masterDocId);
                                await updateDoc(masterDocRef, {
                                    name: newName || currentDriver.name,
                                    badgeId: newBadgeId || currentDriver.badgeId
                                });
                                // Log update in master list
                                addLog('editMasterDriver', `Updated master entry ${masterDocId}: name changed to ${newName || currentDriver.name}, badge to ${newBadgeId || currentDriver.badgeId}`, stationId);
                                alert(`Successfully updated driver in both the Roster and the Master DA-List!`);
                            } else {
                                alert(`Driver updated in the Roster, but could not be found in the Master DA-List to sync.`);
                            }
                        }
                    } catch (error) {
                        alert('An error occurred during the update.');
                        console.error('Edit error:', error);
                    }
                }
            }
        });
    }
    
    if (companyContainer) {
        companyContainer.addEventListener('click', async (event) => {
            if (event.target.classList.contains('missing-btn')) {
                const companyName = event.target.dataset.company;
                const modalTitle = document.getElementById('missing-modal-title');
                const driverList = document.getElementById('missing-drivers-list');
                if (!companyName || !modalTitle || !driverList) return;
                modalTitle.innerText = `Missing Drivers for ${companyName}`;
                driverList.innerHTML = '';
                const q = query(rosterCollectionRef, where("firmenname", "==", companyName), where("status", "!=", "Checked In"));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    driverList.innerHTML = '<li>No missing drivers for this company.</li>';
                } else {
                    querySnapshot.forEach(doc => {
                        const driver = doc.data();
                        const li = document.createElement('li');
                        li.textContent = driver.name;
                        driverList.appendChild(li);
                    });
                }
                openMissingModal();
            }
        });
    }
}

// ======================================================================
// HOME PAGE INITIALIZATION
// ======================================================================

/**
 * Initialize login and logout controls on the homepage. This function
 * sets up event listeners for the login button, logout button, and the
 * modal used for employee authentication. It loads the current set
 * of accounts from Firestore and ensures the header reflects the
 * current login state. The login modal offers two methods: email/
 * password or badge scanning. Appropriate forms are displayed based
 * on the user's choice.
 */
function initializeHomePage() {
    // Elements used for login/logout and modal management
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const modal = document.getElementById('employeeLoginModal');
    if (!modal) {
        // If the modal is not present, this page likely doesn't
        // implement login features (e.g. country/selection pages)
        return;
    }
    const closeBtn = modal.querySelector('.close-button');
    const methodsContainer = document.getElementById('login-methods');
    const emailForm = document.getElementById('employee-login-form-email');
    const badgeForm = document.getElementById('employee-login-form-badge');
    const loginError = document.getElementById('employee-login-error');

    // Load accounts and update header once complete
    loadAccounts().then(() => {
        updateHeaderUI();
    });

    // Display the login modal and reset forms
    function openLoginModal() {
        if (modal) {
            modal.style.display = 'flex';
            // Reset view: show method selection cards, hide forms and errors
            if (methodsContainer) methodsContainer.style.display = 'flex';
            if (emailForm) emailForm.style.display = 'none';
            if (badgeForm) badgeForm.style.display = 'none';
            if (loginError) loginError.style.display = 'none';
            // Clear form fields
            const emailInput = document.getElementById('employee-login-email');
            const passwordInput = document.getElementById('employee-login-password');
            const badgeInput = document.getElementById('employee-login-badge');
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (badgeInput) badgeInput.value = '';
        }
    }

        // Expose the modal opening function globally so it can be
        // triggered from inline HTML (e.g. login link onclick). This
        // maintains a single point of logic for resetting forms and
        // displaying the modal.
        window.showEmployeeLoginModal = openLoginModal;

    // Hide the login modal
    function closeLoginModal() {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Open modal when login button is clicked
    if (loginBtn) {
        loginBtn.addEventListener('click', openLoginModal);
    }
    // Close modal when close button clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', closeLoginModal);
    }
    // Close modal when clicking outside content
    window.addEventListener('click', event => {
        if (event.target === modal) {
            closeLoginModal();
        }
    });

    // Switch to appropriate form when a login method card is selected
    if (methodsContainer) {
        const cards = methodsContainer.querySelectorAll('.login-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const method = card.getAttribute('data-method');
                if (methodsContainer) methodsContainer.style.display = 'none';
                if (method === 'email' && emailForm) {
                    emailForm.style.display = 'block';
                } else if (method === 'badge' && badgeForm) {
                    badgeForm.style.display = 'block';
                }
            });
        });
    }

    // Handle email/password login submission
    if (emailForm) {
        emailForm.addEventListener('submit', event => {
            event.preventDefault();
            const emailInput = document.getElementById('employee-login-email');
            const passwordInput = document.getElementById('employee-login-password');
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value.trim() : '';
            const user = authenticateAccount(email, password, null);
            if (user) {
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                updateHeaderUI();
                closeLoginModal();
                // Log successful login via email/password
                addLog('login', `User ${user.email || user.badgeId || ''} logged in via email/password`, null);
            } else {
                if (loginError) {
                    loginError.textContent = 'Invalid credentials. Please try again.';
                    loginError.style.display = 'block';
                }
            }
        });
    }

    // Handle badge login submission
    if (badgeForm) {
        badgeForm.addEventListener('submit', event => {
            event.preventDefault();
            const badgeInput = document.getElementById('employee-login-badge');
            const badge = badgeInput ? badgeInput.value.trim() : '';
            const user = authenticateAccount(null, null, badge);
            if (user) {
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                updateHeaderUI();
                closeLoginModal();
                // Log successful login via badge scan
                addLog('login', `User ${user.email || user.badgeId || ''} logged in via badge`, null);
            } else {
                if (loginError) {
                    loginError.textContent = 'Invalid badge ID. Please try again.';
                    loginError.style.display = 'block';
                }
            }
        });
    }

    // Logout clears the session and refreshes the header
        if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            const currentUserData = sessionStorage.getItem('currentUser');
            sessionStorage.removeItem('currentUser');
            updateHeaderUI();
            // Log logout event
            if (currentUserData) {
                const u = JSON.parse(currentUserData);
                addLog('logout', `User ${u.email || u.badgeId || ''} logged out`, null);
            }
        });
    }
}