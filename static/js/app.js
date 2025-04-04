// Main JavaScript for Go Backup App

// DOM elements
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

// Modal elements
const configModal = document.getElementById('configModal');
const resultModal = document.getElementById('resultModal');
const closeModalButtons = document.querySelectorAll('.close-modal, .cancel-modal');
const newConfigBtn = document.getElementById('newConfigBtn');
const configForm = document.getElementById('configForm');

// Form elements
const protocolSelect = document.getElementById('protocol');
const protocolSettings = document.getElementById('protocolSettings');
const protocolAuth = document.querySelector('.protocol-auth');
const scheduleEnabled = document.getElementById('scheduleEnabled');
const scheduleSettings = document.getElementById('scheduleSettings');
const addSourceBtn = document.getElementById('addSourceBtn');
const sourcePathsContainer = document.getElementById('sourcePathsContainer');

// Dashboard elements
const configCount = document.getElementById('configCount');
const backupCount = document.getElementById('backupCount');
const nextBackup = document.getElementById('nextBackup');
const recentBackupsTable = document.getElementById('recentBackupsTable');

// Configurations elements
const configsTable = document.getElementById('configsTable');

// Results elements
const configFilter = document.getElementById('configFilter');
const statusFilter = document.getElementById('statusFilter');
const resultsTable = document.getElementById('resultsTable');

// Loading overlay
const loadingOverlay = document.getElementById('loadingOverlay');

// API endpoints
const API = {
    CONFIGS: '/api/configs',
    RESULTS: '/api/results'
};

// App state
let configs = [];
let results = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Set up event listeners
    setupNavigation();
    setupModals();
    setupFormHandlers();
    
    // Initialize time selectors
    initTimeSelectors();
    
    // Load initial data
    fetchData();
}

// Set up navigation
function setupNavigation() {
    // Mobile navigation toggle
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
    
    // Navigation menu items
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get the view to show
            const viewId = item.getAttribute('data-view');
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show the selected view
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            
            // Close mobile menu if open
            navMenu.classList.remove('active');
        });
    });
    
    // View links in cards
    document.querySelectorAll('[data-view]').forEach(link => {
        if (!link.classList.contains('nav-item')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Get the view to show
                const viewId = link.getAttribute('data-view');
                
                // Update active nav item
                navItems.forEach(nav => {
                    if (nav.getAttribute('data-view') === viewId) {
                        nav.classList.add('active');
                    } else {
                        nav.classList.remove('active');
                    }
                });
                
                // Show the selected view
                views.forEach(view => view.classList.remove('active'));
                document.getElementById(viewId).classList.add('active');
            });
        }
    });
}

