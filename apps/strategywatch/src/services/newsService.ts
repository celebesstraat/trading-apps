import { NewsItem } from '../types/types';

// Simple real-time news service using Alpaca WebSocket API
export class NewsService {
  private apiKey: string;
  private secretKey: string;
  private onNewsUpdate: (newsItem: NewsItem) => void;
  private ws: WebSocket | null;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private isConnected: boolean;
  private heartbeatInterval: NodeJS.Timeout | null;
  private intentionalDisconnect: boolean;

  constructor(apiKey: string, secretKey: string, onNewsUpdate: (newsItem: NewsItem) => void) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.onNewsUpdate = onNewsUpdate;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.isConnected = false;
    this.heartbeatInterval = null;
    this.intentionalDisconnect = false; // Track if disconnect was intentional
  }

  connect() {
    try {
      console.log('📰 Connecting to Alpaca news WebSocket...');

      // Reset intentional disconnect flag for new connection
      this.intentionalDisconnect = false;

      // Alpaca news WebSocket endpoint
      const wsUrl = 'wss://stream.data.alpaca.markets/v1beta1/news';

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ News WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Authenticate with Alpaca
        this.authenticate();

        // Start heartbeat to keep connection alive
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // Handle authentication response
          if (data[0]?.T === 'success' && data[0]?.msg === 'authenticated') {
            console.log('🔐 News WebSocket authenticated');
            this.subscribeToNews();
            return;
          }

          // Handle news updates
          if (data[0]?.T === 'n') {
            const newsItem = this.parseNewsItem(data[0]);
            if (newsItem) {
              this.onNewsUpdate(newsItem);
            }
          }
        } catch (error) {
          console.error('Error parsing news message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('❌ News WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();

        // Only attempt to reconnect if the disconnect was NOT intentional
        if (!this.intentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting to news WebSocket (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), this.reconnectDelay);
        } else if (this.intentionalDisconnect) {
          console.log('📰 News WebSocket closed intentionally (no reconnect)');
        } else {
          console.error('❌ Max reconnection attempts reached for news WebSocket');
        }
      };

      this.ws.onerror = (error) => {
        console.error('News WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect to news WebSocket:', error);
    }
  }

  authenticate() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const authMessage = {
        action: 'auth',
        key: this.apiKey,
        secret: this.secretKey
      };
      this.ws.send(JSON.stringify(authMessage));
    }
  }

  subscribeToNews() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Subscribe to all news (we'll filter on the client side)
      const subscribeMessage = {
        action: 'subscribe',
        news: ['*']
      };
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log('📰 Subscribed to news stream');
    }
  }

  parseNewsItem(data: any): NewsItem | null {
    try {
      // Filtering happens in DataContext callback - no need to log all items
      const parsedItem = {
        id: data.id,
        headline: data.headline,
        summary: data.summary,
        author: data.author,
        source: data.source,
        url: data.url,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        symbols: data.symbols || [],
        // We'll determine relevance in the filtering step
        relevanceScore: 0
      };
      return parsedItem;
    } catch (error) {
      console.error('Error parsing news item:', error);
      return null;
    }
  }

  filterNewsForWatchlist(newsItem: NewsItem, watchlistSymbols: string[]): (NewsItem & { isRelevant: boolean; mentionedSymbols: string[] }) | null {
    if (!watchlistSymbols || watchlistSymbols.length === 0) {
      return null;
    }

    // Check if any watchlist symbols are mentioned in the news
    const mentionedSymbols = newsItem.symbols.filter(symbol =>
      watchlistSymbols.includes(symbol)
    );

    if (mentionedSymbols.length === 0) {
      return null;
    }

    // Calculate relevance score based on how many watchlist symbols are mentioned
    const relevanceScore = mentionedSymbols.length / watchlistSymbols.length;

    return {
      ...newsItem,
      relevanceScore,
      mentionedSymbols,
      isRelevant: true
    };
  }

  startHeartbeat() {
    // Send a ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    // Mark as intentional disconnect to prevent reconnection attempts
    this.intentionalDisconnect = true;
    this.isConnected = false;
    this.stopHeartbeat();

    if (this.ws) {
      // Check if WebSocket is still connecting to avoid "closed before connection" error
      // This commonly happens in React StrictMode development
      if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    console.log('📰 News WebSocket disconnected');
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Factory function to create news service
export const createNewsService = (apiKey: string, secretKey: string, onNewsUpdate: (newsItem: NewsItem) => void): NewsService => {
  return new NewsService(apiKey, secretKey, onNewsUpdate);
};