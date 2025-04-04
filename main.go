package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-co-op/gocron"
	"github.com/gorilla/mux"
)

// BackupConfig represents a backup configuration
type BackupConfig struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	SourcePaths []string `json:"sourcePaths"`
	DestPath    string   `json:"destPath"`
	Protocol    string   `json:"protocol"` // local, cifs, nfs, smb
	Username    string   `json:"username,omitempty"`
	Password    string   `json:"password,omitempty"`
	Domain      string   `json:"domain,omitempty"`
	Schedule    Schedule `json:"schedule"`
}

// Schedule represents a backup schedule
type Schedule struct {
	Enabled   bool     `json:"enabled"`
	DaysOfWeek []string `json:"daysOfWeek"` // Monday, Tuesday, etc.
	Hour      int      `json:"hour"`
	Minute    int      `json:"minute"`
}

// BackupResult represents the result of a backup operation
type BackupResult struct {
	ID        string    `json:"id"`
	ConfigID  string    `json:"configId"`
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
	Success   bool      `json:"success"`
	Message   string    `json:"message"`
	FileCount int       `json:"fileCount"`
	TotalSize int64     `json:"totalSize"` // in bytes
}

var (
	configs       []BackupConfig
	results       []BackupResult
	configFile    = "backup_configs.json"
	resultsFile   = "backup_results.json"
	scheduler     *gocron.Scheduler
)

func init() {
	// Create backup directory if it doesn't exist
	os.MkdirAll("backups", 0755)
	
	// Load configurations from file
	loadConfigs()
	loadResults()
	
	// Initialize scheduler
	scheduler = gocron.NewScheduler(time.Local)
	scheduler.StartAsync()
	
	// Schedule all enabled backups
	scheduleBackups()
}

func loadConfigs() {
	file, err := os.ReadFile(configFile)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("Error reading config file: %v", err)
		}
		configs = []BackupConfig{}
		return
	}
	
	err = json.Unmarshal(file, &configs)
	if err != nil {
		log.Printf("Error parsing config file: %v", err)
		configs = []BackupConfig{}
	}
}

func saveConfigs() {
	data, err := json.MarshalIndent(configs, "", "  ")
	if err != nil {
		log.Printf("Error serializing configs: %v", err)
		return
	}
	
	err = os.WriteFile(configFile, data, 0644)
	if err != nil {
		log.Printf("Error writing config file: %v", err)
	}
}

func loadResults() {
	file, err := os.ReadFile(resultsFile)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("Error reading results file: %v", err)
		}
		results = []BackupResult{}
		return
	}
	
	err = json.Unmarshal(file, &results)
	if err != nil {
		log.Printf("Error parsing results file: %v", err)
		results = []BackupResult{}
	}
}

func saveResults() {
	data, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		log.Printf("Error serializing results: %v", err)
		return
	}
	
	err = os.WriteFile(resultsFile, data, 0644)
	if err != nil {
		log.Printf("Error writing results file: %v", err)
	}
}

func scheduleBackups() {
	// Clear existing jobs
	scheduler.Clear()
	
	// Schedule each enabled backup
	for _, config := range configs {
		if config.Schedule.Enabled {
			// Create a copy of the config for the closure
			cfg := config
			
			// Create a job for this backup
			job := scheduler.Every(1).Week()
			
			// Set days of week
			for _, day := range cfg.Schedule.DaysOfWeek {
				switch strings.ToLower(day) {
				case "monday":
					job = job.Monday()
				case "tuesday":
					job = job.Tuesday()
				case "wednesday":
					job = job.Wednesday()
				case "thursday":
					job = job.Thursday()
				case "friday":
					job = job.Friday()
				case "saturday":
					job = job.Saturday()
				case "sunday":
					job = job.Sunday()
				}
			}
			
			// Set time
			job = job.At(fmt.Sprintf("%02d:%02d", cfg.Schedule.Hour, cfg.Schedule.Minute))
			
			// Set function to execute
			job.Do(func() {
				performBackup(cfg)
			})
			
			log.Printf("Scheduled backup %s on %v at %02d:%02d", 
				cfg.Name, cfg.Schedule.DaysOfWeek, cfg.Schedule.Hour, cfg.Schedule.Minute)
		}
	}
}

