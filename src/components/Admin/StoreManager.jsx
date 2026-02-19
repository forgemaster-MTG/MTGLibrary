import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth to access setGlobalToast
import { Plus, Trash2, Edit2, GripVertical, Check, X, MoveUp, MoveDown } from 'lucide-react';

const StoreManager = () => {
    const { setGlobalToast } = useAuth(); // Use toast from context
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(null); // ID of item being edited, or 'new'

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        image_url: '',
        link_url: '',
        category: 'sealed',
        price_label: '',
        is_active: true
    });

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            const data = await api.getFeaturedProducts(true); // true = admin mode
            setProducts(data);
        } catch (err) {
            console.error(err);
            if (setGlobalToast) setGlobalToast("Failed to load products", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (product) => {
        setFormData({
            title: product.title,
            image_url: product.image_url,
            link_url: product.link_url,
            category: product.category,
            price_label: product.price_label || '',
            is_active: product.is_active
        });
        setIsEditing(product.id);
    };

    const handleAddNew = () => {
        setFormData({
            title: '',
            image_url: '',
            link_url: '',
            category: 'sealed',
            price_label: '',
            is_active: true
        });
        setIsEditing('new');
    };

    const handleCancel = () => {
        setIsEditing(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing === 'new') {
                await api.createFeaturedProduct(formData);
                if (setGlobalToast) setGlobalToast("Product created!", "success");
            } else {
                await api.updateFeaturedProduct(isEditing, formData);
                if (setGlobalToast) setGlobalToast("Product updated!", "success");
            }
            setIsEditing(null);
            loadProducts();
        } catch (err) {
            console.error(err);
            if (setGlobalToast) setGlobalToast("Failed to save product", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this product?")) return;
        try {
            await api.deleteFeaturedProduct(id);
            if (setGlobalToast) setGlobalToast("Product deleted", "success");
            loadProducts();
        } catch (err) {
            console.error(err);
            if (setGlobalToast) setGlobalToast("Failed to delete", "error");
        }
    };

    // Simple reorder helper (swap logic for now, dnd-kit is better but this is simpler for v1)
    const moveItem = async (index, direction) => {
        const newProducts = [...products];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newProducts.length) return;

        // Swap locally
        [newProducts[index], newProducts[targetIndex]] = [newProducts[targetIndex], newProducts[index]];
        setProducts(newProducts);

        // Save order
        const orderIds = newProducts.map(p => p.id);
        try {
            await api.reorderFeaturedProducts(orderIds);
        } catch (err) {
            console.error("Reorder failed", err);
            // reload to reset if fail
            loadProducts();
        }
    };

    if (isLoading) return <div className="text-gray-400 p-8">Loading store data...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Store Manager</h2>
                    <p className="text-gray-400 text-sm">Manage "Latest Releases" products</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Product
                </button>
            </div>

            {/* Editor Modal / Inline Form */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {isEditing === 'new' ? 'New Product' : 'Edit Product'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-1">Title</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-1">Category</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="sealed">Sealed Box</option>
                                        <option value="commander">Commander Deck</option>
                                        <option value="bundle">Bundle</option>
                                        <option value="collector">Collector Booster</option>
                                        <option value="single">Single Card</option>
                                        <option value="accessory">Accessory</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-1">Image URL</label>
                                    <input
                                        type="url"
                                        required
                                        placeholder="https://m.media-amazon.com/..."
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.image_url}
                                        onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-1">Affiliate Link</label>
                                    <input
                                        type="url"
                                        required
                                        placeholder="https://amzn.to/..."
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.link_url}
                                        onChange={e => setFormData({ ...formData, link_url: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-1">Price Label (Opt)</label>
                                    <input
                                        type="text"
                                        placeholder="$149.99"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.price_label}
                                        onChange={e => setFormData({ ...formData, price_label: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-primary-500 focus:ring-primary-500"
                                />
                                <label htmlFor="isActive" className="text-gray-300 text-sm">Visible on Home Page</label>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-gray-400 hover:text-white font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold shadow-lg shadow-primary-900/20"
                                >
                                    Save Product
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid gap-4">
                {products.length === 0 && (
                    <div className="text-center py-12 bg-gray-800/30 rounded-2xl border border-gray-800 text-gray-500">
                        No products found. Add one to get started!
                    </div>
                )}

                {products.map((item, idx) => (
                    <div key={item.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4 group">
                        {/* Drag Handle (Visual only for v1, buttons for logic) */}
                        <div className="text-gray-600">
                            <GripVertical className="w-5 h-5" />
                        </div>

                        {/* Image */}
                        <div className="w-16 h-20 bg-gray-900 rounded-lg flex-shrink-0 overflow-hidden border border-gray-700">
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-bold truncate">{item.title}</h4>
                                {!item.is_active && (
                                    <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-[10px] rounded uppercase font-bold">Hidden</span>
                                )}
                            </div>
                            <p className="text-gray-400 text-xs truncate font-mono">{item.category} • {item.price_label || 'No Price'}</p>
                            <a href={item.link_url} target="_blank" rel="noreferrer" className="text-primary-400 text-xs hover:underline truncate block mt-0.5">
                                {item.link_url}
                            </a>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1 mr-2 border-r border-gray-700 pr-2">
                                <button
                                    onClick={() => moveItem(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                                >
                                    <MoveUp className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => moveItem(idx, 'down')}
                                    disabled={idx === products.length - 1}
                                    className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                                >
                                    <MoveDown className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => handleEdit(item)}
                                className="p-2 bg-gray-700/50 hover:bg-primary-600/20 text-gray-400 hover:text-primary-400 rounded-lg transition-colors"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 bg-gray-700/50 hover:bg-red-900/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StoreManager;
