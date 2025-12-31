"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { createBrowserClient } from "@supabase/ssr"; 
import { useRouter } from "next/navigation";

export function Web3Auth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const handleAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (isConnected && address && !session && !isLoggingIn) {
        setIsLoggingIn(true);
        try {
          const nonce = new Date().getTime().toString();
          const message = `Selamat datang di Arisako!\n\nNonce: ${nonce}`;

          const signature = await signMessageAsync({ message });

          const response = await fetch("/api/auth", {
            method: "POST",
            body: JSON.stringify({ address, signature, nonce }),
          });

          const { session: newSession, error } = await response.json();
          if (error) throw new Error(error);

          // Simpan session
          await supabase.auth.setSession(newSession);
          
          router.refresh();
        } catch (err) {
            console.error("Gagal login Web3:", err);
            // ALERT buat DEBUG
            alert("Error Detail: " + err.message); 
            disconnect();
        } finally {
          setIsLoggingIn(false);
        }
      }
    };

    handleAuth();
  }, [isConnected, address, supabase, signMessageAsync, disconnect, router]);

  return null;
}