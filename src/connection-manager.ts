/**
 * Connection Manager for DingTalk Stream Client
 *
 * Provides robust connection lifecycle management with:
 * - Exponential backoff with jitter for reconnection attempts
 * - Configurable max attempts and delay parameters
 * - Connection state tracking and event handling
 * - Proper cleanup of timers and resources
 * - Structured logging for all connection events
 */

import type { DWClient } from 'dingtalk-stream';
import type { ConnectionState, ConnectionManagerConfig, ConnectionAttemptResult, Logger } from './types';
import { ConnectionState as ConnectionStateEnum } from './types';

/**
 * ConnectionManager handles the robust connection lifecycle for DWClient
 */
export class ConnectionManager {
  private config: ConnectionManagerConfig;
  private log?: Logger;
  private accountId: string;

  // Connection state tracking
  private state: ConnectionState = ConnectionStateEnum.DISCONNECTED;
  private attemptCount: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private stopped: boolean = false;

  // Runtime monitoring resources
  private healthCheckInterval?: NodeJS.Timeout;
  private stormResetTimer?: NodeJS.Timeout;
  private socketCloseHandler?: (code: number, reason: string) => void;
  private socketErrorHandler?: (error: Error) => void;
  private monitoredSocket?: any; // Store the socket instance we attached listeners to

  // Sleep abort control
  private sleepTimeout?: NodeJS.Timeout;
  private sleepResolve?: () => void;

  // Reconnect-storm detection: track recent connection lifetimes to detect
  // rapid disconnect cycles (e.g. server-side rate limiting) and escalate
  // the backoff delay to minute-scale cooldowns.
  private static readonly STORM_WINDOW = 3; // consecutive short-lived connections to trigger
  private static readonly SHORT_LIVED_MS = 30_000; // < 30 s counts as "short"
  private static readonly COOLDOWN_DELAYS_MS = [30_000, 60_000, 120_000]; // escalating cooldown
  private recentLifetimes: number[] = [];
  private lastConnectedAt: number = 0;
  private consecutiveStormCycles: number = 0;

  // Client reference
  private client: DWClient;

  constructor(client: DWClient, accountId: string, config: ConnectionManagerConfig, log?: Logger) {
    this.client = client;
    this.accountId = accountId;
    this.config = config;
    this.log = log;
  }

  private notifyStateChange(error?: string): void {
    if (this.config.onStateChange) {
      this.config.onStateChange(this.state, error);
    }
  }

  // ── Reconnect-storm helpers ────────────────────────────────────

  /** Record that a connection was successfully established. */
  private markConnected(): void {
    this.lastConnectedAt = Date.now();
  }

  /**
   * Record a disconnection, evaluate whether we are in a reconnect storm,
   * and return a cooldown delay (ms) if the storm threshold is reached.
   * Returns 0 when no cooldown is needed.
   */
  private markDisconnectedAndEvaluateStorm(): number {
    if (this.lastConnectedAt === 0) return 0;

    const lifetime = Date.now() - this.lastConnectedAt;
    this.lastConnectedAt = 0;

    // Keep only the most recent STORM_WINDOW entries
    this.recentLifetimes.push(lifetime);
    if (this.recentLifetimes.length > ConnectionManager.STORM_WINDOW) {
      this.recentLifetimes.shift();
    }

    // Need at least STORM_WINDOW samples to judge
    if (this.recentLifetimes.length < ConnectionManager.STORM_WINDOW) return 0;

    const allShort = this.recentLifetimes.every((lt) => lt < ConnectionManager.SHORT_LIVED_MS);
    if (!allShort) {
      // At least one recent connection lived long enough – no storm.
      this.consecutiveStormCycles = 0;
      return 0;
    }

    // Storm detected – pick an escalating cooldown delay
    const idx = Math.min(this.consecutiveStormCycles, ConnectionManager.COOLDOWN_DELAYS_MS.length - 1);
    const cooldown = ConnectionManager.COOLDOWN_DELAYS_MS[idx];
    this.consecutiveStormCycles++;

    const avgLifetime = (this.recentLifetimes.reduce((a, b) => a + b, 0) / this.recentLifetimes.length / 1000).toFixed(1);
    this.log?.warn?.(
      `[${this.accountId}] Reconnect storm detected: last ${ConnectionManager.STORM_WINDOW} connections ` +
        `averaged ${avgLifetime}s (< ${ConnectionManager.SHORT_LIVED_MS / 1000}s threshold). ` +
        `Cooling down for ${cooldown / 1000}s before next attempt.`,
    );
    return cooldown;
  }

