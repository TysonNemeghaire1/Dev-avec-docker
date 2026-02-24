package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
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

// Database

var db *sql.DB
var startTime = time.Now()

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to open database: %v\n", err)
		os.Exit(1)
	}

	if err = db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to ping database: %v\n", err)
		os.Exit(1)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS orders (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id VARCHAR(255) NOT NULL,
			items JSONB NOT NULL,
			total DOUBLE PRECISION NOT NULL,
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create table: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Database tables initialized")
}

// Helpers

func calculateTotal(items []OrderItem) float64 {
	total := 0.0
	for _, item := range items {
		total += item.Price * float64(item.Quantity)
	}
	return total
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func scanOrder(row interface{ Scan(dest ...interface{}) error }) (*Order, error) {
	var o Order
	var itemsJSON []byte
	var createdAt, updatedAt time.Time

	err := row.Scan(&o.ID, &o.UserID, &itemsJSON, &o.Total, &o.Status, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(itemsJSON, &o.Items); err != nil {
		return nil, err
	}

	o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

	return &o, nil
}

// Seed data

func seedOrders() {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM orders").Scan(&count); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to count orders: %v\n", err)
		return
	}
	if count > 0 {
		return
	}

	seeds := []struct {
		userID string
		items  []OrderItem
		total  float64
		status string
	}{
		{
			userID: "user-001",
			items: []OrderItem{
				{ProductID: "prod-001", Quantity: 2, Price: 29.99},
				{ProductID: "prod-003", Quantity: 1, Price: 49.99},
			},
			total:  109.97,
			status: "confirmed",
		},
		{
			userID: "user-002",
			items: []OrderItem{
				{ProductID: "prod-002", Quantity: 1, Price: 99.99},
			},
			total:  99.99,
			status: "pending",
		},
		{
			userID: "user-001",
			items: []OrderItem{
				{ProductID: "prod-004", Quantity: 3, Price: 15.00},
				{ProductID: "prod-005", Quantity: 1, Price: 199.99},
			},
			total:  244.99,
			status: "delivered",
		},
	}

	for _, s := range seeds {
		itemsJSON, _ := json.Marshal(s.items)
		_, err := db.Exec(
			"INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4)",
			s.userID, itemsJSON, s.total, s.status,
		)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to seed order: %v\n", err)
		}
	}
	fmt.Println("Seed data inserted")
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
	if err := db.Ping(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"status": "not ready",
			"error":  err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ready",
	})
}

// CRUD handlers

func listOrdersHandler(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")

	var rows *sql.Rows
	var err error

	if statusFilter != "" {
		rows, err = db.Query(
			"SELECT id, user_id, items, total, status, created_at, updated_at FROM orders WHERE status = $1 ORDER BY created_at",
			statusFilter,
		)
	} else {
		rows, err = db.Query("SELECT id, user_id, items, total, status, created_at, updated_at FROM orders ORDER BY created_at")
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to list orders",
			"code":  "INTERNAL_ERROR",
		})
		return
	}
	defer rows.Close()

	result := []Order{}
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to scan order",
				"code":  "INTERNAL_ERROR",
			})
			return
		}
		result = append(result, *o)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"orders": result,
		"total":  len(result),
	})
}

func getOrderHandler(w http.ResponseWriter, r *http.Request, id string) {
	row := db.QueryRow(
		"SELECT id, user_id, items, total, status, created_at, updated_at FROM orders WHERE id = $1",
		id,
	)
	order, err := scanOrder(row)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Order not found",
			"code":  "ORDER_NOT_FOUND",
		})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to get order",
			"code":  "INTERNAL_ERROR",
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

	total := calculateTotal(req.Items)
	itemsJSON, _ := json.Marshal(req.Items)

	row := db.QueryRow(
		`INSERT INTO orders (user_id, items, total, status)
		 VALUES ($1, $2, $3, 'pending')
		 RETURNING id, user_id, items, total, status, created_at, updated_at`,
		req.UserID, itemsJSON, total,
	)

	order, err := scanOrder(row)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to create order",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Order created successfully",
		"order":   *order,
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

	row := db.QueryRow(
		`UPDATE orders SET status = $1, updated_at = NOW()
		 WHERE id = $2
		 RETURNING id, user_id, items, total, status, created_at, updated_at`,
		req.Status, id,
	)

	order, err := scanOrder(row)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Order not found",
			"code":  "ORDER_NOT_FOUND",
		})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to update order",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Order updated successfully",
		"order":   *order,
	})
}

func deleteOrderHandler(w http.ResponseWriter, r *http.Request, id string) {
	result, err := db.Exec("DELETE FROM orders WHERE id = $1", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to delete order",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Order not found",
			"code":  "ORDER_NOT_FOUND",
		})
		return
	}

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

	initDB()
	defer db.Close()

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
