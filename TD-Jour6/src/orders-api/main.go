package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

var startTime = time.Now()

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"error": "Method not allowed",
			"code":  "METHOD_NOT_ALLOWED",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "orders-api",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"uptime":    time.Since(startTime).Seconds(),
	})
}

func healthLiveHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"error": "Method not allowed",
			"code":  "METHOD_NOT_ALLOWED",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "alive",
	})
}

func healthReadyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"error": "Method not allowed",
			"code":  "METHOD_NOT_ALLOWED",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ready",
	})
}

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]interface{}{
		"status":  404,
		"error":   "Not Found",
		"message": fmt.Sprintf("Route %s %s not found", r.Method, r.URL.Path),
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	mux := http.NewServeMux()

	// Health endpoints (dual routes: /health for Docker HEALTHCHECK, /orders/health for API Gateway)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/orders/health", healthHandler)
	mux.HandleFunc("/orders/health/live", healthLiveHandler)
	mux.HandleFunc("/orders/health/ready", healthReadyHandler)

	// Catch-all for unmatched routes
	mux.HandleFunc("/", notFoundHandler)

	fmt.Printf("Orders API running on port %s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
