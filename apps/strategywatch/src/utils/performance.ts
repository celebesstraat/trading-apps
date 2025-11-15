/**
 * Performance monitoring utilities
 */

interface NavigationMetrics {
  dns: number;
  tcp: number;
  ssl: number;
  ttfb: number;
  download: number;
  domParse: number;
  domReady: number;
  loadComplete: number;
  totalTime: number;
}

interface ResourceMetrics {
  name: string;
  type: string;
  size: number;
  duration: number;
  cached: boolean;
}

interface UserTimingMetrics {
  type: string;
  duration: number;
  startTime: number;
}

interface WebVitals {
  cls?: number;
  lcp?: number;
  fid?: number;
}

interface PerformanceMetrics {
  navigation: NavigationMetrics | null;
  resources: ResourceMetrics[];
  userTiming: UserTimingMetrics[];
  vitals: WebVitals;
}

interface DeviceInfo {
  memory: number;
  cores: number;
  connection: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  } | null;
  isSlow: boolean;
}

/**
 * Performance metrics class for monitoring app performance
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private observers: PerformanceObserver[];
  private isSupported: boolean;

  constructor() {
    this.metrics = {
      navigation: null,
      resources: [],
      userTiming: [],
      vitals: {}
    };
    this.observers = [];
    this.isSupported = this.checkSupport();
  }

  private checkSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'performance' in window &&
      'getEntriesByType' in performance
    );
  }

  /**
   * Initialize performance monitoring
   */
  init(): void {
    if (!this.isSupported) return;

    this.collectNavigationTiming();
    this.collectResourceTiming();
    this.setupObservers();
    this.collectWebVitals();
  }

  /**
   * Collect navigation timing metrics
   */
  private collectNavigationTiming(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.navigation = {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        ssl: navigation.secureConnectionStart > 0 ?
              navigation.connectEnd - navigation.secureConnectionStart : 0,
        ttfb: navigation.responseStart - navigation.requestStart,
        download: navigation.responseEnd - navigation.responseStart,
        domParse: navigation.domContentLoadedEventStart - navigation.responseEnd,
        domReady: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd - navigation.navigationStart
      };
    }
  }

  /**
   * Collect resource timing metrics
   */
  private collectResourceTiming(): void {
    const resources = performance.getEntriesByType('resource');
    this.metrics.resources = resources
      .filter(resource => {
        // Filter out unnecessary resources for cleaner metrics
        return !resource.name.includes('data:') &&
               !resource.name.includes('chrome-extension://');
      })
      .map(resource => ({
        name: resource.name.split('/').pop() || resource.name,
        type: this.getResourceType(resource),
        size: resource.transferSize || 0,
        duration: resource.duration,
        cached: resource.transferSize === 0 && resource.decodedBodySize > 0
      }));
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(resource: PerformanceResourceTiming): string {
    const url = resource.name;
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    return 'other';
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    if (!window.PerformanceObserver) return;

    // Observer for long tasks
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.metrics.userTiming.push({
            type: 'long-task',
            duration: entry.duration,
            startTime: entry.startTime
          });
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch {
      console.warn('Long task observer not supported');
    }

    // Observer for layout shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry) => {
          const layoutShiftEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        });
        this.metrics.vitals.cls = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch {
      console.warn('CLS observer not supported');
    }
  }

  /**
   * Collect Web Vitals
   */
  private collectWebVitals(): void {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      this.metrics.vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const firstInputEntry = entry as any;
        this.metrics.vitals.fid = firstInputEntry.processingStart - firstInputEntry.startTime;
      });
    }).observe({ entryTypes: ['first-input'] });
  }

  /**
   * Get performance metrics summary
   */
  getMetrics(): PerformanceMetrics & { timestamp: number; userAgent: string; url: string } {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  /**
   * Get performance grade
   */
  getGrade(): number {
    const metrics = this.getMetrics();
    let score = 100;

    // Navigation timing penalties
    if (metrics.navigation) {
      if (metrics.navigation.ttfb > 1000) score -= 10;
      if (metrics.navigation.totalTime > 3000) score -= 10;
    }

    // Web Vitals penalties
    if (metrics.vitals.lcp && metrics.vitals.lcp > 2500) score -= 15;
    if (metrics.vitals.fid && metrics.vitals.fid > 100) score -= 15;
    if (metrics.vitals.cls && metrics.vitals.cls > 0.1) score -= 15;

    // Resource loading penalties
    const largeResources = metrics.resources.filter(r => r.size > 500000);
    if (largeResources.length > 0) score -= largeResources.length * 5;

    return Math.max(0, score);
  }

  /**
   * Log performance metrics
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    const grade = this.getGrade();

    console.log('Performance Metrics');
    console.log('Grade:', grade + '/100');
    console.log('Navigation:', metrics.navigation);
    console.log('Web Vitals:', metrics.vitals);
    console.log('Resources:', metrics.resources.length, 'loaded');
    console.log('Large resources:', metrics.resources.filter(r => r.size > 500000).length);

    // Store in sessionStorage for debugging
    try {
      sessionStorage.setItem('performance-metrics', JSON.stringify({
        metrics,
        grade,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not store performance metrics:', e);
    }
  }

  /**
   * Cleanup observers
   */
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

/**
 * Create and initialize performance monitor
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  const monitor = new PerformanceMonitor();

  // Initialize after page load
  if (document.readyState === 'complete') {
    setTimeout(() => {
      monitor.init();
      monitor.logMetrics();
    }, 0);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        monitor.init();
        monitor.logMetrics();
      }, 0);
    });
  }

  return monitor;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout!);
      func(...args);
    };
    clearTimeout(timeout!);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if user is on slow connection
 */
export function isSlowConnection(): boolean {
  if (!navigator.connection) return false;

  const connection = navigator.connection;
  const effectiveType = connection.effectiveType;
  const downlink = connection.downlink;

  return (
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    effectiveType === '3g' ||
    downlink < 1.5
  );
}

/**
 * Get device memory info
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    memory: navigator.deviceMemory || 4,
    cores: navigator.hardwareConcurrency || 4,
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    } : null,
    isSlow: isSlowConnection()
  };
}