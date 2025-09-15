// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import "hardhat/console.sol";
import {MyToken} from "./MyToken.sol";

contract NFTPoolLockAndRelease is OwnerIsCreator, CCIPReceiver {
    IRouterClient private s_router;
    LinkTokenInterface private s_linkToken;
    MyToken public nft;

    // 自定义错误
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees);
    error NFTTransferFailed(uint256 tokenId, address from, address to);
    error InvalidChainSelector(uint64 chainSelector);
    error InvalidReceiverAddress(address receiver);

    // 事件
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address receiver,
        bytes text,
        address feeToken,
        uint256 fees
    );
    event TokenUnlocked(uint256 tokenId, address newOwner);
    event BalanceChecked(uint256 currentBalance, uint256 requiredFees);
    event FeeEstimated(uint256 fees);
    event FeePaid(uint256 fees);
    event LinkDeposited(address depositor, uint256 amount);
    event LinkWithdrawn(uint256 amount);
    event LockInitiated(uint256 tokenId, address sender, uint64 chainSelector, address receiver);
    event LockFailed(uint256 tokenId, string reason);
    event NFTTransferred(uint256 tokenId, address from, address to);

    constructor(address _router, address _link, address nftAddress) CCIPReceiver(_router) {
        s_router = IRouterClient(_router);
        s_linkToken = LinkTokenInterface(_link);
        nft = MyToken(nftAddress);
    }

    // 获取路由器地址
    function getRouterAddress() public view returns (address) {
        return address(s_router);
    }

    // 获取LINK代币地址
    function getLinkTokenAddress() public view returns (address) {
        return address(s_linkToken);
    }

    // 存款LINK
    function depositLink(uint256 amount) external {
        require(s_linkToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit LinkDeposited(msg.sender, amount);
    }

    // 取款LINK
    function withdrawLink(uint256 amount) external onlyOwner {
        require(s_linkToken.transfer(owner(), amount), "Transfer failed");
        emit LinkWithdrawn(amount);
    }

    // 预估费用
    function estimateFee(
        uint64 destinationChainSelector,
        address receiver,
        bytes memory text
    ) public view returns (uint256) {
        console.log("Estimating fee for chain selector:", destinationChainSelector);
        console.log("Receiver address:", receiver);
        console.log("Payload length:", text.length);
        
        // 验证链选择器
        if (destinationChainSelector == 0) {
            console.log("Invalid chain selector: 0");
            revert("InvalidChainSelector");
        }
        
        // 验证接收者地址
        if (receiver == address(0)) {
            console.log("Invalid receiver address: address(0)");
            revert("InvalidReceiverAddress");
        }
        
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: text,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: 200_000,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(s_linkToken)
        });
        
        console.log("Message constructed successfully");
        
        try s_router.getFee(destinationChainSelector, evm2AnyMessage) returns (uint256 fee) {
            console.log("Fee estimation successful:", fee);
            return fee;
        } catch Error(string memory reason) {
            console.log("Router getFee reverted with reason:", reason);
            revert(reason);
        } catch {
            console.log("Router getFee reverted with unknown error");
            revert("FeeEstimationFailed");
        }
    }

    // 锁定并发送NFT
    function lockAndSendNFT(
        uint256 tokenId,
        address newOwner, 
        uint64 chainSelector, 
        address receiver) public returns(bytes32) {
        // 参数验证
        if (chainSelector == 0) revert InvalidChainSelector(chainSelector);
        if (receiver == address(0)) revert InvalidReceiverAddress(receiver);
        
        emit LockInitiated(tokenId, msg.sender, chainSelector, receiver);
        
        // NFT 转移
        try nft.transferFrom(msg.sender, address(this), tokenId) {
            emit NFTTransferred(tokenId, msg.sender, address(this));
        } catch {
            revert NFTTransferFailed(tokenId, msg.sender, address(this));
        }
        
        bytes memory payload = abi.encode(tokenId, newOwner);
        
        try this.sendMessage(chainSelector, receiver, payload) returns (bytes32 messageId) {
            return messageId;
        } catch Error(string memory reason) {
            emit LockFailed(tokenId, reason);
            revert(reason);
        } catch {
            emit LockFailed(tokenId, "Unknown error");
            revert("LockAndSendFailed");
        }
    }

    // 发送消息
    function sendMessage(
        uint64 destinationChainSelector,
        address receiver,
        bytes memory text
    ) public returns (bytes32 messageId) {
        console.log("1. Building message...");
        // 动态 Gas 设置
        uint256 gasLimit = 500_000;
        if (block.chainid == 11155111) gasLimit = 300_000; // Sepolia
        if (block.chainid == 17000) gasLimit = 400_000;   // Holesky
        
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: text,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: gasLimit,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(s_linkToken)
        });

        console.log("2. Getting fee...");
        uint256 fees = s_router.getFee(destinationChainSelector, evm2AnyMessage);
        console.log("3. Fee:", fees);
        emit FeeEstimated(fees);
        
        console.log("4. Checking balance...");
        uint256 currentBalance = s_linkToken.balanceOf(address(this));
        console.log("5. Current balance:", currentBalance);
        emit BalanceChecked(currentBalance, fees);
        
        // 确保有足够余额
        if (fees > currentBalance) {
            console.log("6. Not enough balance");
            revert NotEnoughBalance(currentBalance, fees);
        }

        console.log("7. Approving router...");
        s_linkToken.approve(address(s_router), fees);
        
        console.log("8. Sending message...");
        messageId = s_router.ccipSend(destinationChainSelector, evm2AnyMessage);
        
        // 修复：将 bytes32 转换为 string
        console.log("9. Message sent with ID: %s", string(abi.encodePacked(messageId)));
        
        emit FeePaid(fees);
        emit MessageSent(
            messageId,
            destinationChainSelector,
            receiver,
            text,
            address(s_linkToken),
            fees
        );
        
        return messageId;
    }

    // 接收消息
    function _ccipReceive(
        Client.Any2EVMMessage memory any2EvmMessage
    ) internal override {
        (uint256 tokenId, address newOwner) = abi.decode(any2EvmMessage.data, (uint256, address));
        // 转移NFT
        nft.transferFrom(address(this), newOwner, tokenId);
        emit TokenUnlocked(tokenId, newOwner);
    }
}