
import React from 'react';

interface InputFieldProps {
    label: string;
    value: string | number;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
    helpText?: string;
    suffix?: string;
}

export const InputField: React.FC<InputFieldProps> = ({ 
    label, 
    value, 
    onChange, 
    helpText, 
    type = 'text', 
    placeholder = '', 
    suffix = '' 
}) => (
    <div className="flex flex-col">
        <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${suffix ? 'pr-10' : ''}`}
            />
            {suffix && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                    {suffix}
                </span>
            )}
        </div>
        {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
);
