// Login page — authenticates user and stores JWT for personalized chat sessions.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAuthToken, setStoredUser } from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      setAuthToken(data.token);
      setStoredUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>NeuroWell</h1>
        <p>Your multimodal mental wellness companion</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
