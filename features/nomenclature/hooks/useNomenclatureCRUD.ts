
import { useState } from 'react';
import { Product, ProductType, Currency } from '@/types';
import { useStore } from '@/features/system/context/GlobalStore';

export const useNomenclatureCRUD = (selectedType: ProductType) => {
    const { actions } = useStore();

    const [confirmDelete, setConfirmDelete] = useState<{ show: boolean, id: string, name: string }>({ show: false, id: '', name: '' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [modalInitialData, setModalInitialData] = useState<Partial<Product>>({});
    const [isCopy, setIsCopy] = useState(false);

    const handleAdd = () => {
        setModalMode('create');
        setIsCopy(false);
        setModalInitialData({ type: selectedType, currency: Currency.CNY, markupPercentage: 80 });
        setIsModalOpen(true);
    };

    const handleEdit = (product: Product) => {
        setModalMode('edit');
        setIsCopy(false);
        setModalInitialData(product);
        setIsModalOpen(true);
    };

    const handleCopy = (product: Product) => {
        const { id, ...rest } = product;
        setModalMode('create');
        setIsCopy(true);
        setModalInitialData({
            ...rest,
            sku: `${rest.sku}_copy`,
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string, name: string) => {
        setConfirmDelete({ show: true, id, name });
    };

    const confirmDeleteAction = () => {
        if (confirmDelete.id) {
            actions.deleteProduct(confirmDelete.id);
            setConfirmDelete({ show: false, id: '', name: '' });
        }
    };

    const cancelDelete = () => {
        setConfirmDelete({ show: false, id: '', name: '' });
    }

    const onSave = async (product: Product) => {
        if (modalMode === 'create') {
            await actions.addProduct(product);
        } else {
            await actions.updateProduct(product);
        }
        setIsModalOpen(false);
        setIsCopy(false);
    };

    return {
        confirmDelete,
        isModalOpen,
        modalMode,
        modalInitialData,
        isCopy,
        setIsModalOpen,
        handleAdd,
        handleEdit,
        handleCopy,
        handleDelete,
        confirmDeleteAction,
        cancelDelete,
        onSave,
    };
};
