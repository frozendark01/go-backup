# Go Backup Application - Installation and Usage Guide

## Overview

This application provides a robust backup solution with the following features:
- Multiple backup sources and destinations
- Support for local, CIFS, NFS, and SMB protocols
- Manual and scheduled backups
- Detailed backup history and reporting
- Responsive design for both desktop and mobile devices

## Installation

### Prerequisites

- Go 1.16 or higher
- Rsync (for file copying)
- Mount commands for CIFS/SMB and NFS

### Step 1: Install dependencies

```bash
# Install Go dependencies
go get github.com/gorilla/mux
go get github.com/go-co-op/gocron
```

### Step 2: Create directory structure

Create the following directory structure:

```
go-backup/
├── main.go
├── static/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js
```

### Step 3: Copy the application files

Copy the provided files to their respective locations:
- `main.go` to the root directory
- `index.html` to the `static/` directory
- `styles.css` to the `static/css/` directory
- `app.js` to the `static/js/` directory

### Step 4: Build and run the application

```bash
# Navigate to the application directory
cd go-backup

# Build the application
go build -o go-backup

# Run the application
./go-backup
```

The application will now be accessible at http://localhost:8080

## Usage Guide

### Dashboard

The dashboard provides an overview of your backup configurations and recent backup history. You can see:
- Total number of backup configurations
- Total completed backups
- Next scheduled backup
- Recent backup results

### Backup Configurations

In this section, you can manage your backup configurations:

1. **Create a new configuration**:
   - Click "New Configuration" button
   - Fill in the required details:
     - Name: A descriptive name for the backup
     - Source Paths: One or more directories to backup
     - Protocol: Local, CIFS, NFS, or SMB
     - Destination Path: Where to store the backup
     - Credentials (if using network protocols)
     - Schedule (optional): Days and time for automatic backups

2. **Edit an existing configuration**:
   - Click the edit icon next to a configuration
   - Modify the settings as needed
   - Click "Save Configuration"

3. **Run a backup manually**:
   - Click the play icon next to a configuration
   - Confirm to start the backup process
   - The application will switch to the Results view to show progress

4. **Delete a configuration**:
   - Click the trash icon next to a configuration
   - Confirm deletion

### Backup History

The Results view shows the history of all backup operations:

- Filter by configuration or status
- View details of each backup including:
  - Start and end times
  - Duration
  - Number of files backed up
  - Total size
  - Success or failure status
  - Detailed messages (especially useful for troubleshooting failed backups)

## Troubleshooting

### Common Issues

1. **Network Protocol Errors**:
   - Ensure the destination server is accessible
   - Verify username and password
   - Check if the necessary client tools are installed (e.g., cifs-utils for SMB/CIFS)

2. **Permission Issues**:
   - The application needs sufficient permissions to read source files and write to destinations
   - For network protocols, ensure the user has appropriate access rights

3. **Scheduling Problems**:
   - Verify that at least one day of the week is selected
   - Ensure the time is set correctly

### Logs

The application logs to standard output. Run with output redirection to save logs:

```bash
./go-backup > backup.log 2>&1
```

## Mobile Usage

The application is fully responsive and works on mobile devices:

- The navigation menu collapses to a hamburger menu on small screens
- Tables become scrollable to accommodate smaller displays
- Form fields adjust to fit the screen width

## Security Considerations

- Passwords are stored in plain text in the configuration file. Consider:
  - Restricting file permissions on the configuration file
  - Running the application in a secure environment
  - Using a credential manager for production environments

## Auto-starting the Application

### Linux (Systemd)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/go-backup.service
```

Add the following content:

```
[Unit]
Description=Go Backup Application
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/go-backup
ExecStart=/path/to/go-backup/go-backup
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable go-backup
sudo systemctl start go-backup
```

### Windows

Create a startup script or use Task Scheduler to run the application at system startup.
