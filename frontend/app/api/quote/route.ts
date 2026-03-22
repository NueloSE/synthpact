import { NextResponse } from "next/server";

const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY!;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export async function GET() {
  try {
    const res = await fetch("https://trade-api.gateway.uniswap.org/v1/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": UNISWAP_API_KEY,
      },
      body: JSON.stringify({
        type: "EXACT_INPUT",
        amount: "1000000000000000000", // 1 WETH
        tokenInChainId: 1,
        tokenOutChainId: 1,
        tokenIn: WETH,
        tokenOut: USDC,
        swapper: "0x0000000000000000000000000000000000000001",
        slippageTolerance: 0.5,
      }),
      next: { revalidate: 30 },
    });

    const data = await res.json() as any;
    if (!data?.quote?.output?.amount) {
      return NextResponse.json({ error: "No quote" }, { status: 502 });
    }

    const usdcOut = Number(data.quote.output.amount) / 1e6;
    return NextResponse.json({
      ethPriceUSD: usdcOut.toFixed(2),
      route: data.quote.route?.[0]?.[0]?.type ?? "classic",
      quoteId: data.quote.quoteId,
      gasFeeUSD: Number(data.quote.gasFeeUSD).toFixed(2),
      priceImpact: data.quote.priceImpact,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
