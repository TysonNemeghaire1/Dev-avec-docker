import { useState, useEffect, useCallback } from 'react'

const API_URL = window.__ENV__?.API_URL || 'http://localhost:8080'

const styles = {
  container: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    padding: '24px 0',
    borderBottom: '2px solid var(--border)',
    marginBottom: 24,
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--primary)',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginTop: 4,
  },
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    borderBottom: '2px solid var(--border)',
    paddingBottom: 0,
  },
  tab: (active) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    fontSize: '1rem',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    marginBottom: -2,
    transition: 'all 0.2s',
  }),
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 20,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: '1 1 180px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    outline: 'none',
  },
  button: {
    padding: '8px 20px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  error: {
    background: '#fef2f2',
    color: 'var(--danger)',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    marginBottom: 16,
    border: '1px solid #fecaca',
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 600,
    background: color === 'green' ? '#dcfce7' : color === 'red' ? '#fef2f2' : '#f1f5f9',
    color: color === 'green' ? 'var(--success)' : color === 'red' ? 'var(--danger)' : 'var(--text-muted)',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid var(--border)',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
  },
  healthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  healthCard: (ok) => ({
    background: 'var(--surface)',
    border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
    borderRadius: 'var(--radius)',
    padding: 20,
    textAlign: 'center',
  }),
}

function ProductsTab() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ name: '', price: '', category: '' })

  const fetchProducts = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/products/products/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : data.products || [])
    } catch (err) {
      setError(`Failed to load products: ${err.message}`)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      const res = await fetch(`${API_URL}/products/products/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          price: parseFloat(form.price),
          category: form.category,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setForm({ name: '', price: '', category: '' })
      fetchProducts()
    } catch (err) {
      setError(`Failed to create product: ${err.message}`)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Products</h2>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Price</label>
          <input
            style={styles.input}
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Category</label>
          <input
            style={styles.input}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
        </div>
        <button type="submit" style={styles.button}>Add Product</button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Price</th>
            <th style={styles.th}>Category</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td style={styles.td}>{p.id}</td>
              <td style={styles.td}>{p.name}</td>
              <td style={styles.td}>{p.price?.toFixed(2)} &euro;</td>
              <td style={styles.td}>{p.category}</td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={4}>
                No products yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ product_id: '', quantity: '' })

  const fetchOrders = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/orders/orders/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : data.orders || [])
    } catch (err) {
      setError(`Failed to load orders: ${err.message}`)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      const res = await fetch(`${API_URL}/orders/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: form.product_id,
          quantity: parseInt(form.quantity, 10),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setForm({ product_id: '', quantity: '' })
      fetchOrders()
    } catch (err) {
      setError(`Failed to create order: ${err.message}`)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Orders</h2>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Product ID</label>
          <input
            style={styles.input}
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            required
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Quantity</label>
          <input
            style={styles.input}
            type="number"
            min="1"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
          />
        </div>
        <button type="submit" style={styles.button}>Create Order</button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Product ID</th>
            <th style={styles.th}>Quantity</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td style={styles.td}>{o.id}</td>
              <td style={styles.td}>{o.product_id}</td>
              <td style={styles.td}>{o.quantity}</td>
              <td style={styles.td}>
                <span style={styles.badge(o.status === 'completed' ? 'green' : 'gray')}>
                  {o.status || 'pending'}
                </span>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={4}>
                No orders yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function HealthTab() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  const fetchHealth = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(`Failed to check health: ${err.message}`)
    }
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  if (error) {
    return (
      <div>
        <h2 style={{ marginBottom: 16 }}>Health Check</h2>
        <div style={styles.error}>{error}</div>
        <button onClick={fetchHealth} style={styles.button}>Retry</button>
      </div>
    )
  }

  if (!health) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
  }

  const services = health.services || {}
  const serviceNames = Object.keys(services)

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Health Check</h2>

      <div style={{ ...styles.card, marginBottom: 24, textAlign: 'center' }}>
        <span style={styles.badge(health.status === 'healthy' ? 'green' : 'red')}>
          Gateway: {health.status || 'unknown'}
        </span>
      </div>

      {serviceNames.length > 0 && (
        <div style={styles.healthGrid}>
          {serviceNames.map((name) => {
            const svc = services[name]
            const ok = svc?.status === 'healthy' || svc?.status === 'up'
            return (
              <div key={name} style={styles.healthCard(ok)}>
                <div style={{ fontWeight: 600, marginBottom: 8, textTransform: 'capitalize' }}>{name}</div>
                <span style={styles.badge(ok ? 'green' : 'red')}>
                  {svc?.status || 'unknown'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button onClick={fetchHealth} style={styles.button}>Refresh</button>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('products')

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.title}>CloudShop</div>
        <div style={styles.subtitle}>E-Commerce Microservices Dashboard</div>
      </header>

      <nav style={styles.tabs}>
        {['products', 'orders', 'health'].map((t) => (
          <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'products' && <ProductsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'health' && <HealthTab />}
      </main>
    </div>
  )
}
