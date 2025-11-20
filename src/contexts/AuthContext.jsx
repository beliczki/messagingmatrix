import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

// Use VITE_API_URL if set, otherwise use empty string for relative URLs (same origin)
// In development, use localhost:3003. In production, nginx proxies /api to backend
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3003' : '');

// Simple hash function for password storage (using Web Crypto API)
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Initialize users - migrate from localStorage to API if needed, or create default users
const initializeUsers = async () => {
  try {
    // Check if users exist in API
    const response = await fetch(`${API_URL}/api/users`);
    const { users } = await response.json();

    if (users.length === 0) {
      // No users in API - check localStorage for migration
      const localStorageUsers = JSON.parse(localStorage.getItem('app_users') || '[]');

      if (localStorageUsers.length > 0) {
        // Migrate from localStorage
        console.log('Migrating users from localStorage to database...');
        const migrateResponse = await fetch(`${API_URL}/api/users/migrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: localStorageUsers })
        });

        if (migrateResponse.ok) {
          console.log('Users migrated successfully');
          // Clear localStorage after successful migration
          localStorage.removeItem('app_users');
        }
      } else {
        // Create default users
        console.log('Creating default users...');
        const adminPassword = await hashPassword('temporary123');
        const demoPassword = await hashPassword('vegtelenlove');
        const csengePassword = await hashPassword('vegtelenlove');

        const defaultUsers = [
          {
            email: 'beliczki.robert@gmail.com',
            password: adminPassword,
            role: 'admin'
          },
          {
            email: 'demo@messagingmatrix.ai',
            password: demoPassword,
            role: 'demo'
          },
          {
            email: 'csenge.barabas@mediaco.hu',
            password: csengePassword,
            role: 'user'
          }
        ];

        // Create each user via API
        for (const user of defaultUsers) {
          await fetch(`${API_URL}/api/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
          });
        }
      }
    }
  } catch (error) {
    console.error('Error initializing users:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize users on first load
    initializeUsers();

    // Check if user is already logged in (stored in localStorage for session persistence)
    const savedUser = localStorage.getItem('current_user');
    const savedToken = localStorage.getItem('auth_token');
    if (savedUser && savedToken) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const hashedPassword = await hashPassword(password);

      const response = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: hashedPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store JWT token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      // Store current user session in localStorage
      const userWithoutPassword = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role
      };

      localStorage.setItem('current_user', JSON.stringify(userWithoutPassword));
      setCurrentUser(userWithoutPassword);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('current_user');
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
  };

  // Helper function to get auth headers for API requests
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    } : {
      'Content-Type': 'application/json'
    };
  };

  const getAllUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`);
      const { users } = await response.json();
      return users;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  const changePassword = async (userId, newPassword) => {
    try {
      const hashedPassword = await hashPassword(newPassword);

      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: hashedPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const createUser = async (email, password, role = 'user') => {
    try {
      const hashedPassword = await hashPassword(password);

      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: hashedPassword, role })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'User creation failed');
      }

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    currentUser,
    login,
    logout,
    getAllUsers,
    changePassword,
    createUser,
    loading,
    hashPassword,
    getAuthHeaders
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
