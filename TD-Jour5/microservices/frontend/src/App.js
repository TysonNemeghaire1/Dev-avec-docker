import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/products');
      setProducts(response.data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des produits');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (productId) => {
    try {
      const response = await axios.post('/api/payment/process', {
        productId,
        amount: products.find(p => p.id === productId).price,
        userId: 'user-123'
      });
      
      if (response.data.success) {
        alert('Paiement réussi ! 🎉');
      } else {
        alert('Échec du paiement');
      }
    } catch (err) {
      alert('Erreur lors du paiement');
      console.error('Payment error:', err);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🛒 TechMarket</h1>
        <p>Votre marketplace de confiance</p>
      </header>

      <main className="App-main">
        {loading && <div className="loading">Chargement des produits...</div>}
        
        {error && <div className="error">{error}</div>}
        
        {!loading && !error && (
          <div className="products-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                <h3>{product.name}</h3>
                <p className="description">{product.description}</p>
                <p className="price">{product.price} €</p>
                <button 
                  className="buy-button"
                  onClick={() => handlePurchase(product.id)}
                >
                  Acheter
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>TechMarket © 2026 - Platform Engineering TP</p>
      </footer>
    </div>
  );
}

export default App;
