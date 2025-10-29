import React from "react";
import { ethers } from "ethers";
import TokenArtifact from "../contracts/Token.json";
import contractAddress from "../contracts/contract-address.json";
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Transfer } from "./Transfer";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";
import { History } from "./History";
import { Approval } from "./Approval";

const HARDHAT_NETWORK_ID = '31337';
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    this.initialState = {
      tokenData: undefined,
      selectedAddress: undefined,
      balance: undefined,
      txBeingSent: undefined,
      transactionError: undefined,
      networkError: undefined,
    };

    this.state = this.initialState;
  }

  render() {
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet 
          connectWallet={() => this._connectWallet()} 
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }

    if (!this.state.tokenData || !this.state.balance) {
      return <Loading />;
    }

    return (
      <div className="container p-4">
        <div className="row">
          <div className="col-12">
            <h1>
               {this.state.tokenData.name} ({this.state.tokenData.symbol})
            </h1>
            <div className="alert alert-info">
              <h5>Token Information:</h5>
              <p><strong>Name:</strong> {this.state.tokenData.name}</p>
              <p><strong>Symbol:</strong> {this.state.tokenData.symbol}</p>
              <p><strong>Your Address:</strong> {this.state.selectedAddress}</p>
              <p><strong>Your Balance:</strong> {ethers.utils.formatEther(this.state.balance)} {this.state.tokenData.symbol}</p>
            </div>
          </div>
        </div>

        <hr />

        <div className="row">
          <div className="col-12">
            {this.state.txBeingSent && (
              <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
            )}

            {this.state.transactionError && (
              <TransactionErrorMessage
                message={this._getRpcErrorMessage(this.state.transactionError)}
                dismiss={() => this._dismissTransactionError()}
              />
            )}
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            {this.state.balance.eq(0) && (
              <NoTokensMessage selectedAddress={this.state.selectedAddress} />
            )}

            {this.state.balance.gt(0) && (
              <Transfer
                transferTokens={(to, amount) =>
                  this._transferTokens(to, amount)
                }
                tokenSymbol={this.state.tokenData.symbol}
              />
            )}
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            <Approval
              tokenContract={this._token}
              selectedAddress={this.state.selectedAddress}
              tokenSymbol={this.state.tokenData.symbol}
            />
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            <History
              tokenContract={this._token}
              selectedAddress={this.state.selectedAddress}
              tokenSymbol={this.state.tokenData.symbol}
            />
          </div>
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    this._stopPollingData();
  }

  async _connectWallet() {
    try {
      const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });

      const networkOk = await this._checkNetwork();
      
      if (!networkOk) {
        console.log("Network check failed, waiting for user to switch network");
        return;
      }

      this._initialize(selectedAddress);

      window.ethereum.on("accountsChanged", ([newAddress]) => {
        this._stopPollingData();
        if (newAddress === undefined) {
          return this._resetState();
        }
        
        this._initialize(newAddress);
      });
    } catch (error) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        console.log("User rejected wallet connection");
        return;
      }
      this.setState({
        networkError: "Failed to connect wallet. Please make sure MetaMask is installed and unlocked."
      });
    }
  }

  _initialize(userAddress) {
    this.setState({
      selectedAddress: userAddress,
    });

    this._initializeEthers();
    this._getTokenData();
    this._startPollingData();
  }

  async _initializeEthers() {
    this._provider = new ethers.providers.Web3Provider(window.ethereum);

    this._token = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      this._provider.getSigner(0)
    );
  }

  _startPollingData() {
    this._pollDataInterval = setInterval(() => this._updateBalance(), 1000);
    this._updateBalance();
  }

  _stopPollingData() {
    clearInterval(this._pollDataInterval);
    this._pollDataInterval = undefined;
  }

  async _getTokenData() {
    const name = await this._token.name();
    const symbol = await this._token.symbol();

    this.setState({ tokenData: { name, symbol } });
  }

  async _updateBalance() {
    const balance = await this._token.balanceOf(this.state.selectedAddress);
    this.setState({ balance });
  }

  async _transferTokens(to, amount) {
    try {
      this._dismissTransactionError();

      const tx = await this._token.transfer(to, amount);
      this.setState({ txBeingSent: tx.hash });

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      await this._updateBalance();
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }

      console.error(error);
      this.setState({ transactionError: error });
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }

  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  _resetState() {
    this.setState(this.initialState);
  }

  async _switchChain() {
    const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: "Hardhat Local",
                rpcUrls: ["http://127.0.0.1:8545"],
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding network:", addError);
          throw addError;
        }
      } else {
        console.error("Error switching network:", switchError);
        throw switchError;
      }
    }
  }

  async _checkNetwork() {
    if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
      try {
        await this._switchChain();
        return true;
      } catch (error) {
        console.error("Network switch error:", error);
        this.setState({
          networkError: `Please switch to Hardhat Network (Chain ID: ${HARDHAT_NETWORK_ID}). Current network: ${window.ethereum.networkVersion}`
        });
        return false;
      }
    }
    return true;
  }
}
