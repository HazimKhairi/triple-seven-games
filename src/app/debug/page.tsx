'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function DebugPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [envVar, setEnvVar] = useState<string>('');

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    useEffect(() => {
        // 1. Check Environment Variable
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
        setEnvVar(wsUrl || '(undefined)');
        addLog(`Environment Variable NEXT_PUBLIC_WS_URL: ${wsUrl || '(undefined)'}`);

        if (wsUrl) {
            addLog(`Attempting to connect to: ${wsUrl}`);
        } else {
            addLog('WARNING: No environment variable found. Falling back to window.location (relative path).');
            addLog(`This means it will try to connect to: ${window.location.origin}`);
        }

        setStatus('connecting');

        // 2. Initialize Socket
        const socket = io(wsUrl || '', {
            path: '/api/socket',
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 3,
        });

        socket.on('connect', () => {
            addLog(`Connected to URL: ${(socket.io as any).uri}`);
        });

        socket.on('disconnect', (reason) => {
            setStatus('disconnected');
            addLog(`❌ Disconnected: ${reason}`);
        });

        socket.on('connect_error', (error) => {
            setStatus('disconnected');
            addLog(`⚠️ Connection Error: ${error.message}`);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    return (
        <div className="p-8 font-mono text-sm bg-black text-green-400 min-h-screen">
            <h1 className="text-xl font-bold mb-4">WebSocket Debugger</h1>

            <div className="mb-6 border border-green-800 p-4 rounded bg-gray-900">
                <h2 className="text-white mb-2 font-bold">Configuration</h2>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                    <span className="text-gray-400">NEXT_PUBLIC_WS_URL:</span>
                    <span className={envVar ? "text-white" : "text-red-500 font-bold"}>{envVar}</span>

                    <span className="text-gray-400">Current Status:</span>
                    <span className={`font-bold ${status === 'connected' ? 'text-green-500' : status === 'connecting' ? 'text-yellow-500' : 'text-red-500'}`}>
                        {status.toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="border border-green-800 rounded bg-gray-900 h-[400px] overflow-y-auto p-4">
                <h2 className="text-white mb-2 font-bold sticky top-0 bg-gray-900 pb-2 border-b border-green-800">Logs</h2>
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
}
