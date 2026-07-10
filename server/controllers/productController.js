import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import productsData from '../data/products.js';

// @desc    Fetch all products (with optional simulated data if DB is empty)
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const category = req.query.category;

    // Try to get from database first
    try {
        // Prevent long hanging timeouts if MongoDB is offline
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        let query = {};
        if (category) {
            query.category = category;
        }

        // Check if we are connected, otherwise this throws
        const products = await Product.find(query);
        res.json(products);
    } catch (error) {
        // If DB fails (not connected), we will return the simulated data
        let fallbackData = productsData;
        if (category) {
            fallbackData = fallbackData.filter((p) => p.category === category);
        }
        res.json(fallbackData);
    }
});

// @desc    Fetch single product by slug and category
// @route   GET /api/products/:category/:slug
// @access  Public
const getProductBySlug = asyncHandler(async (req, res) => {
    try {
        // Prevent long hanging timeouts if MongoDB is offline
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        const product = await Product.findOne({
            slug: req.params.slug,
            category: req.params.category
        });

        if (product) {
            res.json(product);
        } else {
            res.status(404);
            throw new Error('Product not found');
        }
    } catch (error) {
        // Fallback to static data
        const fallbackProduct = productsData.find(
            (p) => p.slug === req.params.slug && p.category === req.params.category
        );
        if (fallbackProduct) {
            res.json(fallbackProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    }
});

export { getProducts, getProductBySlug };
