// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Mock Uniswap SwapRouter for local testing.
///         Simulates a swap by transferring USDC to the recipient.
contract MockSwapRouter {
    address public immutable usdc;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    constructor(address _usdc) {
        usdc = _usdc;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        // Mock: return exactly amountOutMinimum (the deal price) as USDC
        amountOut = params.amountOutMinimum;
        IERC20(usdc).transfer(params.recipient, amountOut);
    }

    receive() external payable {}
}
