// Signup page — registers new user with bcrypt-hashed password on the backend.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAuthToken, setStoredUser } from '../api/client';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      setAuthToken(data.token);
      setStoredUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Join NeuroWell</h1>
        <p>Create your account to start chatting</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
