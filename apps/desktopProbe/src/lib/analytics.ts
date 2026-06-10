export type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnalyticsValue[]
  | { [key: string]: AnalyticsValue };

export type AnalyticsProperties = Record<string, AnalyticsValue>;

export interface IAnalyticsClient {
  /**
   * Track an event.
   */
  trackEvent(event: string, properties?: AnalyticsProperties): void;
}
