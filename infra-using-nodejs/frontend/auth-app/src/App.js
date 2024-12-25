import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Signup from './components/Signup';
import Login from './components/Login';
import Profile from './components/Profile';
import './App.css'; // Import your CSS file

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Check if token exists in localStorage to maintain session
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
      navigate('/profile'); // Automatically redirect if already logged in
    }
  }, [navigate]);

  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={<Login setIsAuthenticated={setIsAuthenticated} />}
        />
        <Route
          path="/signup"
          element={<Signup />}
        />
        <Route
          path="/login"
          element={<Login setIsAuthenticated={setIsAuthenticated} />}  // Pass setIsAuthenticated here
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <Profile /> : <Login setIsAuthenticated={setIsAuthenticated} />}
        />
      </Routes>
    </div>
  );
};

export default App;
