const { ethers } = require("hardhat");
const contractAddress = require("../frontend/src/contracts/contract-address.json");
const TokenArtifact = require("../frontend/src/contracts/Token.json");

async function main() {
  const spenderAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const fromAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  const toAddress = "0xa65e4e504a771b2d898d77bc36f15267c637bdad";
  const amount = "100";

  const signers = await ethers.getSigners();
  const spender = signers.find(
    s => s.address.toLowerCase() === spenderAddress.toLowerCase()
  );
  
  if (!spender) {
    console.log(`Error: Spender address not found`);
    process.exit(1);
  }
  
  const token = new ethers.Contract(
    contractAddress.Token,
    TokenArtifact.abi,
    spender
  );
  
  const allowance = await token.allowance(fromAddress, spender.address);
  const amountWei = ethers.utils.parseEther(amount);
  
  if (allowance.lt(amountWei)) {
    console.log("Error: Insufficient allowance");
    process.exit(1);
  }
  
  const fromBalance = await token.balanceOf(fromAddress);
  if (fromBalance.lt(amountWei)) {
    console.log("Error: Insufficient balance");
    process.exit(1);
  }
  
  const toBalanceBefore = await token.balanceOf(toAddress);
  
  try {
    const tx = await token.transferFrom(fromAddress, toAddress, amountWei);
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      console.log("Transaction failed");
      process.exit(1);
    }
    
    const fromBalanceAfter = await token.balanceOf(fromAddress);
    const toBalanceAfter = await token.balanceOf(toAddress);
    const allowanceAfter = await token.allowance(fromAddress, spender.address);
    
    console.log("\nTransfer successful");
    console.log("Tx:", tx.hash);
    console.log("From:", ethers.utils.formatEther(fromBalanceAfter), "tokens");
    console.log("To:", ethers.utils.formatEther(toBalanceAfter), "tokens");
    console.log("Remaining allowance:", ethers.utils.formatEther(allowanceAfter), "tokens\n");
  } catch (error) {
    console.log("Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

