"use client";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useState, useEffect, useCallback } from "react";

// USDC Mint on Solana Mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export function useSolana() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [solBalance, setSolBalance] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(null);

  const connected = wallet.connected;
  const publicKey = wallet.publicKey;
  const address = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null;

  // Fetch SOL balance
  useEffect(() => {
    if (!connected || !publicKey) { setSolBalance(null); setUsdcBalance(null); return; }
    let cancelled = false;

    const fetchBalances = async () => {
      try {
        // SOL
        const bal = await connection.getBalance(publicKey);
        if (!cancelled) setSolBalance(bal / LAMPORTS_PER_SOL);

        // USDC (SPL Token)
        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: USDC_MINT });
          const usdcAccount = tokenAccounts.value[0];
          if (usdcAccount && !cancelled) {
            setUsdcBalance(usdcAccount.account.data.parsed.info.tokenAmount.uiAmount);
          } else if (!cancelled) {
            setUsdcBalance(0);
          }
        } catch (e) {
          if (!cancelled) setUsdcBalance(0);
        }
      } catch (e) {
        console.error("Balance fetch error:", e);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 15000); // refresh every 15s
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, connection]);

  const connect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const disconnect = useCallback(() => {
    wallet.disconnect();
  }, [wallet]);

  return {
    connected,
    publicKey,
    address,
    solBalance,
    usdcBalance,
    connect,
    disconnect,
    connection,
    wallet,
  };
}