// Set up modals
function setupModals() {
    // Close modals
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            configModal.style.display = 'none';
            resultModal.style.display = 'none';
        });
    });
    
    // Click outside to close
    window.addEventListener('click', (e) => {
        if (e.target === configModal) {
            configModal.style.display = 'none';
        }
        if (e.target === resultModal) {
            resultModal.style.display = 'none';
        }
    });
    
    // Open new configuration modal
    newConfigBtn.addEventListener('click', () => {
        // Reset form
        configForm.reset();
        document.getElementById('configId').value = '';
        document.getElementById('modalTitle').textContent = 'New Backup Configuration';
        
        // Reset source paths
        sourcePathsContainer.innerHTML = `
            <div class="source-path-row">
                <input type="text" class="source-path" required>
                <button type="button" class="btn small remove-source"><i class="fas fa-minus"></i></button>
            </div>
        `;
        setupRemoveSourceHandlers();
        
        // Show modal
        configModal.style.display = 'block';
    });
    
    // Form submission
    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect form data
        const formData = getConfigFormData();
        
        try {
            showLoading();
            
            const configId = document.getElementById('configId').value;
            let response;
            
            if (configId) {
                // Update existing configuration
                response = await fetch(`${API.CONFIGS}/${configId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                // Create new configuration
                response = await fetch(API.CONFIGS, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            }
            
            if (!response.ok) {
                throw new Error('Failed to save configuration');
            }
            
            // Close modal and refresh data
            configModal.style.display = 'none';
            fetchData();
            
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    });
}

// Set up form handlers
function setupFormHandlers() {
    // Protocol change handler
    protocolSelect.addEventListener('change', () => {
        updateProtocolFields();
    });
    
    // Schedule toggle handler
    scheduleEnabled.addEventListener('change', () => {
        updateScheduleFields();
    });
    
    // Add source button handler
    addSourceBtn.addEventListener('click', () => {
        const sourceRow = document.createElement('div');
        sourceRow.className = 'source-path-row';
        sourceRow.innerHTML = `
            <input type="text" class="source-path" required>
            <button type="button" class="btn small remove-source"><i class="fas fa-minus"></i></button>
        `;
        sourcePathsContainer.appendChild(sourceRow);
        
        // Set up handler for the new remove button
        setupRemoveSourceHandlers();
    });
    
    // Initial setup
    setupRemoveSourceHandlers();
    updateProtocolFields();
    updateScheduleFields();
    
    // Filter handlers for results
    configFilter.addEventListener('change', filterResults);
    statusFilter.addEventListener('change', filterResults);
}

// Set up remove source button handlers
function setupRemoveSourceHandlers() {
    document.querySelectorAll('.remove-source').forEach(button => {
        button.addEventListener('click', (e) => {
            // Only remove if there's more than one source
            if (sourcePathsContainer.children.length > 1) {
                e.target.closest('.source-path-row').remove();
            }
        });
    });
}

// Update protocol fields based on selection
function updateProtocolFields() {
    const protocol = protocolSelect.value;
    
    if (protocol === 'local') {
        protocolAuth.style.display = 'none';
    } else {
        protocolAuth.style.display = 'block';
    }
}

// Update schedule fields based on enabled state
function updateScheduleFields() {
    if (scheduleEnabled.checked) {
        scheduleSettings.style.display = 'block';
    } else {
        scheduleSettings.style.display = 'none';
    }
}

// Initialize time selectors for hour and minute
function initTimeSelectors() {
    const hourSelect = document.getElementById('scheduleHour');
    const minuteSelect = document.getElementById('scheduleMinute');
    
    // Hours (0-23)
    for (let i = 0; i < 24; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i.toString().padStart(2, '0');
        hourSelect.appendChild(option);
    }
    
    // Minutes (0-59, increments of 5)
    for (let i = 0; i < 60; i += 5) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i.toString().padStart(2, '0');
        minuteSelect.appendChild(option);
    }
}

// Get form data from config form
function getConfigFormData() {
    const configId = document.getElementById('configId').value;
    const name = document.getElementById('configName').value;
    const protocol = document.getElementById('protocol').value;
    const destPath = document.getElementById('destPath').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const domain = document.getElementById('domain').value;
    
    // Get source paths
    const sourcePaths = [];
    document.querySelectorAll('.source-path').forEach(input => {
        if (input.value.trim()) {
            sourcePaths.push(input.value.trim());
        }
    });
    
    // Get schedule settings
    const scheduleEnabled = document.getElementById('scheduleEnabled').checked;
    const daysOfWeek = [];
    document.querySelectorAll('.day-checkbox:checked').forEach(checkbox => {
        daysOfWeek.push(checkbox.value);
    });
    const hour = parseInt(document.getElementById('scheduleHour').value);
    const minute = parseInt(document.getElementById('scheduleMinute').value);
    
    // Build config object
    const config = {
        name,
        sourcePaths,
        destPath,
        protocol,
        schedule: {
            enabled: scheduleEnabled,
            daysOfWeek,
            hour,
            minute
        }
    };
    
    // Add credentials if needed
    if (protocol !== 'local') {
        config.username = username;
        config.password = password;
        if (domain) {
            config.domain = domain;
        }
    }
    
    // Add ID if updating
    if (configId) {
        config.id = configId;
    }
    
    return config;
}

// Fetch all application data
async function fetchData() {
    try {
        showLoading();
        
        // Fetch configurations
        const configsResponse = await fetch(API.CONFIGS);
        if (!configsResponse.ok) {
            throw new Error('Failed to fetch configurations');
        }
        configs = await configsResponse.json();
        
        // Fetch results
        const resultsResponse = await fetch(API.RESULTS);
        if (!resultsResponse.ok) {
            throw new Error('Failed to fetch results');
        }
        results = await resultsResponse.json();
        
        // Update UI
        updateDashboard();
        updateConfigsTable();
        updateResultsTable();
        updateConfigFilter();
        
    } catch (error) {
        console.error('Error fetching data:', error);
        alert(`Error: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Update dashboard with data
function updateDashboard() {
    // Update counts
    configCount.textContent = configs.length;
    backupCount.textContent = results.length;
    
    // Find next scheduled backup
    const now = new Date();
    let nextScheduled = null;
    let nextScheduledDate = null;
    
    configs.forEach(config => {
        if (config.schedule && config.schedule.enabled && config.schedule.daysOfWeek.length > 0) {
            // Current day of week (0 = Sunday, 1 = Monday, etc.)
            const currentDay = now.getDay();
            const daysMap = {
                'Sunday': 0,
                'Monday': 1,
                'Tuesday': 2,
                'Wednesday': 3,
                'Thursday': 4,
                'Friday': 5,
                'Saturday': 6
            };
            
            // Map day names to day numbers
            const scheduleDays = config.schedule.daysOfWeek.map(day => daysMap[day]);
            
            // Find the next occurrence
            let nextDay = scheduleDays.find(day => day > currentDay);
            if (nextDay === undefined) {
                nextDay = scheduleDays[0]; // Wrap around to next week
            }
            
            // Calculate next date
            const daysUntilNext = (nextDay - currentDay + 7) % 7;
            const nextDate = new Date(now);
            nextDate.setDate(now.getDate() + daysUntilNext);
            nextDate.setHours(config.schedule.hour);
            nextDate.setMinutes(config.schedule.minute);
            nextDate.setSeconds(0);
            
            // If today is scheduled but time has passed, add 7 days
            if (daysUntilNext === 0 && nextDate < now) {
                nextDate.setDate(nextDate.getDate() + 7);
            }
            
            // Update if this is sooner than previous
            if (nextScheduledDate === null || nextDate < nextScheduledDate) {
                nextScheduled = config;
                nextScheduledDate = nextDate;
            }
        }
    });
    
    // Display next backup
    if (nextScheduled && nextScheduledDate) {
        const formattedDate = nextScheduledDate.toLocaleDateString();
        const formattedTime = nextScheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        nextBackup.textContent = `${nextScheduled.name} on ${formattedDate} at ${formattedTime}`;
    } else {
        nextBackup.textContent = 'None scheduled';
    }
    
    // Display recent backups (latest 5)
    const recentResults = [...results]
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, 5);
    
    if (recentResults.length === 0) {
        recentBackupsTable.innerHTML = '<tr><td colspan="5" class="text-center">No backups performed yet</td></tr>';
    } else {
        recentBackupsTable.innerHTML = recentResults.map(result => {
            const config = configs.find(c => c.id === result.configId);
            const configName = config ? config.name : 'Unknown';
            const date = new Date(result.startTime).toLocaleString();
            const statusClass = result.success ? 'success' : 'failure';
            const statusText = result.success ? 'Success' : 'Failed';
            const size = formatBytes(result.totalSize);
            
            return `
                <tr>
                    <td>${configName}</td>
                    <td>${date}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>${result.fileCount}</td>
                    <td>${size}</td>
                </tr>
            `;
        }).join('');
    }
}

// Update configurations table
function updateConfigsTable() {
    if (configs.length === 0) {
        configsTable.innerHTML = '<tr><td colspan="6" class="text-center">No backup configurations yet</td></tr>';
        return;
    }
    
    configsTable.innerHTML = configs.map(config => {
        const sources = config.sourcePaths.join(', ');
        const schedule = config.schedule.enabled 
            ? `${config.schedule.daysOfWeek.join(', ')} at ${config.schedule.hour.toString().padStart(2, '0')}:${config.schedule.minute.toString().padStart(2, '0')}`
            : 'Manual only';
        
        return `
            <tr>
                <td>${config.name}</td>
                <td title="${sources}">${truncateText(sources, 30)}</td>
                <td title="${config.destPath}">${truncateText(config.destPath, 30)}</td>
                <td>${config.protocol.toUpperCase()}</td>
                <td>${schedule}</td>
                <td class="action-buttons">
                    <button class="btn small edit-config" data-id="${config.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn small primary start-backup" data-id="${config.id}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn small danger delete-config" data-id="${config.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Set up action button handlers
    setupConfigActions();
}

// Set up configuration action buttons
function setupConfigActions() {
    // Edit config buttons
    document.querySelectorAll('.edit-config').forEach(button => {
        button.addEventListener('click', async () => {
            const configId = button.getAttribute('data-id');
            const config = configs.find(c => c.id === configId);
            
            if (config) {
                // Fill form
                document.getElementById('configId').value = config.id;
                document.getElementById('configName').value = config.name;
                document.getElementById('protocol').value = config.protocol;
                document.getElementById('destPath').value = config.destPath;
                
                if (config.protocol !== 'local') {
                    document.getElementById('username').value = config.username || '';
                    document.getElementById('password').value = config.password || '';
                    document.getElementById('domain').value = config.domain || '';
                }
                
                // Set schedule
                document.getElementById('scheduleEnabled').checked = config.schedule.enabled;
                document.getElementById('scheduleHour').value = config.schedule.hour;
                document.getElementById('scheduleMinute').value = config.schedule.minute;
                
                // Clear all day checkboxes
                document.querySelectorAll('.day-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Check selected days
                config.schedule.daysOfWeek.forEach(day => {
                    const checkbox = document.querySelector(`.day-checkbox[value="${day}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
                
                // Set source paths
                sourcePathsContainer.innerHTML = '';
                config.sourcePaths.forEach(path => {
                    const sourceRow = document.createElement('div');
                    sourceRow.className = 'source-path-row';
                    sourceRow.innerHTML = `
                        <input type="text" class="source-path" required value="${path}">
                        <button type="button" class="btn small remove-source"><i class="fas fa-minus"></i></button>
                    `;
                    sourcePathsContainer.appendChild(sourceRow);
                });
                
                // If empty, add one row
                if (config.sourcePaths.length === 0) {
                    const sourceRow = document.createElement('div');
                    sourceRow.className = 'source-path-row';
                    sourceRow.innerHTML = `
                        <input type="text" class="source-path" required>
                        <button type="button" class="btn small remove-source"><i class="fas fa-minus"></i></button>
                    `;
                    sourcePathsContainer.appendChild(sourceRow);
                }
                
                // Set up remove source handlers
                setupRemoveSourceHandlers();
                
                // Update conditional fields
                updateProtocolFields();
                updateScheduleFields();
                
                // Update modal title
                document.getElementById('modalTitle').textContent = 'Edit Backup Configuration';
                
                // Show modal
                configModal.style.display = 'block';
            }
        });
    });
    
    // Start backup buttons
    document.querySelectorAll('.start-backup').forEach(button => {
        button.addEventListener('click', async () => {
            const configId = button.getAttribute('data-id');
            const config = configs.find(c => c.id === configId);
            
            if (config && confirm(`Start backup for "${config.name}" now?`)) {
                try {
                    showLoading();
                    
                    const response = await fetch(`${API.CONFIGS}/${configId}/backup`, {
                        method: 'POST'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to start backup');
                    }
                    
                    alert(`Backup started for "${config.name}". Check the results page for status.`);
                    
                    // Switch to results tab after a delay
                    setTimeout(() => {
                        document.querySelector('.nav-item[data-view="results"]').click();
                        // Refresh data
                        fetchData();
                    }, 1000);
                    
                } catch (error) {
                    alert(`Error: ${error.message}`);
                } finally {
                    hideLoading();
                }
            }
        });
    });
    
    // Delete config buttons
    document.querySelectorAll('.delete-config').forEach(button => {
        button.addEventListener('click', async () => {
            const configId = button.getAttribute('data-id');
            const config = configs.find(c => c.id === configId);
             
            if (config && confirm(`Are you sure you want to delete "${config.name}"?`)) {
                try {
                    showLoading();
                    
                    const response = await fetch(`${API.CONFIGS}/${configId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to delete configuration');
                    }
                    
                    // Refresh data
                    fetchData();
                    
                } catch (error) {
                    alert(`Error: ${error.message}`);
                } finally {
                    hideLoading();
                }
            }
        });
    });
}

// Update results table
function updateResultsTable() {
    // Apply filters
    const filteredResults = filterResultsData();
    
    if (filteredResults.length === 0) {
        resultsTable.innerHTML = '<tr><td colspan="7" class="text-center">No backup results found</td></tr>';
        return;
    }
    
    resultsTable.innerHTML = filteredResults.map(result => {
        const config = configs.find(c => c.id === result.configId);
        const configName = config ? config.name : 'Unknown';
        
        const startTime = new Date(result.startTime);
        const endTime = new Date(result.endTime);
        const duration = (endTime - startTime) / 1000; // in seconds
        
        let durationText;
        if (duration < 60) {
            durationText = `${duration.toFixed(1)} seconds`;
        } else if (duration < 3600) {
            durationText = `${(duration / 60).toFixed(1)} minutes`;
        } else {
            durationText = `${(duration / 3600).toFixed(1)} hours`;
        }
        
        const statusClass = result.success ? 'success' : 'failure';
        const statusText = result.success ? 'Success' : 'Failed';
        const size = formatBytes(result.totalSize);
        
        return `
            <tr>
                <td>${configName}</td>
                <td>${startTime.toLocaleString()}</td>
                <td>${durationText}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>${result.fileCount}</td>
                <td>${size}</td>
                <td>
                    <button class="btn small view-result" data-id="${result.id}">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Set up view result buttons
    document.querySelectorAll('.view-result').forEach(button => {
        button.addEventListener('click', () => {
            const resultId = button.getAttribute('data-id');
            const result = results.find(r => r.id === resultId);
            
            if (result) {
                // Get config name
                const config = configs.find(c => c.id === result.configId);
                const configName = config ? config.name : 'Unknown';
                
                // Format start and end times
                const startTime = new Date(result.startTime).toLocaleString();
                const endTime = new Date(result.endTime).toLocaleString();
                
                // Calculate duration
                const duration = (new Date(result.endTime) - new Date(result.startTime)) / 1000; // in seconds
                let durationText;
                if (duration < 60) {
                    durationText = `${duration.toFixed(1)} seconds`;
                } else if (duration < 3600) {
                    durationText = `${(duration / 60).toFixed(1)} minutes`;
                } else {
                    durationText = `${(duration / 3600).toFixed(1)} hours`;
                }
                
                // Status and other details
                const statusClass = result.success ? 'success' : 'failure';
                const statusText = result.success ? 'Success' : 'Failed';
                const size = formatBytes(result.totalSize);
                
                // Set modal content
                document.getElementById('resultModalTitle').textContent = `Backup Details - ${configName}`;
                document.getElementById('resultModalBody').innerHTML = `
                    <div class="result-details">
                        <div class="detail-row">
                            <strong>Status:</strong>
                            <span class="status ${statusClass}">${statusText}</span>
                        </div>
                        <div class="detail-row">
                            <strong>Start Time:</strong>
                            <span>${startTime}</span>
                        </div>
                        <div class="detail-row">
                            <strong>End Time:</strong>
                            <span>${endTime}</span>
                        </div>
                        <div class="detail-row">
                            <strong>Duration:</strong>
                            <span>${durationText}</span>
                        </div>
                        <div class="detail-row">
                            <strong>Files Backed Up:</strong>
                            <span>${result.fileCount}</span>
                        </div>
                        <div class="detail-row">
                            <strong>Total Size:</strong>
                            <span>${size}</span>
                        </div>
                        ${result.message ? `
                        <div class="detail-row">
                            <strong>Message:</strong>
                            <div class="message ${result.success ? '' : 'error'}">${result.message}</div>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                // Show modal
                resultModal.style.display = 'block';
            }
        });
    });
}

// Update config filter select
function updateConfigFilter() {
    // Clear options except the first one
    while (configFilter.options.length > 1) {
        configFilter.remove(1);
    }
    
    // Add options for each config
    configs.forEach(config => {
        const option = document.createElement('option');
        option.value = config.id;
        option.textContent = config.name;
        configFilter.appendChild(option);
    });
}

// Filter results based on selection
function filterResults() {
    updateResultsTable();
}

// Filter results data
function filterResultsData() {
    const configId = configFilter.value;
    const status = statusFilter.value;
    
    return results.filter(result => {
        // Filter by config
        if (configId && result.configId !== configId) {
            return false;
        }
        
        // Filter by status
        if (status === 'success' && !result.success) {
            return false;
        }
        if (status === 'failure' && result.success) {
            return false;
        }
        
        return true;
    }).sort((a, b) => new Date(b.startTime) - new Date(a.startTime)); // Sort by date, newest first
}

// Helper: Format bytes to human-readable size
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper: Truncate text with ellipsis
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Add additional styles for result details
document.head.insertAdjacentHTML('beforeend', `
<style>
.result-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.detail-row {
    display: flex;
    border-bottom: 1px solid var(--light-gray);
    padding-bottom: 0.75rem;
}

.detail-row strong {
    width: 150px;
    flex-shrink: 0;
}

.detail-row .message {
    flex: 1;
    padding: 0.5rem;
    background-color: var(--light-gray);
    border-radius: var(--border-radius);
    white-space: pre-wrap;
    font-family: monospace;
}

.detail-row .message.error {
    background-color: rgba(220, 53, 69, 0.1);
    color: var(--danger-color);
}

.text-center {
    text-align: center;
}

/* Additional responsive styles */
@media (max-width: 600px) {
    .detail-row {
        flex-direction: column;
    }
    
    .detail-row strong {
        width: 100%;
        margin-bottom: 0.25rem;
    }
}
</style>
`);
