'use client';

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PropsWithChildren } from "react";

export const WalletProvider = ({ children }: PropsWithChildren) => {
    return (
        <AptosWalletAdapterProvider
            autoConnect={true}
            onError={(error) => {
                console.log("Wallet error", error);
            }}
        >
            {children}
        </AptosWalletAdapterProvider>
    );
};