  /** Reset storm tracking after a connection proves stable. */
  private resetStormTracking(): void {
    this.recentLifetimes = [];
    this.consecutiveStormCycles = 0;
  }

  // ── Backoff ───────────────────────────────────────────────────

  /**
   * Calculate next reconnection delay with exponential backoff and jitter
   * Formula: delay = min(initialDelay * 2^attempt, maxDelay) * (1 ± jitter)
   * @param attempt Zero-based attempt number (0 for first retry, 1 for second, etc.)
   */
  private calculateNextDelay(attempt: number): number {
    const { initialDelay, maxDelay, jitter } = this.config;

    // Exponential backoff: initialDelay * 2^attempt
    // For attempt=0 (first retry), this gives initialDelay * 1 = initialDelay
    const exponentialDelay = initialDelay * Math.pow(2, attempt);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Apply jitter: randomize ± jitter%
    const jitterAmount = cappedDelay * jitter;
    const randomJitter = (Math.random() * 2 - 1) * jitterAmount;
    const finalDelay = Math.max(100, cappedDelay + randomJitter); // Minimum 100ms

    return Math.floor(finalDelay);
  }

  /**
   * Clear DWClient's internal heartbeat interval to prevent a race condition
   * where the old timer fires ping() on a new socket still in CONNECTING state.
   * Also disconnects the old socket cleanly so no stale listeners remain.
   */
  private clearClientInternals(): void {
    const client = this.client as any;
    if (client.heartbeatIntervallId !== undefined) {
      clearInterval(client.heartbeatIntervallId);
      client.heartbeatIntervallId = undefined;
      this.log?.debug?.(`[${this.accountId}] Cleared DWClient heartbeat interval`);
    }
    if (client.socket) {
      try {
        client.socket.removeAllListeners();
        client.socket.terminate();
      } catch {}
      client.socket = undefined;
    }
  }

  /**
   * Attempt to connect with retry logic
   */
  private async attemptConnection(): Promise<ConnectionAttemptResult> {
    if (this.stopped) {
      return { success: false, attempt: this.attemptCount, error: new Error('Connection manager stopped') };
    }

    this.attemptCount++;
    this.state = ConnectionStateEnum.CONNECTING;
    this.notifyStateChange();

    this.log?.info?.(`[${this.accountId}] Connection attempt ${this.attemptCount}/${this.config.maxAttempts}...`);

    try {
      // Clear stale heartbeat timer & socket from the previous connection
      // before creating a new one, preventing the ping-on-CONNECTING race.
      this.clearClientInternals();

      // Call DWClient connect method
      await this.client.connect();

      // Re-check stopped flag after async connect() completes
      // This prevents race condition where stop() is called during connection
      if (this.stopped) {
        this.log?.warn?.(
          `[${this.accountId}] Connection succeeded but manager was stopped during connect - disconnecting`
        );
        try {
          this.client.disconnect();
        } catch (disconnectErr: any) {
          this.log?.debug?.(`[${this.accountId}] Error during post-connect disconnect: ${disconnectErr.message}`);
        }
        return {
          success: false,
          attempt: this.attemptCount,
          error: new Error('Connection manager stopped during connect'),
        };
      }

      // Connection successful
      this.state = ConnectionStateEnum.CONNECTED;
      this.notifyStateChange();
      const successfulAttempt = this.attemptCount;
      this.attemptCount = 0; // Reset counter on success
      this.markConnected();

      this.log?.info?.(`[${this.accountId}] DingTalk Stream client connected successfully`);

      return { success: true, attempt: successfulAttempt };
    } catch (err: any) {
      this.log?.error?.(`[${this.accountId}] Connection attempt ${this.attemptCount} failed: ${err.message}`);

      // Check if we've exceeded max attempts
      if (this.attemptCount >= this.config.maxAttempts) {
        this.state = ConnectionStateEnum.FAILED;
        this.notifyStateChange('Max connection attempts reached');
        this.log?.error?.(
          `[${this.accountId}] Max connection attempts (${this.config.maxAttempts}) reached. Giving up.`
        );
        return { success: false, attempt: this.attemptCount, error: err };
      }

      // Calculate next retry delay (use attemptCount-1 for zero-based exponent)
      // This ensures first retry uses 2^0 = 1x initialDelay
      const nextDelay = this.calculateNextDelay(this.attemptCount - 1);

      this.log?.warn?.(
        `[${this.accountId}] Will retry connection in ${(nextDelay / 1000).toFixed(2)}s (attempt ${this.attemptCount + 1}/${this.config.maxAttempts})`
      );

      return { success: false, attempt: this.attemptCount, error: err, nextDelay };
    }
  }

