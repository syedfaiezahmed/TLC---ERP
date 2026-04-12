import io from 'socket.io-client';

class RealTimeReportService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect(token, companyId) {
    if (this.socket && this.connected) {
      return;
    }

    try {
      this.socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true
      });

      this.setupEventListeners(companyId);
    } catch (error) {
      console.error('Socket connection error:', error);
      this.handleReconnect();
    }
  }

  setupEventListeners(companyId) {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Real-time reports connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Join company room for company-specific updates
      if (companyId) {
        this.socket.emit('join-company', companyId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Real-time reports disconnected:', reason);
      this.connected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.connected = false;
      this.handleReconnect();
    });

    // Report-specific events
    this.socket.on('fee-payment-updated', (data) => {
      this.notifySubscribers('fee-payment', data);
    });

    this.socket.on('fee-updated', (data) => {
      this.notifySubscribers('fee', data);
    });

    this.socket.on('voucher-updated', (data) => {
      this.notifySubscribers('voucher', data);
    });

    this.socket.on('student-updated', (data) => {
      this.notifySubscribers('student', data);
    });

    this.socket.on('company-data-updated', (data) => {
      this.notifySubscribers('company', data);
    });

    // Batch updates for performance
    this.socket.on('batch-updates', (data) => {
      data.forEach(update => {
        this.notifySubscribers(update.type, update.data);
      });
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.connected) {
          this.socket?.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifySubscribers('connection-error', { 
        message: 'Unable to establish real-time connection' 
      });
    }
  }

  subscribe(eventType, callback) {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    };
  }

  notifySubscribers(eventType, data) {
    const callbacks = this.subscriptions.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscription callback for ${eventType}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
  }

  isConnected() {
    return this.connected;
  }

  // Manual refresh trigger
  triggerRefresh(reportType, companyId) {
    if (this.socket && this.connected) {
      this.socket.emit('refresh-reports', { type: reportType, companyId });
    }
  }
}

// Create singleton instance
const realTimeReportService = new RealTimeReportService();

export default realTimeReportService;
