export interface ReviewRatingRow {
  product_id: number;
  rating: number;
}

export interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

/**
 * Builds per-product review statistics from a single batched reviews query.
 * Averages are rounded to one decimal place, matching ProductDetail.
 */
export const getReviewStatsByProductId = (reviews: ReviewRatingRow[]) => {
  const totals = new Map<number, { ratingTotal: number; reviewCount: number }>();

  for (const review of reviews) {
    const current = totals.get(review.product_id) ?? { ratingTotal: 0, reviewCount: 0 };
    current.ratingTotal += Number(review.rating);
    current.reviewCount += 1;
    totals.set(review.product_id, current);
  }

  return new Map<number, ReviewStats>(
    Array.from(totals, ([productId, { ratingTotal, reviewCount }]) => [
      productId,
      {
        averageRating: Math.round((ratingTotal / reviewCount) * 10) / 10,
        reviewCount,
      },
    ]),
  );
};
