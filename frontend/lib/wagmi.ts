import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "SynthPact",
  projectId: "synthpact-hackathon-2026",
  chains: [baseSepolia],
  ssr: true,
});
