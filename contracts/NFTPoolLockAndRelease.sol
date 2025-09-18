// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {MyToken} from "./MyToken.sol";

contract NFTPoolLockAndRelease is OwnerIsCreator, CCIPReceiver, IERC721Receiver {
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
    event NFTAlreadyLocked(uint256 tokenId, address sender);
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
        // 验证链选择器
        if (destinationChainSelector == 0) {
            revert InvalidChainSelector(destinationChainSelector);
        }
        
        // 验证接收者地址
        if (receiver == address(0)) {
            revert InvalidReceiverAddress(receiver);
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
        
        try s_router.getFee(destinationChainSelector, evm2AnyMessage) returns (uint256 fee) {
            return fee;
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
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
        
        // 检查NFT是否已经在合约中
        if (nft.ownerOf(tokenId) != address(this)) {
            // 如果不在合约中，尝试转移NFT到合约
            try nft.transferFrom(msg.sender, address(this), tokenId) {
                emit NFTTransferred(tokenId, msg.sender, address(this));
            } catch {
                revert NFTTransferFailed(tokenId, msg.sender, address(this));
            }
        } else {
            // 如果NFT已经在合约中，记录日志
            emit NFTAlreadyLocked(tokenId, msg.sender);
        }
        
        bytes memory payload = abi.encode(tokenId, newOwner);
        
        // 直接调用内部函数sendMessage
        bytes32 messageId = sendMessage(chainSelector, receiver, payload);
        return messageId;
    }

    // 发送消息
    function sendMessage(
        uint64 destinationChainSelector,
        address receiver,
        bytes memory text
    ) internal returns (bytes32 messageId) {
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

        // 安全地获取费用
        uint256 fees;
        try s_router.getFee(destinationChainSelector, evm2AnyMessage) returns (uint256 fee) {
            fees = fee;
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
            revert("FeeEstimationFailed");
        }
        
        emit FeeEstimated(fees);
        
        // 检查余额
        uint256 currentBalance = s_linkToken.balanceOf(address(this));
        emit BalanceChecked(currentBalance, fees);
        
        // 确保有足够余额
        if (fees > currentBalance) {
            revert NotEnoughBalance(currentBalance, fees);
        }

        // 授权路由器使用LINK
        s_linkToken.approve(address(s_router), fees);
        
        // 发送消息
        try s_router.ccipSend(destinationChainSelector, evm2AnyMessage) returns (bytes32 ccipMessageId) {
            messageId = ccipMessageId;
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
            revert("CCIPSendFailed");
        }
        
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

    // 实现IERC721Receiver接口，使合约能够接收NFT
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        // 返回IERC721Receiver接口的选择器以确认接收NFT
        return IERC721Receiver.onERC721Received.selector;
    }
}