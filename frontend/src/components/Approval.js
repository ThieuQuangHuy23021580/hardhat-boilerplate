import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

export function Approval({ tokenContract, selectedAddress, tokenSymbol }) {
  const [spenderAddress, setSpenderAddress] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [allowancesAsSpender, setAllowancesAsSpender] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSpender, setLoadingSpender] = useState(false);
  const [txPending, setTxPending] = useState(false);

  const loadApprovals = async () => {
    if (!tokenContract || !selectedAddress) return;
    setLoading(true);

    try {
      const provider = tokenContract.provider;
      const network = await provider.getNetwork();
      const latest = await provider.getBlockNumber();
      const fromBlock = network.chainId === 31337 ? 0 : Math.max(0, latest - 50000);

      const approvalFilter = tokenContract.filters.Approval(selectedAddress, null);
      const approvalEvents = await tokenContract.queryFilter(approvalFilter, fromBlock, "latest");

      const spenderSet = new Set();
      approvalEvents.forEach(e => spenderSet.add(e.args[1]));

      if (spenderSet.size === 0) {
        setApprovals([]);
        setLoading(false);
        return;
      }

      const approvalList = await Promise.all(
        Array.from(spenderSet).map(async (spender) => {
          try {
            const allowance = await tokenContract.allowance(selectedAddress, spender);
            return {
              spender,
              allowance: allowance.toString(),
              allowanceFormatted: ethers.utils.formatEther(allowance)
            };
          } catch (err) {
            console.error(`Error fetching allowance for ${spender}:`, err);
            return null;
          }
        })
      );

      setApprovals(
        approvalList
          .filter(a => a !== null)
          .filter(a => !ethers.BigNumber.from(a.allowance).isZero())
      );
    } catch (error) {
      console.error("Error loading approvals:", error);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAllowancesAsSpender = async () => {
    if (!tokenContract || !selectedAddress) return;
    setLoadingSpender(true);

    try {
      const provider = tokenContract.provider;
      const network = await provider.getNetwork();
      const latest = await provider.getBlockNumber();
      const fromBlock = network.chainId === 31337 ? 0 : Math.max(0, latest - 50000);

      const approvalSpenderFilter = tokenContract.filters.Approval(null, selectedAddress);
      const approvalEvents = await tokenContract.queryFilter(approvalSpenderFilter, fromBlock, "latest");

      const ownerSet = new Set();
      approvalEvents.forEach(e => ownerSet.add(e.args[0]));

      if (ownerSet.size === 0) {
        setAllowancesAsSpender([]);
        setLoadingSpender(false);
        return;
      }

      const allowanceList = await Promise.all(
        Array.from(ownerSet).map(async (owner) => {
          try {
            const allowance = await tokenContract.allowance(owner, selectedAddress);
            return {
              owner,
              allowance: allowance.toString(),
              allowanceFormatted: ethers.utils.formatEther(allowance)
            };
          } catch (err) {
            console.error(`Error fetching allowance from ${owner}:`, err);
            return null;
          }
        })
      );

      setAllowancesAsSpender(
        allowanceList
          .filter(a => a !== null)
          .filter(a => !ethers.BigNumber.from(a.allowance).isZero())
      );
    } catch (error) {
      console.error("Error loading allowances as spender:", error);
      setAllowancesAsSpender([]);
    } finally {
      setLoadingSpender(false);
    }
  };

  useEffect(() => {
    loadApprovals();
    loadAllowancesAsSpender();
  }, [tokenContract, selectedAddress]);

  useEffect(() => {
    if (!tokenContract || !selectedAddress) return;

    const onApproval = async (owner, spender, value) => {
      if (owner.toLowerCase() === selectedAddress.toLowerCase()) {
        await loadApprovals();
      }
      if (spender.toLowerCase() === selectedAddress.toLowerCase()) {
        await loadAllowancesAsSpender();
      }
    };

    const onTransfer = async (from, to, value) => {
      await loadAllowancesAsSpender();
    };

    tokenContract.on("Approval", onApproval);
    tokenContract.on("Transfer", onTransfer);
    return () => {
      tokenContract.off("Approval", onApproval);
      tokenContract.off("Transfer", onTransfer);
    };
  }, [tokenContract, selectedAddress]);

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!spenderAddress || !approveAmount) return;

    setTxPending(true);
    try {
      const amount = ethers.utils.parseEther(approveAmount);
      const tx = await tokenContract.approve(spenderAddress, amount);
      await tx.wait();
      
      setSpenderAddress("");
      setApproveAmount("");
      await loadApprovals();
      alert("✅ Approval successful!");
    } catch (error) {
      console.error("Approval error:", error);
      alert("❌ Approval failed: " + error.message);
    } finally {
      setTxPending(false);
    }
  };

  const handleRevoke = async (spender) => {
    if (!window.confirm(`Revoke approval for ${spender}?`)) return;

    setTxPending(true);
    try {
      const tx = await tokenContract.approve(spender, 0);
      await tx.wait();
      
      await loadApprovals();
      alert("✅ Approval revoked!");
    } catch (error) {
      console.error("Revoke error:", error);
      alert("❌ Revoke failed: " + error.message);
    } finally {
      setTxPending(false);
    }
  };

  const handleIncrease = async (spender, currentAllowance) => {
    const increaseAmount = prompt("Enter amount to increase (in tokens):");
    if (!increaseAmount) return;

    setTxPending(true);
    try {
      const increase = ethers.utils.parseEther(increaseAmount);
      const newAllowance = ethers.BigNumber.from(currentAllowance).add(increase);
      const tx = await tokenContract.approve(spender, newAllowance);
      await tx.wait();
      
      await loadApprovals();
      alert("✅ Allowance increased!");
    } catch (error) {
      console.error("Increase error:", error);
      alert("❌ Increase failed: " + error.message);
    } finally {
      setTxPending(false);
    }
  };

  const handleDecrease = async (spender, currentAllowance) => {
    const decreaseAmount = prompt("Enter amount to decrease (in tokens):");
    if (!decreaseAmount) return;

    setTxPending(true);
    try {
      const decrease = ethers.utils.parseEther(decreaseAmount);
      const current = ethers.BigNumber.from(currentAllowance);
      
      if (current.lt(decrease)) {
        alert("Decrease amount is larger than current allowance!");
        setTxPending(false);
        return;
      }

      const newAllowance = current.sub(decrease);
      const tx = await tokenContract.approve(spender, newAllowance);
      await tx.wait();
      
      await loadApprovals();
      alert("✅ Allowance decreased!");
    } catch (error) {
      console.error("Decrease error:", error);
      alert("❌ Decrease failed: " + error.message);
    } finally {
      setTxPending(false);
    }
  };

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h4>Approve Token Spending</h4>
      </div>
      <div className="card-body">
        {txPending && (
          <div className="alert alert-info">
            Transaction pending... Please wait.
          </div>
        )}

        <form onSubmit={handleApprove}>
          <div className="form-group">
            <label>Spender Address</label>
            <input
              className="form-control"
              type="text"
              value={spenderAddress}
              onChange={(e) => setSpenderAddress(e.target.value)}
              placeholder="0x..."
              required
              disabled={txPending}
            />
          </div>
          <div className="form-group">
            <label>Amount of {tokenSymbol} to approve</label>
            <input
              className="form-control"
              type="number"
              step="0.000000000000000001"
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              placeholder="100"
              required
              disabled={txPending}
            />
          </div>
          <div className="form-group">
            <button 
              className="btn btn-success btn-lg" 
              type="submit"
              disabled={txPending}
            >
              ✅ Approve
            </button>
          </div>
        </form>

        <hr />

        <h5>Current Approvals</h5>
        {loading && <p>Loading approvals...</p>}
        {!loading && approvals.length === 0 && (
          <p className="text-muted">No active approvals.</p>
        )}
        {!loading && approvals.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-striped">
              <thead>
                <tr>
                  <th>Spender</th>
                  <th>Allowance ({tokenSymbol})</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((approval) => (
                  <tr key={approval.spender}>
                    <td>
                      <code>{approval.spender}</code>
                    </td>
                    <td>{approval.allowanceFormatted}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary mr-1"
                        onClick={() => handleIncrease(approval.spender, approval.allowance)}
                        disabled={txPending}
                      >
                        ➕ Increase
                      </button>
                      <button
                        className="btn btn-sm btn-warning mr-1"
                        onClick={() => handleDecrease(approval.spender, approval.allowance)}
                        disabled={txPending}
                      >
                        ➖ Decrease
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRevoke(approval.spender)}
                        disabled={txPending}
                      >
                        🚫 Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <hr />

        <h5>💰 Available to Spend (You as Spender)</h5>
        <p className="text-muted">
          <small>These are allowances that others have given you. You can spend these tokens on their behalf.</small>
        </p>
        {loadingSpender && <p>Loading allowances...</p>}
        {!loadingSpender && allowancesAsSpender.length === 0 && (
          <p className="text-muted">No allowances available.</p>
        )}
        {!loadingSpender && allowancesAsSpender.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-striped table-bordered">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Available to Spend ({tokenSymbol})</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allowancesAsSpender.map((allowance) => (
                  <tr key={allowance.owner}>
                    <td>
                      <code>{allowance.owner}</code>
                    </td>
                    <td>
                      <strong className="text-success">{allowance.allowanceFormatted}</strong>
                    </td>
                    <td>
                      <span className="badge badge-success">✅ Active</span>
                      <br />
                      <small className="text-muted">Use CLI: transferFrom</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
