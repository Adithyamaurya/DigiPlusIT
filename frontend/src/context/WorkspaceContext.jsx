import React, { createContext, useContext, useState, useEffect } from 'react';
import { ProjectsAPI, UsersAPI } from '../services/api';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [currentUserId, setCurrentUserIdState] = useState(() => {
    try {
      return localStorage.getItem('worktrace_user_id') || '';
    } catch (e) {
      return '';
    }
  });
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const setCurrentUserId = (id) => {
    setCurrentUserIdState(id);
    try {
      if (id) localStorage.setItem('worktrace_user_id', id);
    } catch (e) {}
  };

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const [projRes, usersRes] = await Promise.all([
        ProjectsAPI.getAll(),
        UsersAPI.getAll(),
      ]);

      if (projRes.success) {
        setProjects(projRes.data);
        if (projRes.data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projRes.data[0].id);
        }
      }

      if (usersRes.success) {
        setUsers(usersRes.data);
        if (usersRes.data.length > 0 && !currentUserId) {
          // Default to Adithya (Project Manager) or first user
          const defaultUser = usersRes.data.find(u => u.name.includes('Adithya')) || usersRes.data[0];
          setCurrentUserId(defaultUser.id);
        }
      }
    } catch (err) {
      console.error('Failed to load workspace context:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  const currentUser = users.find(u => u.id === currentUserId) || users[0] || null;

  return (
    <WorkspaceContext.Provider
      value={{
        projects,
        users,
        selectedProject,
        selectedProjectId,
        setSelectedProjectId,
        currentUser,
        currentUserId,
        setCurrentUserId,
        loading,
        refreshWorkspace: fetchWorkspaceData,
        showNotification,
        notification
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

