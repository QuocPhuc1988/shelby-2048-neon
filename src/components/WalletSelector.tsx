'use client';

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Wallet, LogOut, ShieldCheck } from "lucide-react";
import React, { useState } from "react";

const WalletSelector: React.FC = () => {
    const { connect, disconnect, connected, account, wallets } = useWallet();
    const [showModal, setShowModal] = useState(false);

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handleConnect = async (walletName: string) => {
        try {
            await connect(walletName as any);
            setShowModal(false);
        } catch (e) {
            console.error("Connection failed", e);
        }
    };

    return (
        <div className="relative">
            {!connected ? (
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#ff2a75] hover:bg-[#ff4b8e] text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,42,117,0.3)] active:scale-95"
                >
                    <Wallet size={18} />
                    <span>Connect Petra</span>
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end mr-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Wallet Connected</span>
                        <span className="text-xs font-black text-cyan-400 font-mono tracking-tighter">
                            {account?.address ? truncateAddress(account.address.toString()) : "..."}
                        </span>
                    </div>
                    <button
                        onClick={() => disconnect()}
                        className="p-2.5 bg-[#1a1a24] hover:bg-[#252533] text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all group"
                    >
                        <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#16161f] w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl scale-in-center">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <ShieldCheck className="text-cyan-400" />
                                Select Wallet
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-3">
                            {wallets?.filter(w => w.name === 'Petra').map((wallet) => (
                                <button
                                    key={wallet.name}
                                    onClick={() => handleConnect(wallet.name)}
                                    className="w-full flex items-center justify-between p-4 bg-[#1a1a24] hover:bg-[#252533] rounded-2xl border border-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <img src={wallet.icon} alt={wallet.name} className="w-10 h-10 rounded-xl" />
                                        <span className="font-bold text-lg">{wallet.name}</span>
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#ff2a75] transition-colors">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    </div>
                                </button>
                            ))}

                            {!wallets?.some(w => w.name === 'Petra') && (
                                <p className="text-sm text-center text-gray-500 py-4">Petra wallet extension not detected.</p>
                            )}
                        </div>

                        <p className="text-[10px] text-center text-gray-600 mt-6 uppercase tracking-widest font-bold">Aptos Network | Unified Identity</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletSelector;
