
import { useState, useCallback } from 'react';
import { PlannedPayment } from '@/types';

export const useFinanceModals = () => {
    const [paymentModal, setPaymentModal] = useState<{
        isOpen: boolean;
        direction: 'Incoming' | 'Outgoing';
        plan: PlannedPayment | null;
    }>({
        isOpen: false,
        direction: 'Outgoing',
        plan: null,
    });

    const [manualPlanModal, setManualPlanModal] = useState(false);

    const openPaymentModal = useCallback((direction: 'Incoming' | 'Outgoing', plan: PlannedPayment | null = null) => {
        setPaymentModal({
            isOpen: true,
            direction,
            plan,
        });
    }, []);

    const closePaymentModal = useCallback(() => {
        setPaymentModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openManualPlanModal = useCallback(() => setManualPlanModal(true), []);
    const closeManualPlanModal = useCallback(() => setManualPlanModal(false), []);

    return {
        paymentModal,
        openPaymentModal,
        closePaymentModal,
        manualPlanModal,
        openManualPlanModal,
        closeManualPlanModal
    };
};
