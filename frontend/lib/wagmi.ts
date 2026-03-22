import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "SynthPact",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "1f33ba102210edcdbe4221dc617a0cb9",
  chains: [baseSepolia],
  ssr: true,
});
