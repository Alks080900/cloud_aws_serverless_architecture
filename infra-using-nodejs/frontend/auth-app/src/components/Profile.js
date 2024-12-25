import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');
    const [image, setImage] = useState(null);
    const [newImage, setNewImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const bucket_name = process.env.REACT_APP_BUCKET_URL;
    const baseUrl = process.env.REACT_APP_BASE_API;

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError('User not logged in.');
            return;
        }

        try {
            const decoded = atob(token).split(':');
            const email = decoded[0];
            const timestamp = decoded[1];

            setUser({ email, timestamp });
            setImage(localStorage.getItem('profileImageUrl'));
        } catch (err) {
            setError('Error decoding token: ' + err.message);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('profileImageUrl');
        window.location.href = '/';
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setNewImage(file);
            setImage(previewUrl);
        }
    };

    const uploadImage = async () => {
        if (!newImage) {
            setMessage('Please select an image to upload.');
            return;
        }

        setUploading(true);
        setMessage('');

        const token = localStorage.getItem('authToken');
        const email = atob(token).split(':')[0];
        const oldImageUrl = localStorage.getItem('profileImageUrl');
        const oldImageKey = oldImageUrl.split('/').pop();
        const uniqueFilename = `${Date.now()}_${newImage.name}`;
        const contentType = newImage.type;

        try {
            const response = await axios.put(`${baseUrl}/updateProfileImage`, {
                email,
                oldImageKey,
                newFilename: uniqueFilename,
                newContentType: contentType,
            });

            const { uploadURL } = response.data;
            await axios.put(uploadURL, newImage, {
                headers: { 'Content-Type': newImage.type },
            });

            const updatedImageUrl = `https://${bucket_name}.s3.amazonaws.com/${uniqueFilename}`;
            localStorage.setItem('profileImageUrl', updatedImageUrl);
            setImage(updatedImageUrl);
            setMessage('Image uploaded successfully!');
        } catch (error) {
            console.error('Image upload error:', error);
            setMessage('Image upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="container">
            <h1>User Profile</h1>
            {error && <p className="error">{error}</p>}
            {user && (
                <div className="user-info">
                    <p>Email: {user.email}</p>
                    <p>Created Date: {user.timestamp}</p>
                    <div className="image-preview">
                        <h3>Profile Image:</h3>
                        <img src={image} alt="Profile" className="profile-image" />
                    </div>
                </div>
            )}
            <div className="form-group">
                <input type="file" className="form-control" onChange={handleImageChange} />
                <label htmlFor="file">Update Profile Picture</label>
            </div>
            <button className="btn" onClick={uploadImage} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Update Profile Image'}
            </button>
            {message && <p className="error">{message}</p>}
            <button className="btn logout-button" onClick={handleLogout}>Logout</button>
        </div>
    );
};

export default Profile;
