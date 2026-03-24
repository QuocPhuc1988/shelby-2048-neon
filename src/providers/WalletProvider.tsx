'use client';

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { PropsWithChildren, useMemo } from "react";

export const WalletProvider = ({ children }: PropsWithChildren) => {
    const wallets = useMemo(() => [new PetraWallet()], []);

    return (
        <AptosWalletAdapterProvider
            plugins={wallets}
            autoConnect={true}
            onError={(error) => {
                console.log("Wallet error", error);
            }}
        >
            {children}
        </AptosWalletAdapterProvider>
    );
};
