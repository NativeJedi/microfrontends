import { API_CLIENT_SERVICE, type Review } from '@mf/api-client';
import type { WidgetMeta, WidgetProps, WidgetSize } from '@mf/contracts';
import { reviewQueries } from '@mf/queries';
import { useService } from '@mf/services';
import { useQuery } from '@tanstack/react-query';
import { useReviewsWidgetTranslation } from '../i18n/use-reviews-widget-translation';
import { readMinRating } from '../settings';
import styles from './Widget.module.css';

// The named half of the widget contract: the dashboard reads it to size the card and to label it when
// it has no translation of its own for this widget's id.
export const meta: WidgetMeta = {
  id: 'reviews',
  title: 'Reviews',
  defaultSize: 'medium',
  minSize: 'small',
};

const MAX_RATING = 5;

function RatingStars({ rating }: { rating: number }) {
  const t = useReviewsWidgetTranslation();

  // The stars are decoration; the accessible name carries the number.
  return (
    <span className={styles.rating} role="img" aria-label={t('rating', { rating })}>
      {'★'.repeat(rating)}
      {'☆'.repeat(MAX_RATING - rating)}
    </span>
  );
}

function ReviewRow({ review, size }: { review: Review; size: WidgetSize }) {
  const t = useReviewsWidgetTranslation();

  return (
    <li>
      <div className={styles.head}>
        <strong>{review.productName}</strong>
        <RatingStars rating={review.rating} />
      </div>
      {/* The narrowest card keeps the product and the rating; the text is the detail. */}
      {size !== 'small' && (
        <>
          <p className={styles.comment}>{review.comment}</p>
          <span className={styles.author}>{t('by', { author: review.author })}</span>
        </>
      )}
    </li>
  );
}

/** Reviews at or above the configured rating, newest first. */
export default function ReviewsWidget({ settings, size }: WidgetProps) {
  const t = useReviewsWidgetTranslation();
  const api = useService(API_CLIENT_SERVICE);
  const minRating = readMinRating(settings);
  const { data: reviews, isPending, error } = useQuery(reviewQueries.list(api));

  if (isPending) return <p>{t('loading')}</p>;
  if (error) return <p>{t('loadError', { message: error.message })}</p>;

  const matching = reviews
    .filter((review) => review.rating >= minRating)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const average =
    matching.reduce((sum, review) => sum + review.rating, 0) / Math.max(matching.length, 1);

  return (
    <div className={styles.card}>
      <p className={styles.subtitle}>
        {t('subtitle', { minRating })}
        {matching.length > 0 && <> · {t('average', { value: average })}</>}
      </p>
      {matching.length === 0 && <p>{t('empty')}</p>}
      <ul className={styles.list}>
        {matching.map((review) => (
          <ReviewRow key={review.id} review={review} size={size} />
        ))}
      </ul>
    </div>
  );
}
