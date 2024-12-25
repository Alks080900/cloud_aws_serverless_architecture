import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const Signup = () => {
    const [file, setFile] = useState(null);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const baseUrl = process.env.REACT_APP_BASE_API;

    const navigate = useNavigate();

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];

        if (selectedFile && !selectedFile.type.startsWith('image/')) {
            setMessage('Please select an image file.');
            return;
        }

        if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
            setMessage('File size must be less than 5MB.');
            return;
        }

        setFile(selectedFile);
        setMessage('');
    };

    const handleUpload = async (event) => {
        event.preventDefault();

        if (!file || !email || !name || !password || !confirmPassword) {
            setMessage('Please fill out all fields and select a file.');
            return;
        }

        if (password !== confirmPassword) {
            setMessage('Passwords do not match.');
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            setMessage('Please enter a valid email address.');
            return;
        }

        if (password.length < 6) {
            setMessage('Password must be at least 6 characters long.');
            return;
        }

        setIsUploading(true);
        try {
            const uniqueFilename = `${uuidv4()}_${file.name}`;
            const contentType = file.type;

            const response = await axios.post(
                `${baseUrl}/signup`,
                { filename: uniqueFilename, contentType, email, name, password }
            );

            const { uploadURL } = response.data;

            await axios.put(uploadURL, file, {
                headers: { 'Content-Type': file.type },
            });

            setMessage('Upload successful! Redirecting to login...');
            clearFields();
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            console.error('Error uploading file:', error);
            setMessage('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const clearFields = () => {
        setFile(null);
        setEmail('');
        setName('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <form onSubmit={handleUpload} className="container">
            <h1>SIGN UP!</h1>
            <p>Fill the form below to <strong>Sign Up</strong></p>
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
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Enter Your Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    required
                />
                <label htmlFor="name">Name</label>
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

            <div className="form-group">
                <input
                    className="form-control"
                    type="password"
                    id="confirm-password"
                    name="confirmPassword"
                    placeholder="Confirm Your Password *"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    required
                />
                <label htmlFor="confirm-password">Confirm Password</label>
            </div>

            <div className="form-group">
                <input
                    className="form-control"
                    type="file"
                    id="file"
                    name="file"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    required
                />
                <label htmlFor="file">Profile Picture</label>
            </div>

            <hr style={{ border: '1px solid #999', marginTop: '0.8rem' }} />
            <input className="btn" type="submit" value={isUploading ? 'Uploading...' : 'SIGN UP'} disabled={isUploading} />
            {message && <p className="error">{message}</p>}

            <div className="signup-container">
                <p>Already have an account?</p>
                <button type="button" className="signup-button" onClick={() => navigate('/login')}>
                    Login
                </button>
            </div>
        </form>
    );
};

export default Signup;
