import { http, createConfig } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    coinbaseWallet({
      appName: "Arisako",
      preference: "smartWalletOnly",
    }),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});

export const IDRX_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_IDRX_CONTRACT as `0x${string}` | undefined;
export const ARISAN_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_ARISAN_FACTORY_CONTRACT as `0x${string}` | undefined;