func performBackup(config BackupConfig) BackupResult {
	result := BackupResult{
		ID:        strconv.FormatInt(time.Now().UnixNano(), 10),
		ConfigID:  config.ID,
		StartTime: time.Now(),
		Success:   false,
		FileCount: 0,
		TotalSize: 0,
	}
	
	log.Printf("Starting backup: %s", config.Name)
	
	// Prepare destination based on protocol
	destDir := filepath.Join("backups", config.ID, time.Now().Format("2006-01-02_15-04-05"))
	os.MkdirAll(destDir, 0755)
	
	var mountPoint string
	var cmd *exec.Cmd
	
	// Mount remote shares if needed
	if config.Protocol != "local" {
		// Create a temporary mount point
		mountPoint = filepath.Join(os.TempDir(), "backup_mount_"+config.ID)
		os.MkdirAll(mountPoint, 0755)
		
		// Mount based on protocol
		switch config.Protocol {
		case "cifs", "smb":
			// For CIFS/SMB
			args := []string{"-t", "cifs"}
			
			// Add credentials if provided
			if config.Username != "" {
				if config.Domain != "" {
					args = append(args, "-o", fmt.Sprintf("username=%s,password=%s,domain=%s", 
						config.Username, config.Password, config.Domain))
				} else {
					args = append(args, "-o", fmt.Sprintf("username=%s,password=%s", 
						config.Username, config.Password))
				}
			}
			
			args = append(args, config.DestPath, mountPoint)
			cmd = exec.Command("mount", args...)
			
		case "nfs":
			// For NFS
			cmd = exec.Command("mount", "-t", "nfs", config.DestPath, mountPoint)
		}
		
		// Execute mount command
		output, err := cmd.CombinedOutput()
		if err != nil {
			result.Message = fmt.Sprintf("Failed to mount %s: %v - %s", config.Protocol, err, string(output))
			result.EndTime = time.Now()
			log.Printf(result.Message)
			
			// Add result and save
			results = append(results, result)
			saveResults()
			
			return result
		}
		
		// Update destination path to use mount point
		destDir = mountPoint
	}
	
	// Perform backup for each source
	for _, src := range config.SourcePaths {
		// Use rsync for copying
		cmd = exec.Command("rsync", "-av", src, destDir)
		output, err := cmd.CombinedOutput()
		
		if err != nil {
			result.Message = fmt.Sprintf("Backup failed: %v - %s", err, string(output))
			result.EndTime = time.Now()
			log.Printf(result.Message)
			
			// Unmount if necessary
			if config.Protocol != "local" {
				exec.Command("umount", mountPoint).Run()
			}
			
			// Add result and save
			results = append(results, result)
			saveResults()
			
			return result
		}
		
		// Count files and size
		filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if !info.IsDir() {
				result.FileCount++
				result.TotalSize += info.Size()
			}
			return nil
		})
	}
	
	// Unmount if necessary
	if config.Protocol != "local" {
		exec.Command("umount", mountPoint).Run()
	}
	
	// Mark as successful
	result.Success = true
	result.Message = "Backup completed successfully"
	result.EndTime = time.Now()
	
	log.Printf("Completed backup: %s - Files: %d, Size: %d bytes", 
		config.Name, result.FileCount, result.TotalSize)
	
	// Add result and save
	results = append(results, result)
	saveResults()
	
	return result
}

// API handlers

func getConfigsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(configs)
}

func getConfigHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	for _, config := range configs {
		if config.ID == id {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(config)
			return
		}
	}
	
	http.NotFound(w, r)
}

func createConfigHandler(w http.ResponseWriter, r *http.Request) {
	var config BackupConfig
	err := json.NewDecoder(r.Body).Decode(&config)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	// Generate ID if not provided
	if config.ID == "" {
		config.ID = strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	
	// Add config
	configs = append(configs, config)
	saveConfigs()
	
	// Update schedules
	scheduleBackups()
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(config)
}

func updateConfigHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	var config BackupConfig
	err := json.NewDecoder(r.Body).Decode(&config)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	// Ensure ID matches
	if config.ID != id {
		http.Error(w, "ID mismatch", http.StatusBadRequest)
		return
	}
	
	// Find and update config
	found := false
	for i, c := range configs {
		if c.ID == id {
			configs[i] = config
			found = true
			break
		}
	}
	
	if !found {
		http.NotFound(w, r)
		return
	}
	
	saveConfigs()
	
	// Update schedules
	scheduleBackups()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func deleteConfigHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	// Find and remove config
	found := false
	for i, c := range configs {
		if c.ID == id {
			configs = append(configs[:i], configs[i+1:]...)
			found = true
			break
		}
	}
	
	if !found {
		http.NotFound(w, r)
		return
	}
	
	saveConfigs()
	
	// Update schedules
	scheduleBackups()
	
	w.WriteHeader(http.StatusNoContent)
}

func getResultsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func getResultsByConfigHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	configID := vars["configId"]
	
	var configResults []BackupResult
	for _, result := range results {
		if result.ConfigID == configID {
			configResults = append(configResults, result)
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(configResults)
}

func startBackupHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	// Find config
	var config *BackupConfig
	for _, c := range configs {
		if c.ID == id {
			config = &c
			break
		}
	}
	
	if config == nil {
		http.NotFound(w, r)
		return
	}
	
	// Start backup in a goroutine
	go performBackup(*config)
	
	w.WriteHeader(http.StatusAccepted)
	fmt.Fprintf(w, "Backup started for %s", config.Name)
}

func main() {
	router := mux.NewRouter()
	
	// API routes
	api := router.PathPrefix("/api").Subrouter()
	
	// Backup configurations
	api.HandleFunc("/configs", getConfigsHandler).Methods("GET")
	api.HandleFunc("/configs", createConfigHandler).Methods("POST")
	api.HandleFunc("/configs/{id}", getConfigHandler).Methods("GET")
	api.HandleFunc("/configs/{id}", updateConfigHandler).Methods("PUT")
	api.HandleFunc("/configs/{id}", deleteConfigHandler).Methods("DELETE")
	api.HandleFunc("/configs/{id}/backup", startBackupHandler).Methods("POST")
	
	// Backup results
	api.HandleFunc("/results", getResultsHandler).Methods("GET")
	api.HandleFunc("/results/config/{configId}", getResultsByConfigHandler).Methods("GET")
	
	// Serve static files
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))
	
	// Start server
	fmt.Println("Server starting on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}
