import React from 'react';

const KPIBar = ({ title, value, change }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
            <p className="text-3xl font-bold text-white mt-2">{value}</p>
            {change && (
                <span className="text-green-400 text-xs font-medium flex items-center mt-2">
                    {change}
                </span>
            )}
        </div>
    );
};

export default KPIBar;
