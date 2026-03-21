# SynthPact

**Machine-to-machine service agreements, enforced on-chain.**

Two autonomous AI agents — a Worker and a Client — negotiate, execute, and settle a deal entirely on-chain, with zero human involvement. Payments are auto-converted via Uniswap v3 and locked in escrow. Every agent carries an ERC-8004 cryptographic identity. The smart contract is the only platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SYNTHPACT SYSTEM                        │
├───────────────┬─────────────────────┬───────────────────────┤
│  Worker Agent │   SynthPact.sol     │  Client Agent         │
│  (Groq LLM)  │   (Base Sepolia)    │  (Groq LLM)           │
│               │                     │                       │
│  1. register  │                     │  1. register          │
│     ERC-8004  │                     │     ERC-8004          │
│               │                     │                       │
│  2. postOffer ├──────────────────>  │                       │
│     taskHash  │  DealPosted event   │                       │
│     price     │                     │                       │
│     deadline  │                     │                       │
│               │  <──────────────────┤  2. discover deals    │
│               │                     │     Groq selects best │
│               │  <──────────────────┤  3. acceptOffer()     │
│               │  ETH → USDC swap    │     pays ETH          │
│               │  (Uniswap v3)       │                       │
│               │  USDC locked        │                       │
│               │                     │                       │
│  3. execute   │                     │                       │
│     task with │                     │                       │
│     Groq LLM  │                     │                       │
│               │                     │                       │
│  4. submit    ├──────────────────>  │                       │
│     delivery  │  deliveryHash       │                       │
│     hash      │  deliveryURI        │                       │
│               │                     │                       │
│               │  <──────────────────┤  4. Groq verifies     │
│               │                     │     delivery          │
│               │  <──────────────────┤  5. confirmDelivery() │
│               │  USDC released ──>  │                       │
│  5. USDC paid │                     │                       │
├───────────────┴─────────────────────┴───────────────────────┤
│                    ERC-8004 Registries                       │
│   Identity Registry · Reputation Registry · Validation      │
│   Both agents registered · Reputation updated post-deal     │
└─────────────────────────────────────────────────────────────┘
```

---

## Bounties Targeted

| Bounty | Track | Amount |
|---|---|---|
| Protocol Labs | "Let the Agent Cook" — Fully autonomous loop | $8,000 |
| Protocol Labs | "Agents With Receipts" — ERC-8004 identity | $8,004 |
| Uniswap | "Agentic Finance" — Real on-chain swaps | $5,000 |

---

## Live Demo — Base Sepolia

**Contract:** [`0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9`](https://sepolia.basescan.org/address/0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9)

### Deal #2 — Full Autonomous Lifecycle (All 4 TXs On-Chain)

| Step | Agent | Transaction |
|---|---|---|
| `postOffer()` | Worker | [`0x74215b…`](https://sepolia.basescan.org/tx/0x74215baff9a895269d0dc5bbc62fcf5edf15af3665e2454981cea0afa9da1e75) |
| `acceptOffer()` + ETH→USDC swap | Client | [`0xb34c15…`](https://sepolia.basescan.org/tx/0xb34c1501511b7d896b9a63abb01f31bcdfc6de012a91456d39d6fe8bc39fde60) |
| `submitDelivery()` | Worker | [`0xe94b67…`](https://sepolia.basescan.org/tx/0xe94b673045ca82e8ff664903afbca11e8e2c564fff99e46267cebd04a6d6234f) |
| `confirmDelivery()` + USDC release | Client | [`0xe42af7…`](https://sepolia.basescan.org/tx/0xe42af7b118fe5ad5f2f7dab56381283bfe52ee58daf639351500e620ce67549d) |

**Groq verification score: 95/100** — Client agent confirmed delivery autonomously.

### ERC-8004 Registries (Base Sepolia)

| Registry | Address |
|---|---|
| Identity Registry | [`0x8004AA63c570c570eBF15376c0dB199918BFe9Fb`](https://sepolia.basescan.org/address/0x8004AA63c570c570eBF15376c0dB199918BFe9Fb) |
| Reputation Registry | [`0x8004bd8daB57f14Ed299135749a5CB5c42d341BF`](https://sepolia.basescan.org/address/0x8004bd8daB57f14Ed299135749a5CB5c42d341BF) |
| Validation Registry | [`0x8004C269D0A5647E51E121FeB226200ECE932d55`](https://sepolia.basescan.org/address/0x8004C269D0A5647E51E121FeB226200ECE932d55) |

### Agent Wallets

| Agent | Role | Address |
|---|---|---|
| Worker | Posts offers, executes tasks | `0x45D2abA26a96B8c99ba459E16915AA53F0eeB1f1` |
| Client | Discovers deals, pays, verifies | `0xD3BF5fE767E998eBC49FC4A9d3D916819154B723` |

---

## How It Works

### 1. Worker Agent (`agents/worker-agent.ts`)
- Registers ERC-8004 identity on-chain
- Posts a service offer: `taskHash`, task description URI, USDC price, deadline
- Waits for a client to accept
- Executes the task using **Groq LLM** (`llama-3.3-70b-versatile`)
- Submits delivery hash + URI on-chain
- Receives USDC payment on confirmation

### 2. Client Agent (`agents/client-agent.ts`)
- Registers ERC-8004 identity on-chain
- Fetches open offers from the contract
- Uses **Groq LLM** to select the best offer
- Calls `acceptOffer()` — ETH is auto-swapped to USDC via Uniswap v3 SwapRouter
- Waits for delivery, uses **Groq LLM** to verify it (scores 0–100)
- Calls `confirmDelivery()` to release USDC to worker

### 3. Smart Contract (`contracts/SynthPact.sol`)

```
postOffer(taskHash, taskURI, price, deadline, erc8004Id)
  → emits DealPosted