  /**
   * Connect with robust retry logic
   */
  public async connect(): Promise<void> {
    if (this.stopped) {
      throw new Error('Cannot connect: connection manager is stopped');
    }

    // Clear any existing reconnect timer
    this.clearReconnectTimer();

    this.log?.info?.(`[${this.accountId}] Starting DingTalk Stream client with robust connection...`);

    // Keep trying until success or max attempts reached
    while (!this.stopped && this.state !== ConnectionStateEnum.CONNECTED) {
      const result = await this.attemptConnection();

      if (result.success) {
        // Connection successful
        this.setupRuntimeReconnection();
        return;
      }

      // Check if connection was stopped during connect
      if (result.error?.message === 'Connection manager stopped during connect') {
        this.log?.info?.(`[${this.accountId}] Connection cancelled: manager stopped during connect`);
        throw new Error('Connection cancelled: connection manager stopped');
      }

      if (!result.nextDelay || this.attemptCount >= this.config.maxAttempts) {
        // No more retries
        throw new Error(`Failed to connect after ${this.attemptCount} attempts`);
      }

      // Wait before next attempt
      await this.sleep(result.nextDelay);
    }
  }

  /**
   * Setup runtime reconnection handlers
   * Monitors DWClient connection state for automatic reconnection
   */
  private setupRuntimeReconnection(): void {
    this.log?.debug?.(`[${this.accountId}] Setting up runtime reconnection monitoring`);

    // Clean up any existing monitoring resources before setting up new ones
    this.cleanupRuntimeMonitoring();

    // Access DWClient internals to monitor connection state
    const client = this.client as any;

    // Monitor client's 'connected' property changes
    // We'll set up an interval to periodically check connection health
    this.healthCheckInterval = setInterval(() => {
      if (this.stopped) {
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
        }
        return;
      }

      // If we believe we're connected but DWClient disagrees, trigger reconnection
      if (this.state === ConnectionStateEnum.CONNECTED && !client.connected) {
        this.log?.warn?.(`[${this.accountId}] Connection health check failed - detected disconnection`);
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
        }
        this.handleRuntimeDisconnection();
      }
    }, 5000); // Check every 5 seconds

    // Once the connection survives past the short-lived threshold, reset
    // storm tracking so future disconnects start with a clean slate.
    if (this.stormResetTimer) clearTimeout(this.stormResetTimer);
    this.stormResetTimer = setTimeout(() => {
      this.stormResetTimer = undefined;
      if (this.state === ConnectionStateEnum.CONNECTED) {
        this.resetStormTracking();
        this.log?.debug?.(`[${this.accountId}] Connection stable for ${ConnectionManager.SHORT_LIVED_MS / 1000}s, storm tracking reset`);
      }
    }, ConnectionManager.SHORT_LIVED_MS);

    // Additionally, if we have access to the socket, monitor its events
    // The DWClient uses 'ws' WebSocket library which extends EventEmitter
    if (client.socket) {
      const socket = client.socket;
      // Store the socket instance we're attaching listeners to
      this.monitoredSocket = socket;

      // Handler for socket close event
      this.socketCloseHandler = (code: number, reason: string) => {
        this.log?.warn?.(`[${this.accountId}] WebSocket closed event (code: ${code}, reason: ${reason || 'none'})`);

        // Only trigger reconnection if we were previously connected and not stopping
        if (!this.stopped && this.state === ConnectionStateEnum.CONNECTED) {
          if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
          }
          this.handleRuntimeDisconnection();
        }
      };

      // Handler for socket error event
      this.socketErrorHandler = (error: Error) => {
        this.log?.error?.(`[${this.accountId}] WebSocket error event: ${error?.message || 'Unknown error'}`);
      };

      // Listen to socket events
      // Use 'once' for close to avoid duplicate reconnection triggers
      socket.once('close', this.socketCloseHandler);
      // Use 'once' for error as well to prevent accumulation across reconnects
      socket.once('error', this.socketErrorHandler);
    }
  }

  /**
   * Clean up runtime monitoring resources (intervals and event listeners)
   */
  private cleanupRuntimeMonitoring(): void {
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.log?.debug?.(`[${this.accountId}] Health check interval cleared`);
    }

    if (this.stormResetTimer) {
      clearTimeout(this.stormResetTimer);
      this.stormResetTimer = undefined;
    }

    // Remove socket event listeners from the stored socket instance
    if (this.monitoredSocket) {
      const socket = this.monitoredSocket;

      if (this.socketCloseHandler) {
        socket.removeListener('close', this.socketCloseHandler);
        this.socketCloseHandler = undefined;
      }
      if (this.socketErrorHandler) {
        socket.removeListener('error', this.socketErrorHandler);
        this.socketErrorHandler = undefined;
      }

      this.log?.debug?.(`[${this.accountId}] Socket event listeners removed from monitored socket`);
      this.monitoredSocket = undefined;
    }
  }

  /**
   * Handle runtime disconnection and trigger reconnection
   */
  private handleRuntimeDisconnection(): void {
    if (this.stopped) return;

    this.log?.warn?.(`[${this.accountId}] Runtime disconnection detected, initiating reconnection...`);

    this.state = ConnectionStateEnum.DISCONNECTED;
    this.notifyStateChange('Runtime disconnection detected');
    this.attemptCount = 0; // Reset attempt counter for runtime reconnection

    // Clear any existing timer
    this.clearReconnectTimer();

    // Check for reconnect storm and use cooldown delay if needed
    const cooldown = this.markDisconnectedAndEvaluateStorm();
    const delay = cooldown > 0 ? cooldown : this.calculateNextDelay(0);
    this.log?.info?.(`[${this.accountId}] Scheduling reconnection in ${(delay / 1000).toFixed(2)}s`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch((err) => {
        this.log?.error?.(`[${this.accountId}] Reconnection failed: ${err.message}`);
      });
    }, delay);
  }

  /**
   * Reconnect after runtime disconnection
   */
  private async reconnect(): Promise<void> {
    if (this.stopped) return;

    this.log?.info?.(`[${this.accountId}] Attempting to reconnect...`);

    try {
      await this.connect();
      this.log?.info?.(`[${this.accountId}] Reconnection successful`);
    } catch (err: any) {
      if (this.stopped) return;

      this.log?.error?.(`[${this.accountId}] Reconnection failed: ${err.message}`);
      this.state = ConnectionStateEnum.FAILED;
      this.notifyStateChange(err.message);

      // Continue runtime recovery instead of getting stuck in FAILED.
      // Honour any active storm cooldown so we don't hammer the server.
      const cooldown = this.markDisconnectedAndEvaluateStorm();
      const delay = cooldown > 0 ? cooldown : this.calculateNextDelay(0);
      this.attemptCount = 0;
      this.clearReconnectTimer();
      this.log?.warn?.(
        `[${this.accountId}] Reconnection cycle failed; scheduling next reconnect in ${(delay / 1000).toFixed(2)}s`
      );
      this.reconnectTimer = setTimeout(() => {
        void this.reconnect();
      }, delay);
    }
  }

  /**
   * Stop the connection manager and cleanup resources
   */
  public stop(): void {
    if (this.stopped) return;

    this.log?.info?.(`[${this.accountId}] Stopping connection manager...`);

    this.stopped = true;
    this.state = ConnectionStateEnum.DISCONNECTING;

    // Clear reconnect timer
    this.clearReconnectTimer();

    // Cancel any in-flight sleep (retry delay)
    this.cancelSleep();

    // Clean up runtime monitoring resources
    this.cleanupRuntimeMonitoring();

    // Clear SDK heartbeat timer, then disconnect client
    this.clearClientInternals();
    try {
      this.client.disconnect();
    } catch (err: any) {
      this.log?.warn?.(`[${this.accountId}] Error during disconnect: ${err.message}`);
    }

    this.state = ConnectionStateEnum.DISCONNECTED;
    this.log?.info?.(`[${this.accountId}] Connection manager stopped`);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      this.log?.debug?.(`[${this.accountId}] Reconnect timer cleared`);
    }
  }

  /**
   * Sleep utility for retry delays
   * Returns a promise that resolves after ms or can be cancelled via cancelSleep()
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.sleepResolve = resolve;
      this.sleepTimeout = setTimeout(() => {
        this.sleepTimeout = undefined;
        this.sleepResolve = undefined;
        resolve();
      }, ms);
    });
  }

  /**
   * Cancel any in-flight sleep operation
   * Resolves the pending promise immediately so await unblocks
   */
  private cancelSleep(): void {
    if (this.sleepTimeout) {
      clearTimeout(this.sleepTimeout);
      this.sleepTimeout = undefined;
      this.log?.debug?.(`[${this.accountId}] Sleep timeout cancelled`);
    }
    // Resolve the pending promise so await unblocks immediately
    if (this.sleepResolve) {
      this.sleepResolve();
      this.sleepResolve = undefined;
    }
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connection is active
   */
  public isConnected(): boolean {
    return this.state === ConnectionStateEnum.CONNECTED;
  }

  /**
   * Check if connection manager is stopped
   */
  public isStopped(): boolean {
    return this.stopped;
  }
}
