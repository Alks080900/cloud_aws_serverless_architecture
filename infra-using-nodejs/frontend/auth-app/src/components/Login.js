import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = ({ setIsAuthenticated }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const baseUrl = process.env.REACT_APP_BASE_API;

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setMessage('Please fill in all fields.');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const response = await axios.post(`${baseUrl}/login`, { email, password });
            const { token, profileImageUrl } = response.data;

            localStorage.setItem('authToken', token);
            localStorage.setItem('profileImageUrl', profileImageUrl);

            setLoading(false);
            setIsAuthenticated(true);
            navigate('/profile', { replace: true });
        } catch (error) {
            console.error('Login error:', error);
            setMessage('Login failed. Please try again.');
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin} className="container">
            <h1>LOG IN!</h1>
            <p>Fill the form below to <strong>Log In</strong></p>
            <hr style={{ border: '1px solid #999' }} />

            <div className="form-group">
                <input
                    className="form-control"
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter Your Email *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    required
                />
                <label htmlFor="email">Email Address</label>
            </div>

            <div className="form-group">
                <input
                    className="form-control"
                    type="password"
                    id="password"
                    name="password"
                    placeholder="Enter Your Password *"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    required
                />
                <label htmlFor="password">Password</label>
            </div>

            <hr style={{ border: '1px solid #999', marginTop: '0.8rem' }} />
            <input className="btn" type="submit" value={loading ? 'Logging in...' : 'LOG IN'} disabled={loading} />
            {message && <p className="error">{message}</p>}

            <div className="signup-container">
                <p>Don't have an account?</p>
                <button type="button" className="signup-button" onClick={() => navigate('/signup')}>
                    Sign Up
                </button>
            </div>
        </form>
    );
};

export default Login;
