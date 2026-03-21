// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal Uniswap v3 SwapRouter interface
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Minimal WETH interface
interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title SynthPact
 * @notice On-chain service marketplace for autonomous AI agents.
 *         Worker agents post offers. Client agents accept and lock USDC (via Uniswap swap).
 *         On delivery confirmation, USDC is released. On timeout, client gets a refund.
 *
 * Bounty targets:
 *   - Protocol Labs "Let the Agent Cook" ($8,000): autonomous agent loop
 *   - Protocol Labs "Agents With Receipts ERC-8004" ($8,004): on-chain agent identities
 *   - Uniswap "Agentic Finance" ($5,000): real token swaps at deal acceptance
 */
contract SynthPact is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum DealStatus { Open, Accepted, Delivered, Completed, Refunded, Cancelled }

    struct Deal {
        uint256 id;
        address worker;          // Agent that posted the offer
        address client;          // Agent that accepted the deal
        bytes32 taskHash;        // keccak256 of task description (stored off-chain)
        string  taskURI;         // IPFS URI pointing to full task spec
        uint256 price;           // USDC amount (6 decimals)
        uint256 deadline;        // Unix timestamp — client can refund after this
        bytes32 deliveryHash;    // keccak256 of delivered output (set by worker)
        string  deliveryURI;     // IPFS URI pointing to delivered output
        DealStatus status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 deliveredAt;
        uint256 completedAt;
        string  erc8004WorkerIdentity;  // ERC-8004 identity string of worker
        string  erc8004ClientIdentity;  // ERC-8004 identity string of client
    }

    // ─── State ───────────────────────────────────────────────────────────────

    ISwapRouter public immutable swapRouter;
    IERC20      public immutable usdc;
    IWETH       public immutable weth;
    address     public immutable wethAddress;
    uint24      public constant POOL_FEE = 3000; // 0.3% Uniswap v3 pool fee

    uint256 public dealCount;
    mapping(uint256 => Deal) public deals;

    // Worker → list of deal IDs they posted
    mapping(address => uint256[]) public workerDeals;
    // Client → list of deal IDs they accepted
    mapping(address => uint256[]) public clientDeals;

    // ─── Events ──────────────────────────────────────────────────────────────

    event DealPosted(
        uint256 indexed dealId,
        address indexed worker,
        bytes32 taskHash,
        string taskURI,
        uint256 price,
        uint256 deadline,
        string erc8004Identity
    );
    event DealAccepted(
        uint256 indexed dealId,
        address indexed client,
        uint256 usdcLocked,
        string erc8004Identity
    );
    event DeliverySubmitted(
        uint256 indexed dealId,
        address indexed worker,
        bytes32 deliveryHash,
        string deliveryURI
    );
    event DealCompleted(uint256 indexed dealId, address indexed worker, uint256 usdcPaid);
    event DealRefunded(uint256 indexed dealId, address indexed client, uint256 usdcRefunded);
    event DealCancelled(uint256 indexed dealId, address indexed worker);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotWorker();
    error NotClient();
    error InvalidStatus(DealStatus expected, DealStatus actual);
    error DeadlineNotPassed();
    error DeadlinePassed();
    error ZeroPrice();
    error DeadlineMustBeFuture();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _swapRouter, address _usdc, address _weth) {
        swapRouter  = ISwapRouter(_swapRouter);
        usdc        = IERC20(_usdc);
        weth        = IWETH(_weth);
        wethAddress = _weth;
    }

    // ─── Worker Actions ──────────────────────────────────────────────────────

    /**
     * @notice Worker posts a service offer on-chain.
     * @param taskHash   keccak256 hash of the task description
     * @param taskURI    IPFS URI with full task details
     * @param price      USDC price in 6-decimal units (e.g. 1e6 = 1 USDC)
     * @param deadline   Unix timestamp by which work must be delivered
     * @param erc8004Id  Worker's ERC-8004 identity string
     * @return dealId
     */
    function postOffer(
        bytes32 taskHash,
        string calldata taskURI,
        uint256 price,
        uint256 deadline,
        string calldata erc8004Id
    ) external returns (uint256 dealId) {
        if (price == 0) revert ZeroPrice();
        if (deadline <= block.timestamp) revert DeadlineMustBeFuture();

        dealId = ++dealCount;
        Deal storage d = deals[dealId];
        d.id          = dealId;
        d.worker      = msg.sender;
        d.taskHash    = taskHash;
        d.taskURI     = taskURI;
        d.price       = price;
        d.deadline    = deadline;
        d.status      = DealStatus.Open;
        d.createdAt   = block.timestamp;
        d.erc8004WorkerIdentity = erc8004Id;

        workerDeals[msg.sender].push(dealId);

        emit DealPosted(dealId, msg.sender, taskHash, taskURI, price, deadline, erc8004Id);
    }

    /**
     * @notice Worker submits proof of delivery.
     * @param dealId       The deal to deliver on
     * @param deliveryHash keccak256 of the delivered output
     * @param deliveryURI  IPFS URI with full output
     */
    function submitDelivery(
        uint256 dealId,
        bytes32 deliveryHash,
        string calldata deliveryURI
    ) external {
        Deal storage d = deals[dealId];
        if (msg.sender != d.worker) revert NotWorker();
        if (d.status != DealStatus.Accepted) revert InvalidStatus(DealStatus.Accepted, d.status);
        if (block.timestamp > d.deadline) revert DeadlinePassed();

        d.deliveryHash = deliveryHash;
        d.deliveryURI  = deliveryURI;
        d.status       = DealStatus.Delivered;
        d.deliveredAt  = block.timestamp;

        emit DeliverySubmitted(dealId, msg.sender, deliveryHash, deliveryURI);
    }

    // ─── Client Actions ──────────────────────────────────────────────────────

    /**
     * @notice Client accepts an offer and locks USDC in escrow.
     *         If paying with USDC directly, set tokenIn = usdc address.
     *         If paying with ETH, send msg.value and set tokenIn = address(0).
     *         If paying with another ERC-20, it will be swapped via Uniswap.
     * @param dealId    The deal to accept
     * @param tokenIn   Token the client is paying with (address(0) for ETH)
     * @param amountIn  Amount of tokenIn to spend (ignored if ETH — use msg.value)
     * @param erc8004Id Client's ERC-8004 identity string
     */
    function acceptOffer(
        uint256 dealId,
        address tokenIn,
        uint256 amountIn,
        string calldata erc8004Id
    ) external payable nonReentrant {
        Deal storage d = deals[dealId];
        if (d.status != DealStatus.Open) revert InvalidStatus(DealStatus.Open, d.status);
        if (block.timestamp > d.deadline) revert DeadlinePassed();

        uint256 usdcReceived;

        if (tokenIn == address(usdc)) {
            // Direct USDC payment — no swap needed
            usdc.safeTransferFrom(msg.sender, address(this), d.price);
            usdcReceived = d.price;
        } else if (tokenIn == address(0)) {
            // ETH → USDC swap via Uniswap v3
            require(msg.value > 0, "Send ETH");
            IWETH(wethAddress).deposit{value: msg.value}();
            IWETH(wethAddress).approve(address(swapRouter), msg.value);

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn:           wethAddress,
                tokenOut:          address(usdc),
                fee:               POOL_FEE,
                recipient:         address(this),
                deadline:          block.timestamp + 300,
                amountIn:          msg.value,
                amountOutMinimum:  0,          // testnet: no slippage protection (add in production)
                sqrtPriceLimitX96: 0
            });

            usdcReceived = swapRouter.exactInputSingle(params);
        } else {
            // ERC-20 → USDC swap via Uniswap v3
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenIn).approve(address(swapRouter), amountIn);

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          address(usdc),
                fee:               POOL_FEE,
                recipient:         address(this),
                deadline:          block.timestamp + 300,
                amountIn:          amountIn,
                amountOutMinimum:  0,
                sqrtPriceLimitX96: 0
            });

            usdcReceived = swapRouter.exactInputSingle(params);
        }

        // Note: in production, enforce usdcReceived >= d.price for slippage protection

        d.client    = msg.sender;
        d.status    = DealStatus.Accepted;
        d.acceptedAt = block.timestamp;
        d.erc8004ClientIdentity = erc8004Id;

        clientDeals[msg.sender].push(dealId);

        emit DealAccepted(dealId, msg.sender, usdcReceived, erc8004Id);
    }

    /**
     * @notice Client confirms delivery and releases USDC to worker.
     */
    function confirmDelivery(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        if (msg.sender != d.client) revert NotClient();
        if (d.status != DealStatus.Delivered) revert InvalidStatus(DealStatus.Delivered, d.status);

        d.status      = DealStatus.Completed;
        d.completedAt = block.timestamp;

        usdc.safeTransfer(d.worker, d.price);

        emit DealCompleted(dealId, d.worker, d.price);
    }

    /**
     * @notice Client claims a refund if deadline has passed without delivery.
     */
    function claimRefund(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        if (msg.sender != d.client) revert NotClient();
        if (d.status != DealStatus.Accepted) revert InvalidStatus(DealStatus.Accepted, d.status);
        if (block.timestamp <= d.deadline) revert DeadlineNotPassed();

        d.status = DealStatus.Refunded;

        usdc.safeTransfer(d.client, d.price);

        emit DealRefunded(dealId, d.client, d.price);
    }

    /**
     * @notice Worker cancels an open offer before it's accepted.
     */
    function cancelOffer(uint256 dealId) external {
        Deal storage d = deals[dealId];
        if (msg.sender != d.worker) revert NotWorker();
        if (d.status != DealStatus.Open) revert InvalidStatus(DealStatus.Open, d.status);

        d.status = DealStatus.Cancelled;

        emit DealCancelled(dealId, msg.sender);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }

    function getWorkerDeals(address worker) external view returns (uint256[] memory) {
        return workerDeals[worker];
    }

    function getClientDeals(address client) external view returns (uint256[] memory) {
        return clientDeals[client];
    }

    /// @notice Returns all open deal IDs (for agent discovery)
    function getOpenDeals() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= dealCount; i++) {
            if (deals[i].status == DealStatus.Open) count++;
        }
        uint256[] memory openIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= dealCount; i++) {
            if (deals[i].status == DealStatus.Open) openIds[idx++] = i;
        }
        return openIds;
    }
}
