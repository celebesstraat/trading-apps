import { useMemo } from 'react';
import styles from './NewsAlertBanner.module.css';

const NewsAlertBanner = ({ newsItems, onDismiss, onMarkRead, tickerFilter, onClearFilter }) => {
  // Filter and sort news items (show most recent first)
  const visibleItems = useMemo(() => {
    if (!newsItems || newsItems.length === 0) {
      return [];
    }

    // Show only relevant, unread news items, optionally filtered by ticker
    return newsItems
      .filter(item => {
        const isRelevantAndUnread = item.isRelevant && !item.isRead;

        // If no ticker filter, show all relevant news
        if (!tickerFilter) {
          return isRelevantAndUnread;
        }

        // If ticker filter is set, only show news for that ticker
        return isRelevantAndUnread &&
               item.mentionedSymbols &&
               item.mentionedSymbols.includes(tickerFilter);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3); // Show max 3 alerts at once
  }, [newsItems, tickerFilter]);

  if (visibleItems.length === 0) {
    return null;
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleDismiss = (itemId, e) => {
    e.stopPropagation();
    onDismiss(itemId);
  };

  const handleItemClick = (item) => {
    onMarkRead(item.id);
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={styles.newsBanner}>
      <div className={styles.bannerHeader}>
        <span className={styles.bannerIcon}>📰</span>
        <span className={styles.bannerTitle}>
          {tickerFilter ? `${tickerFilter} News` : 'Breaking News'}
        </span>
        <span className={styles.newsCount}>{visibleItems.length}</span>
        {tickerFilter && (
          <button
            className={styles.clearFilterBtn}
            onClick={onClearFilter}
            title="Show all news"
          >
            ✕
          </button>
        )}
      </div>

      <div className={styles.newsList}>
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className={styles.newsItem}
            onClick={() => handleItemClick(item)}
          >
            <div className={styles.newsHeader}>
              <span className={styles.newsSource}>{item.source}</span>
              <span className={styles.newsTime}>{formatTime(item.createdAt)}</span>
              <button
                className={styles.dismissButton}
                onClick={(e) => handleDismiss(item.id, e)}
                title="Dismiss"
              >
                ×
              </button>
            </div>

            <h4 className={styles.newsHeadline}>{item.headline}</h4>

            {item.mentionedSymbols && item.mentionedSymbols.length > 0 && (
              <div className={styles.symbolsList}>
                {item.mentionedSymbols.map(symbol => (
                  <span key={symbol} className={styles.symbolTag}>
                    {symbol}
                  </span>
                ))}
              </div>
            )}

            {item.summary && (
              <p className={styles.newsSummary}>
                {item.summary.length > 150
                  ? `${item.summary.substring(0, 150)}...`
                  : item.summary}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={styles.bannerFooter}>
        <button
          className={styles.dismissAllButton}
          onClick={() => visibleItems.forEach(item => onDismiss(item.id))}
        >
          Dismiss All
        </button>
      </div>
    </div>
  );
};

export default NewsAlertBanner;