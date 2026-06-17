-- Grevya Naturals - 48 Product Demo Seed Script
-- Balanced across 8 categories (6 products each)
-- Targets: Personal Care, Natural Products, Home & Living, Areca Products, Wellness, Organic Essentials, Kitchen & Dining, Eco Lifestyle

BEGIN;

-- 1. Clean up existing reviews and products to prevent category pollution and foreign key conflicts
DELETE FROM public.reviews;
DELETE FROM public.products;

-- 2. Insert new products
INSERT INTO public.products (old_id, name, description, price, stock, category, image_url) VALUES

-- Category: Personal Care (6 products)
(101, 'Natural Henna Hair Color', 'Premium triple-sifted organic henna powder for safe, natural conditioning and vibrant copper-red tones.', 180, 150, 'Personal Care', '/uploads/b8cea23a-793d-4469-bd56-599945a69d64.png'),
(102, 'Ayurvedic Hair Repair Oil', 'Traditional cold-pressed hair oil infused with Bhringraj, Amla, and Coconut oil to deeply nourish roots.', 349, 80, 'Personal Care', 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?q=80&w=600&auto=format&fit=crop'),
(103, 'Herbal Neem Face Cleanser', 'Purifying daily face wash formulated with fresh organic neem extracts and soothing tea tree oil.', 240, 120, 'Personal Care', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=600&auto=format&fit=crop'),
(104, 'Charcoal Detox Soap Bar', 'Handcrafted organic soap with activated charcoal and peppermint oil for deep pore cleansing.', 140, 200, 'Personal Care', 'https://images.unsplash.com/photo-1607006342411-985f1c93a9ab?q=80&w=600&auto=format&fit=crop'),
(105, 'Sandalwood Brightening Scrub', 'Rich exfoliating body scrub blended with premium Mysore sandalwood powder and walnut shell grits.', 399, 65, 'Personal Care', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?q=80&w=600&auto=format&fit=crop'),
(106, 'Aloe Vera Soothing Gel', '100% pure cold-extracted aloe vera gel for intense skin hydration, sun relief, and hair care.', 199, 175, 'Personal Care', 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?q=80&w=600&auto=format&fit=crop'),

-- Category: Natural Products (6 products)
(201, 'Cold Pressed Coconut Oil', '100% pure organic virgin wood-pressed coconut oil, perfect for cooking, skin, and hair care.', 299, 130, 'Natural Products', '/uploads/03b491e4-3d4f-4ed1-b373-8e7d395bfb2d.png'),
(202, 'Natural Tomato Powder Extract', 'Spray-dried natural tomato powder containing rich lycopene nutrients, ideal for culinary creations.', 189, 95, 'Natural Products', '/uploads/d0ea75c6-efb1-4f41-97e2-65eebeba250a.png'),
(203, 'Pure Indigo Powder Dye', 'All-natural chemical-free indigo leaf powder, perfect for achieving rich, natural black hair shades.', 220, 110, 'Natural Products', '/uploads/d6f6a406-5939-4183-8e6f-fb5d94c99224.png'),
(204, 'Organic Moringa Leaf Powder', 'Nutrient-dense dried moringa leaf superfood powder sourced from smallholder sustainable farms.', 279, 150, 'Natural Products', 'https://images.unsplash.com/photo-1622484211148-71626f212bc0?q=80&w=600&auto=format&fit=crop'),
(205, 'Wood Pressed Sesame Oil', 'Traditional cold-pressed sesame oil extracted from premium seeds, rich in natural antioxidants.', 320, 85, 'Natural Products', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=600&auto=format&fit=crop'),
(206, 'Pure Rose Water Mist', 'Double-distilled Kannauj rose water face mist, providing instant skin rejuvenation and balance.', 160, 140, 'Natural Products', 'https://images.unsplash.com/photo-1601049676099-e7ed07d825b0?q=80&w=600&auto=format&fit=crop'),

-- Category: Home & Living (6 products)
(301, 'Handwoven Seagrass Storage Basket', 'Durable, eco-friendly seagrass storage basket with convenient woven handles for home organization.', 499, 50, 'Home & Living', 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop'),
(302, 'Jute Braided Area Rug', '100% natural braided jute floor rug, handcrafted by rural artisans to add organic warmth to any room.', 899, 30, 'Home & Living', 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop'),
(303, 'Organic Soy Wax Amber Candle', 'Soothing hand-poured soy candle with a natural wood wick, scented with pure French lavender oil.', 299, 110, 'Home & Living', 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=600&auto=format&fit=crop'),
(304, 'Cotton Macrame Wall Hanging', 'Bohemian-style cotton wall art, carefully hand-tied on a natural forest branch.', 699, 25, 'Home & Living', 'https://images.unsplash.com/photo-1528114039593-4366cc08227d?q=80&w=600&auto=format&fit=crop'),
(305, 'Linen Decorative Cushion Cover', 'Breathable, premium flax linen pillow case colored with 100% organic plant dyes.', 349, 90, 'Home & Living', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?q=80&w=600&auto=format&fit=crop'),
(306, 'Natural Vetiver Room Spray', 'Aromatic vetiver root extract spray, offering a woody, calming scent to purify home air.', 249, 95, 'Home & Living', 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?q=80&w=600&auto=format&fit=crop'),

-- Category: Areca Products (6 products)
(401, 'Areca Palm Leaf Dinner Plates', 'Pack of 20 compostable 10-inch round dinner plates, molded from naturally fallen Areca leaves.', 299, 350, 'Areca Products', '/uploads/32aca9e1-3dd5-4383-9731-9aee4339ee08.png'),
(402, 'Areca Palm Leaf Soup Bowls', 'Pack of 25 biodegradable 6-inch round bowls, perfect for warm soups, side dishes, and desserts.', 199, 280, 'Areca Products', 'https://images.unsplash.com/photo-1591287038993-67d5d193b115?q=80&w=600&auto=format&fit=crop'),
(403, 'Areca Palm Leaf Square Platters', 'Pack of 20 elegant 8-inch square dessert and appetizer plates, ideal for premium eco-catering.', 249, 240, 'Areca Products', 'https://images.unsplash.com/photo-1591287038993-67d5d193b115?q=80&w=600&auto=format&fit=crop'),
(404, 'Areca Palm Leaf Compartment Trays', 'Pack of 15 strong 3-compartment leaf lunch plates, rigid and cut-resistant for heavy meals.', 349, 180, 'Areca Products', 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?q=80&w=600&auto=format&fit=crop'),
(405, 'Areca Palm Leaf Dessert Bowls', 'Pack of 30 leaf-shaped mini bowls for puddings, dipping sauces, and small treats.', 179, 320, 'Areca Products', 'https://images.unsplash.com/photo-1591287038993-67d5d193b115?q=80&w=600&auto=format&fit=crop'),
(406, 'Areca Palm Leaf Hexagonal Plates', 'Pack of 20 modern geometric hexagonal salad plates, adding a designer touch to eco-friendly hosting.', 279, 160, 'Areca Products', 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?q=80&w=600&auto=format&fit=crop'),

-- Category: Wellness (6 products)
(501, 'Ashwagandha Root Capsules', 'Organic adaptogenic herbal capsules designed to natural support stress relief and daily energy.', 499, 140, 'Wellness', 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?q=80&w=600&auto=format&fit=crop'),
(502, 'Tulsi Holy Basil Tea Blend', 'Immune-boosting loose leaf tea blend formulated with dried green and purple Tulsi leaves.', 249, 180, 'Wellness', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=600&auto=format&fit=crop'),
(503, 'Lavender Essential Oil', '100% therapeutic grade pure lavender oil, distilled for aromatherapy, massage, and sleep support.', 349, 120, 'Wellness', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=600&auto=format&fit=crop'),
(504, 'Eucalyptus Essential Oil', 'Clarifying organic eucalyptus oil, ideal for refreshing steam inhalations and room diffusion.', 329, 90, 'Wellness', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=600&auto=format&fit=crop'),
(505, 'Organic Triphala Powder', 'Traditional ayurvedic formulation of three fruits to promote gentle, natural colon health.', 199, 160, 'Wellness', 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=600&auto=format&fit=crop'),
(506, 'Himalayan Pink Salt Coarse', 'Pure mineral-rich pink salt crystals, perfect for a soothing bath and complete body detox.', 160, 250, 'Wellness', 'https://images.unsplash.com/photo-1513785496906-df5514c3d2e5?q=80&w=600&auto=format&fit=crop'),

-- Category: Organic Essentials (6 products)
(601, 'Organic Turmeric Powder', 'High-curcumin heirloom turmeric powder, stone-ground for rich taste and immune benefits.', 150, 300, 'Organic Essentials', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=600&auto=format&fit=crop'),
(602, 'Raw Forest Honey', 'Unfiltered wild forest honey harvested ethically from remote organic reserve belts.', 450, 110, 'Organic Essentials', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=600&auto=format&fit=crop'),
(603, 'Organic Ceylon Cinnamon', 'Sweet and fragrant Ceylon cinnamon powder, sourced ethically from sustainable forest farms.', 280, 140, 'Organic Essentials', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop'),
(604, 'Organic Chia Seeds', 'Fiber-rich organic black chia seeds, perfect for nutritious energy-boosting breakfast bowls.', 240, 170, 'Organic Essentials', 'https://images.unsplash.com/photo-1501625294095-f6e7ebca8735?q=80&w=600&auto=format&fit=crop'),
(605, 'Organic Brown Flaxseeds', 'Rich in Omega-3 fatty acids, premium brown flaxseeds for baking and smoothies.', 130, 210, 'Organic Essentials', 'https://images.unsplash.com/photo-1595855759920-86582396756a?q=80&w=600&auto=format&fit=crop'),
(606, 'Organic Green Cardamom', 'Sun-dried aromatic whole green cardamom pods, packed with warm traditional flavor.', 390, 95, 'Organic Essentials', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop'),

-- Category: Kitchen & Dining (6 products)
(701, 'Neem Wood Spatula Set', 'Pack of 4 hand-carved non-stick friendly wooden spoons, made from anti-bacterial neem wood.', 349, 130, 'Kitchen & Dining', 'https://images.unsplash.com/photo-1531234799389-d8793a28f317?q=80&w=600&auto=format&fit=crop'),
(702, 'Pure Hammered Copper Bottle', 'Jointless copper water bottle, designed to alkalize water and promote positive health benefits.', 699, 95, 'Kitchen & Dining', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?q=80&w=600&auto=format&fit=crop'),
(703, 'Cotton Linen Table Napkins', 'Set of 6 washable, reusable napkins woven from premium organic cotton and flax linen.', 299, 120, 'Kitchen & Dining', 'https://images.unsplash.com/photo-1603006905393-0d6118d363b9?q=80&w=600&auto=format&fit=crop'),
(704, 'Coconut Shell Bowls (Set of 2)', 'Polished natural coconut shells with organic coconut oil finish, ideal for serving dry snacks.', 249, 160, 'Kitchen & Dining', 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?q=80&w=600&auto=format&fit=crop'),
(705, 'Terracotta Clay Water Carafe', 'Handmade clay water carafe that naturally cools water through evaporation while enhancing taste.', 399, 50, 'Kitchen & Dining', 'https://images.unsplash.com/photo-1610450949065-2f275e5339f4?q=80&w=600&auto=format&fit=crop'),
(706, 'Handcrafted Brass Thali Set', 'Traditional high-quality brass serving plate with matching side bowls for traditional Indian dining.', 1199, 40, 'Kitchen & Dining', 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?q=80&w=600&auto=format&fit=crop'),

-- Category: Eco Lifestyle (6 products)
(801, 'Bamboo Toothbrush (Pack of 4)', '100% biodegradable soft charcoal-infused bamboo toothbrushes for clean, natural dental care.', 199, 350, 'Eco Lifestyle', 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=600&auto=format&fit=crop'),
(802, 'Organic Cotton Canvas Tote', 'Extra-spacious, double-stitched cotton tote bag with long handles for daily shopping.', 249, 220, 'Eco Lifestyle', 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop'),
(803, 'Bamboo Drinking Straws', 'Pack of 10 reusable straws crafted from natural bamboo, complete with a sisal cleaning brush.', 149, 180, 'Eco Lifestyle', 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?q=80&w=600&auto=format&fit=crop'),
(804, 'Sisal Loofah Body Scrubber', 'Biodegradable vegetable fiber loofah sponge, perfect for daily exfoliation and skin circulation.', 129, 240, 'Eco Lifestyle', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=600&auto=format&fit=crop'),
(805, 'Neem Wood Pocket Comb', 'Anti-static comb crafted from premium neem wood, preventing hair breakage and dandruff.', 119, 160, 'Eco Lifestyle', 'https://images.unsplash.com/photo-1590156546746-c58a8a4a7a22?q=80&w=600&auto=format&fit=crop'),
(806, 'Biodegradable Trash Bags', 'Pack of 30 leak-proof, fully compostable waste bags made from cornstarch materials.', 189, 300, 'Eco Lifestyle', 'https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600&auto=format&fit=crop');

-- 3. Add default reviews to showcase products and verify review displays
INSERT INTO public.reviews (product_id, rating, comment, user_id) 
SELECT id, 5, 'Absolutely love this product! High quality and very eco-friendly.', NULL 
FROM public.products 
WHERE old_id IN (101, 201, 301, 401, 501, 601, 701, 801);

INSERT INTO public.reviews (product_id, rating, comment, user_id) 
SELECT id, 4, 'Very good quality, highly recommended for natural lifestyle.', NULL 
FROM public.products 
WHERE old_id IN (102, 202, 302, 402, 502, 602, 702, 802);

COMMIT;
