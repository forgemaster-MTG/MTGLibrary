import React from 'react';

const PageHeader = ({ title, subtitle, icon: Icon, actions }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
                {Icon && (
                    <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400 border border-primary-500/20">
                        <Icon size={32} />
                    </div>
                )}
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-gray-400 mt-1 text-sm font-medium">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
