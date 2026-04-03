
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { PreCalculationsListPage } from './pages/PreCalculationsListPage';
import { PreCalculationEditorPage } from './pages/PreCalculationEditorPage';

export const PreCalculationsRouter: React.FC = () => {
    return (
        <Routes>
            <Route index element={<PreCalculationsListPage />} />
            {/* Параметр :id теперь поймает и "new", и конкретные ID */}
            <Route path=":id" element={<PreCalculationEditorPage />} />
        </Routes>
    );
};
