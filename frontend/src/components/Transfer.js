import React from "react";

export function Transfer({ transferTokens, tokenSymbol }) {
  return (
    <div className="card">
      <div className="card-header">
        <h4>💸 Transfer {tokenSymbol} Tokens</h4>
      </div>
      <div className="card-body">
      <form
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.target);
          const to = formData.get("to");
          const amount = formData.get("amount");

          if (to && amount) {
            transferTokens(to, amount);
          }
        }}
      >
        <div className="form-group">
          <label>Amount of {tokenSymbol}</label>
          <input
            className="form-control"
            type="number"
            step="1"
            name="amount"
            placeholder="1"
            required
          />
        </div>
        <div className="form-group">
          <label>Recipient address</label>
          <input className="form-control" type="text" name="to" required />
        </div>
        <div className="form-group">
          <input className="btn btn-primary btn-lg" type="submit" value="🚀 Transfer Tokens" />
        </div>
      </form>
      </div>
    </div>
  );
}
