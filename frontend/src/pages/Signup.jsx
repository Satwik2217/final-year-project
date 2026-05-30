import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api/client';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Account created! Please sign in.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError(data.message || 'Something went wrong');
      }
    } catch {
      setError('Cannot connect to the backend server.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-4xl font-extrabold text-emerald-700 tracking-tight">NeuroWell</h1>
        <p className="mt-2 text-sm text-slate-600">Beyond Generative AI</p>
        <h2 className="mt-6 text-2xl font-bold text-slate-900">Create your account</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200/80 sm:rounded-2xl sm:px-10">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</div>}
          {success && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">{success}</div>}
          
          <form className="space-y-6" onSubmit={handleSignupSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <button 
                type="submit" 
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors duration-200 cursor-pointer"
              >
                Register
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <button 
                onClick={() => navigate('/login')} 
                className="font-medium text-emerald-600 hover:text-emerald-500 cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}