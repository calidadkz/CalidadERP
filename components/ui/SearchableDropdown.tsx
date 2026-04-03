
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SearchableDropdownProps<T> {
    options: T[];
    value: string; // The ID of the selected item
    onChange: (value: string) => void;
    placeholder?: string;
    displayKey: keyof T; // Key to display in the list and input
    valueKey: keyof T;   // Key to use as the actual value (e.g., 'id')
    disabled?: boolean;
    className?: string;
}

export const SearchableDropdown = <T extends Record<string, any>>({
    options,
    value,
    onChange,
    placeholder,
    displayKey,
    valueKey,
    disabled = false,
    className
}: SearchableDropdownProps<T>) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => {
        return options.find(option => String(option[valueKey]) === String(value));
    }, [options, value, valueKey]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) {
            return options;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return options.filter(option =>
            String(option[displayKey]).toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [options, searchTerm, displayKey]);

    useEffect(() => {
        if (selectedOption) {
            setSearchTerm(String(selectedOption[displayKey]));
        } else if (!isOpen) {
            setSearchTerm(''); // Clear search if no option selected and dropdown is closed
        }
    }, [selectedOption, isOpen, displayKey]);

    const handleSelect = useCallback((option: T) => {
        onChange(String(option[valueKey]));
        setSearchTerm(String(option[displayKey]));
        setIsOpen(false);
    }, [onChange, displayKey, valueKey]);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
            // If nothing is selected, clear search term when clicking outside
            if (!selectedOption) {
                setSearchTerm('');
            } else {
                setSearchTerm(String(selectedOption[displayKey]));
            }
        }
    }, [selectedOption, displayKey]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        onChange(''); // Clear selected value if user starts typing
    }, [onChange]);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleClickOutside]);

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <div className={`flex items-center border border-slate-200 p-2 rounded-xl bg-white text-xs outline-none focus-within:ring-4 focus-within:ring-blue-500/10 ${disabled ? 'opacity-70 bg-slate-100' : ''}`}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="flex-1 bg-transparent border-none outline-none text-slate-700 font-bold"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    disabled={disabled}
                    className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option, index) => (
                            <div
                                key={String(option[valueKey])}
                                className={`px-4 py-2 cursor-pointer text-sm hover:bg-blue-50 hover:text-blue-700 ${String(option[valueKey]) === String(value) ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-700'}`}
                                onClick={() => handleSelect(option)}
                            >
                                {String(option[displayKey])}
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-2 text-sm text-slate-500">Нет совпадений</div>
                    )}
                </div>
            )}
        </div>
    );
};
