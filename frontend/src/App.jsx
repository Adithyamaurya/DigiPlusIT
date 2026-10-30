import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WorkspaceProvider } from './context/WorkspaceContext';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardLayout from './layouts/DashboardLayout';

import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Meetings from './pages/Meetings';
import MeetingDetails from './pages/MeetingDetails';
import Tasks from './pages/Tasks';
import WorkTransfers from './pages/WorkTransfers';
import WorkTransferDetails from './pages/WorkTransferDetails';
import AICatchup from './pages/AICatchup';
import KnowledgeBase from './pages/KnowledgeBase';
import ContextGraph from './pages/ContextGraph';

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetails />} />
              <Route path="projects/:id/context-graph" element={<ContextGraph />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="meetings/:id" element={<MeetingDetails />} />
              <Route path="work-transfers" element={<WorkTransfers />} />
              <Route path="work-transfers/:id" element={<WorkTransferDetails />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="context-graph" element={<ContextGraph />} />
              <Route path="ai-catchup" element={<AICatchup />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}

