import { MT5Account, Position, TradeHistory, Signal } from '../types';

class MT5Service {
    private config: MT5Account | null = null;

    constructor() { }

    updateConfig(account: MT5Account) {
        this.config = account;
    }

    async connect(account: MT5Account): Promise<{ success: boolean; error?: string }> {
        this.updateConfig(account);

        if (account.isSimulator) {
            // Always succeed in simulator mode
            await new Promise(resolve => setTimeout(resolve, 800));
            return { success: true };
        }

        try {
            // Use autoconnect (GET) if no password provided, otherwise full connect (POST)
            const isAuto = !account.password && !account.login;
            const endpoint = isAuto ? 'autoconnect' : 'connect';
            const method = isAuto ? 'GET' : 'POST';

            const fetchOptions: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000)
            };

            if (method === 'POST') {
                fetchOptions.body = JSON.stringify({
                    login: parseInt(account.login),
                    password: account.password,
                    server: account.server
                });
            }

            const response = await fetch(`${account.bridgeUrl}/${endpoint}`, fetchOptions);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}: Failed to reach MT5 Bridge`);
            }

            const data = await response.json();
            return { success: data.success, error: data.error };
        } catch (error: any) {
            console.error('MT5 Connection Error:', error);
            let message = error.message;
            if (message.includes('Failed to fetch')) {
                message = 'Cannot reach MT5 Bridge. Ensure it is running at the Gateway URL below.';
            }
            return { success: false, error: message };
        }
    }

    async getAccountSummary(): Promise<Partial<MT5Account>> {
        if (this.config?.isSimulator) {
            return {
                balance: 10500.25,
                equity: 10545.10,
                currency: 'USD',
                isConnected: true
            };
        }

        try {
            const response = await fetch(`${this.config?.bridgeUrl}/account`);
            return await response.json();
        } catch (error) {
            return { isConnected: false };
        }
    }

    async getPositions(): Promise<Position[]> {
        if (this.config?.isSimulator) {
            return []; // Empty in simulator by default, or could keep some mock if desired
        }

        if (!this.config?.isConnected) return [];

        try {
            const response = await fetch(`${this.config?.bridgeUrl}/positions`);
            return await response.json();
        } catch (error) {
            return [];
        }
    }

    async placeOrder(params: {
        symbol: string;
        type: 'BUY' | 'SELL';
        volume: number;
        sl?: number;
        tp?: number;
    }): Promise<{ success: boolean; ticket?: number; error?: string }> {
        console.log(`[MT5] Placing ${params.type} order for ${params.symbol} (${params.volume} lots)`);

        if (this.config?.isSimulator) {
            return { success: true, ticket: Math.floor(Math.random() * 1000000) };
        }

        if (!this.config?.isConnected) {
            return { success: false, error: "MT5 not connected" };
        }

        try {
            const response = await fetch(`${this.config?.bridgeUrl}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', "Access-Control-Allow-Origin": "http://localhost:8000" },
                body: JSON.stringify(params)
            });
            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error || data.detail || `HTTP ${response.status} Error` };
            }

            // Ensure even if 200 OK, if success is false, we pass through the error
            if (data.success === false && !data.error) {
                data.error = "Unknown MT5 Error (Check Bridge Logs)";
            }

            return data;
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async closePosition(ticket: number): Promise<{ success: boolean; error?: string }> {
        if (this.config?.isSimulator) return { success: true };

        if (!this.config?.isConnected) return { success: false, error: "MT5 not connected" };

        try {
            const response = await fetch(`${this.config?.bridgeUrl}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket })
            });
            return await response.json();
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async getHistory(): Promise<TradeHistory[]> {
        if (this.config?.isSimulator) {
            return [];
        }

        if (!this.config?.isConnected) return [];

        try {
            const response = await fetch(`${this.config?.bridgeUrl}/history`);
            return await response.json();
        } catch (error) {
            return [];
        }
    }

    // Helper to check if a local bridge is reachable (Auto-Connect feature)
    async probeLocalBridge(): Promise<string | null> {
        const localUrls = ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:5000'];
        for (const url of localUrls) {
            try {
                const res = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(500) });
                if (res.ok) return url;
            } catch (e) { }
        }
        return null;
    }
}

export const mt5Service = new MT5Service();

