import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

// Simple hash function for password storage (using Web Crypto API)
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Initialize users storage with default users
const initializeUsers = async () => {
  const users = JSON.parse(localStorage.getItem('app_users') || '[]');

  if (users.length === 0) {
    // Create default users with hashed passwords
    const adminPassword = await hashPassword('temporary123');
    const demoPassword = await hashPassword('vegtelenlove');

    const defaultUsers = [
      {
        id: '1',
        email: 'beliczki.robert@gmail.com',
        password: adminPassword,
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        email: 'demo@messagingmatrix.ai',
        password: demoPassword,
        role: 'demo',
        createdAt: new Date().toISOString()
      }
    ];

    localStorage.setItem('app_users', JSON.stringify(defaultUsers));
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize users on first load
    initializeUsers();

    // Check if user is already logged in
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const users = JSON.parse(localStorage.getItem('app_users') || '[]');
      const user = users.find(u => u.email === email);

      if (!user) {
        throw new Error('Invalid email or password');
      }

      const hashedPassword = await hashPassword(password);
      if (user.password !== hashedPassword) {
        throw new Error('Invalid email or password');
      }

      // Store current user (without password)
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
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
    setCurrentUser(null);
  };

  const getAllUsers = () => {
    const users = JSON.parse(localStorage.getItem('app_users') || '[]');
    // Return users without passwords
    return users.map(({ password, ...user }) => user);
  };

  const changePassword = async (userId, newPassword) => {
    try {
      const users = JSON.parse(localStorage.getItem('app_users') || '[]');
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const hashedPassword = await hashPassword(newPassword);
      users[userIndex].password = hashedPassword;
      users[userIndex].updatedAt = new Date().toISOString();

      localStorage.setItem('app_users', JSON.stringify(users));

      return { success: true };
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
    loading,
    hashPassword
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
