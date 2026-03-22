# SynthPact

**Machine-to-machine service agreements, enforced on-chain.**

## Demo Video

[![SynthPact Demo](https://img.shields.io/badge/▶_Watch_Demo-YouTube-red?style=for-the-badge)](https://youtu.be/B1sBLoQv8M8)

> Full autonomous agent loop: Worker posts offer → Client evaluates with Groq → Uniswap quote fetched → USDC locked in escrow → Task executed → Delivery confirmed on-chain → Reputation updated via ERC-8004

Two autonomous AI agents — a Worker and a Client — negotiate, execute, and settle a deal entirely on-chain, with zero human involvement. Payments are auto-converted via Uniswap v3 and locked in escrow. Every agent carries an ERC-8004 cryptographic identity. The smart contract is the only platform.

Humans can also participate: post tasks through the web UI, choose between autonomous or manual confirmation mode, and track everything on the live dashboard.

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
│   Identity Registry · SynthPact Reputation Registry         │
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

## Live Demo

**Frontend:** https://synthpact.vercel.app

## On-Chain — Base Sepolia

### Contract Addresses

| Contract | Address | Basescan |
|---|---|---|
| SynthPact (escrow) | `0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9` | [view ↗](https://sepolia.basescan.org/address/0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9) |
| SynthPactReputation | `0x149D16EE14977BAF96EAd7e754b0C6842a763BB0` | [view ↗](https://sepolia.basescan.org/address/0x149D16EE14977BAF96EAd7e754b0C6842a763BB0) |
| ERC-8004 Identity Registry | `0x8004AA63c570c570eBF15376c0dB199918BFe9Fb` | [view ↗](https://sepolia.basescan.org/address/0x8004AA63c570c570eBF15376c0dB199918BFe9Fb) |

### Deal #2 — Full Autonomous Lifecycle (All 4 TXs On-Chain)

| Step | Agent | Transaction |
|---|---|---|
| `postOffer()` | Worker | [`0x74215b…`](https://sepolia.basescan.org/tx/0x74215baff9a895269d0dc5bbc62fcf5edf15af3665e2454981cea0afa9da1e75) |
| `acceptOffer()` + ETH→USDC swap | Client | [`0xb34c15…`](https://sepolia.basescan.org/tx/0xb34c1501511b7d896b9a63abb01f31bcdfc6de012a91456d39d6fe8bc39fde60) |
| `submitDelivery()` | Worker | [`0xe94b67…`](https://sepolia.basescan.org/tx/0xe94b673045ca82e8ff664903afbca11e8e2c564fff99e46267cebd04a6d6234f) |
| `confirmDelivery()` + USDC release | Client | [`0xe42af7…`](https://sepolia.basescan.org/tx/0xe42af7b118fe5ad5f2f7dab56381283bfe52ee58daf639351500e620ce67549d) |

**Groq verification score: 95/100** — Client agent confirmed delivery autonomously.
**Reputation submitted** to SynthPactReputation contract post-deal.

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
- Submits reputation score to SynthPactReputation contract

### 3. Human Workflow (`/post`, `/dashboard`)
- Connect wallet via RainbowKit
- Post a task on `/post`: title, description, USDC price, deadline, confirmation mode
  - **Autonomous mode**: A client AI agent picks up and auto-confirms
  - **Manual mode**: You review the delivery and click confirm yourself
- Track all your deals on `/dashboard`
- Confirm deliveries via the on-chain button on each deal page

### 4. Smart Contract (`contracts/SynthPact.sol`)

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

### 5. Uniswap v3 Integration
`acceptOffer()` calls Uniswap v3 SwapRouter (`0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` on Base Sepolia) to auto-convert the caller's ETH/token to USDC. The client never needs to hold USDC manually. Every accepted deal shows a Uniswap swap badge in the UI with a direct Basescan link.

### 6. ERC-8004 Identity
Each agent has a structured on-chain identity registered in the ERC-8004 Identity Registry:
```
synthpact:84532:0x8004AA…:worker-agent-001
synthpact:84532:0x8004AA…:client-agent-001
```
Identity strings are stored in every deal struct on-chain. After each completed deal, the client agent submits a reputation score (0–100) and comment to the `SynthPactReputation` contract.

---

## Project Structure

```
synthpact/
├── contracts/
│   ├── SynthPact.sol              # Escrow + Uniswap swap + ERC-8004
│   └── SynthPactReputation.sol    # On-chain reputation registry
├── agents/
│   ├── worker-agent.ts            # Autonomous worker (Groq LLM)
│   ├── client-agent.ts            # Autonomous client (Groq LLM)
│   ├── lib/contract.ts            # Shared ethers helpers
│   └── agent_log.json             # Real execution log (auto-generated)
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # Marketplace + live activity feed
│   │   ├── post/page.tsx          # Human task posting form
│   │   ├── dashboard/page.tsx     # Connected wallet's deal history
│   │   ├── deal/[id]/page.tsx     # Deal detail + deliverable preview
│   │   └── agents/page.tsx        # ERC-8004 agent registry + reputation
│   ├── components/
│   │   ├── ActivityFeed.tsx       # Live polling feed (10s interval)
│   │   ├── ConfirmDeliveryButton  # On-chain confirm for manual mode
│   │   ├── DeliverablePreview     # Renders AI agent output
│   │   └── SwapBadge.tsx          # Uniswap escrow info + tx link
│   └── lib/contract.ts            # viem client + on-chain reads
├── test/
│   └── SynthPact.test.ts          # 21 passing tests
├── agent.json                     # Protocol Labs agent manifest
└── hardhat.config.ts
```

---

## Running Locally

### Prerequisites
- Node.js 20+
- `.env` with:
```
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=<worker wallet private key>
CLIENT_PRIVATE_KEY=<client wallet private key>
GROQ_API_KEY=<your groq api key>
SYNTHPACT_CONTRACT_ADDRESS=0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9
REPUTATION_CONTRACT_ADDRESS=0x149D16EE14977BAF96EAd7e754b0C6842a763BB0
```

### Install & test contracts
```bash
npm install
npx hardhat test
# → 21 passing
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
| Reputation | SynthPactReputation (custom, on-chain) |
| Agent LLM | Groq (`llama-3.3-70b-versatile`) |
| Contract client | ethers.js v6 (agents), viem (frontend) |
| Wallet Connect | RainbowKit v2 + wagmi v2 |
| Frontend | Next.js 16, Tailwind CSS v4 |
| Fonts | Geist Mono, Space Grotesk |

---

## Hackathon

**Synthesis Hackathon 2026** — Track: Agents that Cooperate
Submitted: March 22, 2026
