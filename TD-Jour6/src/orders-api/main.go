package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Models

type OrderItem struct {
	ProductID string  `json:"product_id"`
	Quantity  int     `json:"quantity"`
	Price     float64 `json:"price"`
}

type Order struct {
	ID        string      `json:"id"`
	UserID    string      `json:"user_id"`
	Items     []OrderItem `json:"items"`
	Total     float64     `json:"total"`
	Status    string      `json:"status"`
	CreatedAt string      `json:"created_at"`
	UpdatedAt string      `json:"updated_at"`
}

type CreateOrderRequest struct {
	UserID string      `json:"user_id"`
	Items  []OrderItem `json:"items"`
}

type UpdateOrderRequest struct {
	Status string `json:"status,omitempty"`
}

// In-memory storage

var (
	orders   []Order
	ordersMu sync.Mutex
)

var startTime = time.Now()

// Helpers

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func findOrderByID(id string) (int, *Order) {
	for i := range orders {
		if orders[i].ID == id {
			return i, &orders[i]
		}
	}
	return -1, nil
}

func calculateTotal(items []OrderItem) float64 {
	total := 0.0
	for _, item := range items {
		total += item.Price * float64(item.Quantity)
	}
	return total
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Seed data

func seedOrders() {
	now := nowISO()
	orders = []Order{
		{
			ID:     generateUUID(),
			UserID: "user-001",
			Items: []OrderItem{
				{ProductID: "prod-001", Quantity: 2, Price: 29.99},
				{ProductID: "prod-003", Quantity: 1, Price: 49.99},
			},
			Total:     109.97,
			Status:    "confirmed",
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:     generateUUID(),
			UserID: "user-002",
			Items: []OrderItem{
				{ProductID: "prod-002", Quantity: 1, Price: 99.99},
			},
			Total:     99.99,
			Status:    "pending",
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:     generateUUID(),
			UserID: "user-001",
			Items: []OrderItem{
				{ProductID: "prod-004", Quantity: 3, Price: 15.00},
				{ProductID: "prod-005", Quantity: 1, Price: 199.99},
			},
			Total:     244.99,
			Status:    "delivered",
			CreatedAt: now,
			UpdatedAt: now,
		},
	}
}

// Health handlers

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
		"timestamp": nowISO(),
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

// CRUD handlers

func listOrdersHandler(w http.ResponseWriter, r *http.Request) {
	ordersMu.Lock()
	defer ordersMu.Unlock()

	statusFilter := r.URL.Query().Get("status")

	var result []Order
	for _, o := range orders {
		if statusFilter == "" || o.Status == statusFilter {
			result = append(result, o)
		}
	}

	if result == nil {
		result = []Order{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"orders": result,
		"total":  len(result),
	})
}

func getOrderHandler(w http.ResponseWriter, r *http.Request, id string) {
	ordersMu.Lock()
	defer ordersMu.Unlock()

	_, order := findOrderByID(id)
	if order == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Order not found",
			"code":  "ORDER_NOT_FOUND",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"order": *order,
	})
}

func createOrderHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid JSON body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if req.UserID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "user_id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if len(req.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "At least one item is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	for _, item := range req.Items {
		if item.ProductID == "" || item.Quantity <= 0 || item.Price <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"error": "Each item must have a valid product_id, quantity > 0, and price > 0",
				"code":  "VALIDATION_ERROR",
			})
			return
		}
	}

	now := nowISO()
	order := Order{
		ID:        generateUUID(),
		UserID:    req.UserID,
		Items:     req.Items,
		Total:     calculateTotal(req.Items),
		Status:    "pending",
		CreatedAt: now,
		UpdatedAt: now,
	}

	ordersMu.Lock()
	orders = append(orders, order)
	ordersMu.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Order created successfully",
		"order":   order,
	})
}

func updateOrderHandler(w http.ResponseWriter, r *http.Request, id string) {
	var req UpdateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid JSON body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	validStatuses := map[string]bool{
		"pending":   true,
		"confirmed": true,
		"shipped":   true,
		"delivered": true,
		"cancelled": true,
	}

	if req.Status != "" && !validStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid status. Must be one of: pending, confirmed, shipped, delivered, cancelled",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	ordersMu.Lock()
	defer ordersMu.Unlock()

	_, order := findOrderByID(id)
	if order == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Order not found",
			"code":  "ORDER_NOT_FOUND",
		})
		return
	}

	if req.Status != "" {
		order.Status = req.Status
	}
	order.UpdatedAt = nowISO()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Order updated successfully",
		"order":   *order,
	})
}

func deleteOrderHandler(w http.ResponseWriter, r *http.Request, id string) {
	ordersMu.Lock()
	defer ordersMu.Unlock()

	idx, _ := findOrderByID(id)
	if idx == -1 {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Order not found",
			"code":  "ORDER_NOT_FOUND",
		})
		return
	}

	orders = append(orders[:idx], orders[idx+1:]...)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Order deleted successfully",
	})
}

// Router

func ordersRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Strip trailing slash for matching, but keep /orders/ as list
	cleanPath := strings.TrimSuffix(path, "/")

	// GET /orders/ or /orders — list all
	if (cleanPath == "/orders" || path == "/orders/") && r.Method == http.MethodGet {
		listOrdersHandler(w, r)
		return
	}

	// POST /orders/ or /orders — create
	if (cleanPath == "/orders" || path == "/orders/") && r.Method == http.MethodPost {
		createOrderHandler(w, r)
		return
	}

	// Extract ID from /orders/{id}
	if strings.HasPrefix(path, "/orders/") {
		id := strings.TrimPrefix(cleanPath, "/orders/")
		if id != "" && !strings.Contains(id, "/") {
			switch r.Method {
			case http.MethodGet:
				getOrderHandler(w, r, id)
				return
			case http.MethodPut:
				updateOrderHandler(w, r, id)
				return
			case http.MethodDelete:
				deleteOrderHandler(w, r, id)
				return
			default:
				writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
					"error": "Method not allowed",
					"code":  "METHOD_NOT_ALLOWED",
				})
				return
			}
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]interface{}{
		"status":  404,
		"error":   "Not Found",
		"message": fmt.Sprintf("Route %s %s not found", r.Method, r.URL.Path),
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

	seedOrders()

	mux := http.NewServeMux()

	// Health endpoints (dual routes: /health for Docker HEALTHCHECK, /orders/health for API Gateway)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/orders/health", healthHandler)
	mux.HandleFunc("/orders/health/live", healthLiveHandler)
	mux.HandleFunc("/orders/health/ready", healthReadyHandler)

	// Orders CRUD
	mux.HandleFunc("/orders/", ordersRouter)
	mux.HandleFunc("/orders", ordersRouter)

	// Catch-all for unmatched routes
	mux.HandleFunc("/", notFoundHandler)

	fmt.Printf("Orders API running on port %s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
