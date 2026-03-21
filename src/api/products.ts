import axios from 'axios';
import { ProductProps } from '@/components/ProductCard';

// Using vite proxy or relative path if deployed
const API_URL = '/api';

const api = axios.create({
    baseURL: API_URL,
});

export const getProducts = async (category?: string): Promise<ProductProps[]> => {
    const { data } = await api.get('/products', {
        params: { category }
    });
    return data;
};

export const getProductBySlug = async (category: string, slug: string): Promise<ProductProps> => {
    const { data } = await api.get(`/products/${category}/${slug}`);
    return data;
};

export default api;
