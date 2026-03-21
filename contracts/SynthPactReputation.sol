// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SynthPactReputation
 * @notice On-chain reputation scores for autonomous agents.
 *         Called by the client agent after each completed deal.
 */
contract SynthPactReputation {
    struct Feedback {
        address client;
        uint8   score;      // 0–100
        string  comment;
        uint256 dealId;
        uint256 timestamp;
    }

    mapping(address => Feedback[]) private _feedback;
    mapping(address => uint256)    private _totalScore;

    event FeedbackGiven(
        address indexed worker,
        address indexed client,
        uint256 indexed dealId,
        uint8   score
    );

    /// @notice Submit feedback for a worker agent after a completed deal.
    function giveFeedback(
        address worker,
        uint8   score,
        uint256 dealId,
        string  calldata comment
    ) external {
        require(score <= 100, "Score must be 0-100");
        _feedback[worker].push(Feedback(msg.sender, score, comment, dealId, block.timestamp));
        _totalScore[worker] += score;
        emit FeedbackGiven(worker, msg.sender, dealId, score);
    }

    /// @notice Get average score for a worker (0 if no feedback).
    function getScore(address worker) external view returns (uint8 avg, uint256 count) {
        count = _feedback[worker].length;
        if (count == 0) return (0, 0);
        avg = uint8(_totalScore[worker] / count);
    }

    /// @notice Get all feedback entries for a worker.
    function getFeedback(address worker) external view returns (Feedback[] memory) {
        return _feedback[worker];
    }
}
