import React, { useState, useEffect } from 'react';
import { Product } from '@/types';
import { api } from '@/services/api';

interface Props {
    onClose: () => void;
    onSelect: (products: Product[]) => void;
    onConfigure: (product: Product) => void;
}

export const ProductPicker: React.FC<Props> = ({ onClose, onSelect, onConfigure }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

    useEffect(() => {
        const fetchProducts = async () => {
            const { data } = await ApiService.get('/products');
            setProducts(data);
        };
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSelect = () => {
        onSelect(selectedProducts);
    };

    const toggleProductSelection = (product: Product) => {
        if (selectedProducts.find(p => p.id === product.id)) {
            setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
        } else {
            setSelectedProducts([...selectedProducts, product]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-1/2 h-2/3 flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold">Select Products</h2>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full p-2 border rounded-md mb-4"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left"></th>
                                <th className="text-left">Name</th>
                                <th className="text-left">SKU</th>
                                <th className="text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(product => (
                                <tr key={product.id} className="hover:bg-gray-100">
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={!!selectedProducts.find(p => p.id === product.id)}
                                            onChange={() => toggleProductSelection(product)}
                                        />
                                    </td>
                                    <td>{product.name}</td>
                                    <td>{product.sku}</td>
                                    <td>
                                        <button
                                            onClick={() => onConfigure(product)}
                                            className="text-blue-500 hover:underline"
                                        >
                                            Configure
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200">Cancel</button>
                    <button onClick={handleSelect} className="px-4 py-2 rounded-md bg-blue-500 text-white">Select</button>
                </div>
            </div>
        </div>
    );
}