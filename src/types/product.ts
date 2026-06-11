export interface Product {
  id: string;
  name: string;
  price: number;
  rating?: number | null;
  image_url?: string | null;
  image?: string | null;
  category?: string | null;
  description?: string | null;
  stock?: number | null;
  slug?: string | null;
  review_count?: number | null;
  reviewCount?: number;
  is_hidden?: boolean | null;
  product_status?: string | null;
  is_featured?: boolean | null;
  seller_id?: string | null;
  created_at?: string | null;
}

export interface ProductReviewSummary {
  product_id: string;
}