acceptOffer(dealId, tokenIn, amountIn, erc8004Id) payable
  → Uniswap v3 swap: tokenIn → USDC
  → USDC locked in escrow
  → emits DealAccepted

submitDelivery(dealId, deliveryHash, deliveryURI)
  → emits DeliverySubmitted

confirmDelivery(dealId)
  → USDC transferred to worker
  → emits DealCompleted

claimRefund(dealId)
  → if deadline expired, client reclaims USDC
```

### 4. Uniswap v3 Integration
`acceptOffer()` calls Uniswap v3 SwapRouter (`0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` on Base Sepolia) to auto-convert the caller's ETH/token to USDC. The client never needs to hold USDC manually.

### 5. ERC-8004 Identity
Each agent has a structured on-chain identity:
```
synthpact:84532:0x8004AA…:worker-agent-001
synthpact:84532:0x8004AA…:client-agent-001
```
Identity strings are stored in every deal struct on-chain. Reputation feedback is submitted to the Reputation Registry after each completed deal.

---

## Project Structure

```
synthpact/
├── contracts/
│   └── SynthPact.sol          # Escrow + Uniswap swap + ERC-8004
├── agents/
│   ├── worker-agent.ts        # Autonomous worker (Groq LLM)
│   ├── client-agent.ts        # Autonomous client (Groq LLM)
│   ├── lib/contract.ts        # Shared ethers helpers
│   └── agent_log.json         # Real execution log (auto-generated)
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Marketplace — all deals
│   │   ├── deal/[id]/page.tsx # Deal detail + lifecycle timeline
│   │   └── agents/page.tsx    # ERC-8004 agent registry
│   └── lib/contract.ts        # viem client + on-chain reads
├── test/
│   └── SynthPact.test.ts      # 21 passing tests
├── agent.json                 # Protocol Labs agent manifest
└── hardhat.config.ts
```

---

## Running Locally

### Prerequisites
- Node.js 20+
- `.env` with: `BASE_SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `CLIENT_PRIVATE_KEY`, `GROQ_API_KEY`, `SYNTHPACT_CONTRACT_ADDRESS`

### Install & test contracts
```bash
npm install
npx hardhat test
```

### Run the autonomous agent demo
```bash
# Terminal 1 — Worker agent
npx ts-node agents/worker-agent.ts

# Terminal 2 — Client agent (run ~30s after worker)
npx ts-node agents/client-agent.ts
```

Watch them negotiate and settle a deal entirely on-chain. Check `agent_log.json` for the full execution trace.

### Run the frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Tests

```
npx hardhat test

  SynthPact
    postOffer
      ✓ posts an offer and emits DealPosted
      ✓ reverts if price is zero
      ✓ reverts if deadline is in the past
    acceptOffer
      ✓ accepts with ERC20 token (no swap)
      ✓ accepts with ETH and performs swap
      ✓ reverts if deal not open
      ✓ reverts if already accepted
    submitDelivery
      ✓ worker can submit delivery
      ✓ reverts if not worker
      ✓ reverts if not accepted
    confirmDelivery
      ✓ client can confirm and USDC is released
      ✓ reverts if not client
      ✓ reverts if no delivery
    claimRefund
      ✓ client can refund after deadline
      ✓ reverts if deadline not passed
    cancelOffer
      ✓ worker can cancel open offer
      ✓ reverts if not worker
    status transitions
      ✓ full lifecycle: Open → Accepted → Delivered → Completed
      ✓ refund path: Open → Accepted → Refunded
    getOpenDeals
      ✓ returns only open deal IDs
    getDeal
      ✓ returns full deal struct

  21 passing
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart Contract | Solidity 0.8.28, Hardhat 2.22 |
| Blockchain | Base Sepolia (chainId 84532) |
| DEX | Uniswap v3 SwapRouter |
| Agent Identity | ERC-8004 Identity Registry |
| Agent LLM | Groq (`llama-3.3-70b-versatile`) |
| Contract client | ethers.js v6 |
| Frontend | Next.js 16, Tailwind CSS v4, viem |
| Fonts | Geist, Space Grotesk |

---

## Hackathon

**Synthesis Hackathon 2026** — Track: Agents that Cooperate
