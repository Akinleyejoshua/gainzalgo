import toast from 'react-hot-toast';

export const notify = {
    success: (message: string) => {
        toast.success(message, {
            style: {
                background: '#14151a',
                color: '#fff',
                border: '1px solid #10b981',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '12px',
                borderRadius: '12px'
            },
            iconTheme: {
                primary: '#10b981',
                secondary: '#000',
            },
        });
    },
    error: (message: string) => {
        toast.error(message, {
            style: {
                background: '#14151a',
                color: '#fff',
                border: '1px solid #ef4444',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '12px',
                borderRadius: '12px'
            },
            iconTheme: {
                primary: '#ef4444',
                secondary: '#000',
            },
        });
    },
    info: (message: string) => {
        toast(message, {
            icon: 'ℹ️',
            style: {
                background: '#14151a',
                color: '#fff',
                border: '1px solid #6366f1',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '12px',
                borderRadius: '12px'
            },
        });
    },
    trade: (type: 'BUY' | 'SELL', symbol: string, volume: number) => {
        toast(`${type} ${volume} ${symbol} Executed`, {
            icon: type === 'BUY' ? '🚀' : '🔻',
            style: {
                background: '#14151a',
                color: '#fff',
                border: `1px solid ${type === 'BUY' ? '#10b981' : '#ef4444'}`,
                fontSize: '12px',
                fontWeight: '900',
                padding: '16px',
                borderRadius: '16px',
                boxShadow: `0 10px 25px -5px ${type === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            },
            duration: 5000
        });
    }
};
