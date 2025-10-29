const { ethers } = require("hardhat");
const contractAddress = require("../frontend/src/contracts/contract-address.json");
const TokenArtifact = require("../frontend/src/contracts/Token.json");

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log("\n❌ Usage: npx hardhat run scripts/transferFrom.js --network localhost <spender_address> <from_address> <to_address> <amount>\n");
    console.log("Arguments:");
    console.log("  spender_address : Địa chỉ của spender (người sẽ thực hiện transferFrom)");
    console.log("  from_address    : Địa chỉ của owner (người đã approve)");
    console.log("  to_address      : Địa chỉ nhận token");
    console.log("  amount          : Số lượng token (ví dụ: 10 cho 10 tokens)\n");
    console.log("Example:");
    console.log("  npx hardhat run scripts/transferFrom.js --network localhost \\");
    console.log("    0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \\");
    console.log("    0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \\");
    console.log("    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \\");
    console.log("    100\n");
    process.exit(1);
  }

  const spenderAddress = args[0];
  const fromAddress = args[1];
  const toAddress = args[2];
  const amount = args[3];

  console.log("\n🚀 TransferFrom Script\n");
  console.log("=".repeat(50));

  const signers = await ethers.getSigners();
  
  const spender = signers.find(s => s.address.toLowerCase() === spenderAddress.toLowerCase());
  
  if (!spender) {
    console.log(`❌ Error: Spender address ${spenderAddress} not found in Hardhat accounts`);
    console.log("\n💡 Available addresses:");
    signers.slice(0, 5).forEach((s, i) => {
      console.log(`  Account #${i}: ${s.address}`);
    });
    console.log("  ...");
    process.exit(1);
  }

  console.log("Spender address:", spender.address);
  console.log("From address:", fromAddress);
  console.log("To address:", toAddress);
  console.log("Amount:", amount, "tokens");
  console.log("=".repeat(50));

  const token = new ethers.Contract(
    contractAddress.Token,
    TokenArtifact.abi,
    spender
  );

  console.log("\n📋 Contract Information:");
  console.log("Contract address:", contractAddress.Token);
  console.log("Token name:", await token.name());
  console.log("Token symbol:", await token.symbol());

  console.log("\n🔍 Checking allowance...");
  const allowance = await token.allowance(fromAddress, spender.address);
  console.log("Current allowance:", ethers.utils.formatEther(allowance), "tokens");

  const amountWei = ethers.utils.parseEther(amount);
  
  if (allowance.lt(amountWei)) {
    console.log("\n❌ Error: Insufficient allowance!");
    console.log("Requested:", ethers.utils.formatEther(amountWei), "tokens");
    console.log("Available:", ethers.utils.formatEther(allowance), "tokens");
    console.log("\n💡 Tip: The owner must approve the spender first using the web UI or approve function.");
    process.exit(1);
  }

  console.log("\n🔍 Checking from address balance...");
  const fromBalance = await token.balanceOf(fromAddress);
  console.log("From balance:", ethers.utils.formatEther(fromBalance), "tokens");

  if (fromBalance.lt(amountWei)) {
    console.log("\n❌ Error: Insufficient balance!");
    console.log("Requested:", ethers.utils.formatEther(amountWei), "tokens");
    console.log("Available:", ethers.utils.formatEther(fromBalance), "tokens");
    process.exit(1);
  }

  const toBalanceBefore = await token.balanceOf(toAddress);
  console.log("\n📊 Balances before transfer:");
  console.log("From:", ethers.utils.formatEther(fromBalance), "tokens");
  console.log("To:", ethers.utils.formatEther(toBalanceBefore), "tokens");

  console.log("\n⏳ Executing transferFrom...");
  try {
    const tx = await token.transferFrom(fromAddress, toAddress, amountWei);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      console.log("\n❌ Transaction failed!");
      process.exit(1);
    }

    console.log("\n✅ Transfer successful!");
    console.log("Gas used:", receipt.gasUsed.toString());

    const fromBalanceAfter = await token.balanceOf(fromAddress);
    const toBalanceAfter = await token.balanceOf(toAddress);
    const allowanceAfter = await token.allowance(fromAddress, spender.address);

    console.log("\n📊 Balances after transfer:");
    console.log("From:", ethers.utils.formatEther(fromBalanceAfter), "tokens");
    console.log("To:", ethers.utils.formatEther(toBalanceAfter), "tokens");
    console.log("Remaining allowance:", ethers.utils.formatEther(allowanceAfter), "tokens");

    console.log("\n✨ TransferFrom completed successfully!");
    console.log("=".repeat(50) + "\n");

  } catch (error) {
    console.log("\n❌ Error executing transferFrom:");
    console.error(error.message);
    
    if (error.reason) {
      console.log("Reason:", error.reason);
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
