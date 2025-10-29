import React from "react";
import { ethers } from "ethers";

export function History({ tokenContract, selectedAddress, tokenSymbol }) {
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const isSelf = (addr) => addr && selectedAddress && addr.toLowerCase() === selectedAddress.toLowerCase();

  const loadPastEvents = async () => {
    if (!tokenContract || !selectedAddress) return;
    setLoading(true);

    try {
      const provider = tokenContract.provider;
      const network = await provider.getNetwork();
      const latest = await provider.getBlockNumber();
      const fromBlock = network.chainId === 31337 ? 0 : Math.max(0, latest - 50000);

      const sentFilter = tokenContract.filters.Transfer(selectedAddress, null);
      const recvFilter = tokenContract.filters.Transfer(null, selectedAddress);
      const approvalOwnerFilter = tokenContract.filters.Approval(selectedAddress, null);
      const approvalSpenderFilter = tokenContract.filters.Approval(null, selectedAddress);

      const [sent, received, approvalsAsOwner, approvalsAsSpender] = await Promise.all([
        tokenContract.queryFilter(sentFilter, fromBlock, "latest"),
        tokenContract.queryFilter(recvFilter, fromBlock, "latest"),
        tokenContract.queryFilter(approvalOwnerFilter, fromBlock, "latest"),
        tokenContract.queryFilter(approvalSpenderFilter, fromBlock, "latest"),
      ]);

      const transferMapped = [...sent, ...received].map((e) => ({
        key: `${e.transactionHash}-${e.logIndex}`,
        type: "transfer",
        tx: e.transactionHash,
        from: e.args[0],
        to: e.args[1],
        amount: e.args[2],
        blockNumber: e.blockNumber,
        logIndex: e.logIndex,
        direction: isSelf(e.args[0]) ? "sent" : "received",
        timestamp: undefined,
      }));

      const approvalMapped = [...approvalsAsOwner, ...approvalsAsSpender].map((e) => ({
        key: `${e.transactionHash}-${e.logIndex}`,
        type: "approval",
        tx: e.transactionHash,
        owner: e.args[0],
        spender: e.args[1],
        amount: e.args[2],
        blockNumber: e.blockNumber,
        logIndex: e.logIndex,
        role: isSelf(e.args[0]) ? "owner" : "spender",
        timestamp: undefined,
      }));

      const mapped = [...transferMapped, ...approvalMapped];

      const uniqueBlocks = [...new Set(mapped.map((m) => m.blockNumber))];
      
      mapped.sort((a, b) => (b.blockNumber - a.blockNumber) || (b.logIndex - a.logIndex));
      setEvents(mapped);
      setLoading(false);

      const blocks = await Promise.all(uniqueBlocks.map((b) => provider.getBlock(b)));
      const blockToTs = new Map(blocks.map((b) => [b.number, b.timestamp]));
      
      setEvents((prev) => {
        return prev.map((e) => ({
          ...e,
          timestamp: blockToTs.get(e.blockNumber),
        }));
      });
    } catch (error) {
      console.error("Error loading events:", error);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadPastEvents();
  }, [tokenContract, selectedAddress]);

  React.useEffect(() => {
    if (!tokenContract || !selectedAddress) return;

    const onTransfer = (from, to, value, event) => {
      if (!isSelf(from) && !isSelf(to)) return;
      setEvents((prev) => {
        const next = [
          {
            key: `${event.transactionHash}-${event.logIndex}`,
            type: "transfer",
            tx: event.transactionHash,
            from,
            to,
            amount: value,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex,
            direction: isSelf(from) ? "sent" : "received",
            timestamp: undefined,
          },
          ...prev,
        ];
        return next;
      });
    };

    const onApproval = (owner, spender, value, event) => {
      if (!isSelf(owner) && !isSelf(spender)) return;
      setEvents((prev) => {
        const next = [
          {
            key: `${event.transactionHash}-${event.logIndex}`,
            type: "approval",
            tx: event.transactionHash,
            owner,
            spender,
            amount: value,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex,
            role: isSelf(owner) ? "owner" : "spender",
            timestamp: undefined,
          },
          ...prev,
        ];
        return next;
      });
    };

    tokenContract.on("Transfer", onTransfer);
    tokenContract.on("Approval", onApproval);
    return () => {
      tokenContract.off("Transfer", onTransfer);
      tokenContract.off("Approval", onApproval);
    };
  }, [tokenContract, selectedAddress]);

  const fmt = (v) => {
    try { return ethers.utils.formatEther(v); } catch { return v?.toString?.() ?? ""; }
  };

  const fmtDateTime = (ts) => ts ? new Date(ts * 1000).toLocaleString() : "";

  if (loading) return <div className="mt-3">Loading history...</div>;

  if (!events.length) return <div className="mt-3">No transfers yet.</div>;

  return (
    <div className="mt-4">
      <h4>Transaction History</h4>
      <div className="table-responsive">
        <table className="table table-sm table-hover">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Details</th>
              <th>Amount ({tokenSymbol})</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              if (e.type === "transfer") {
                return (
                  <tr key={e.key} className={e.direction === "sent" ? "table-warning" : "table-success"}>
                    <td>{fmtDateTime(e.timestamp)}</td>
                    <td>
                      <span className="badge badge-info">Transfer</span>
                      <br />
                      <small>{e.direction === "sent" ? "Sent" : "Received"}</small>
                    </td>
                    <td>
                      <small>
                        <strong>From:</strong> <code title={e.from}>{e.from.slice(0, 6)}...{e.from.slice(-4)}</code>
                        <br />
                        <strong>To:</strong> <code title={e.to}>{e.to.slice(0, 6)}...{e.to.slice(-4)}</code>
                      </small>
                    </td>
                    <td>{fmt(e.amount)}</td>
                    <td>
                      <code title={e.tx} style={{whiteSpace: 'nowrap'}}>
                        {e.tx.slice(0, 8)}…{e.tx.slice(-6)}
                      </code>
                    </td>
                  </tr>
                );
              } else if (e.type === "approval") {
                return (
                  <tr key={e.key} className="table-primary">
                    <td>{fmtDateTime(e.timestamp)}</td>
                    <td>
                      <span className="badge badge-secondary">Approval</span>
                      <br />
                      <small>{e.role === "owner" ? "🔐 As Owner" : "✅ As Spender"}</small>
                    </td>
                    <td>
                      <small>
                        <strong>Owner:</strong> <code title={e.owner}>{e.owner.slice(0, 6)}...{e.owner.slice(-4)}</code>
                        <br />
                        <strong>Spender:</strong> <code title={e.spender}>{e.spender.slice(0, 6)}...{e.spender.slice(-4)}</code>
                      </small>
                    </td>
                    <td>{fmt(e.amount)}</td>
                    <td>
                      <code title={e.tx} style={{whiteSpace: 'nowrap'}}>
                        {e.tx.slice(0, 8)}…{e.tx.slice(-6)}
                      </code>
                    </td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
