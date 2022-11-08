import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { prependOnceListener } from "process";
import { MyToken__factory } from "../typechain-types";
import { Address } from "cluster";
import { string } from "hardhat/internal/core/params/argumentTypes";
dotenv.config();

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];
const TOKENS_MINTED = ethers.utils.parseEther("2");

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

async function DeployTokenizedBallot(adrr: string, blockNumber: number) {
  const TokenizedBallotFactory = await ethers.getContractFactory(
    "TokenizedBallot"
  );
  console.log("Deploying TokenizedBallotContract");
  const TokenizedBallotContract = await TokenizedBallotFactory.deploy(
    convertStringArrayToBytes32(PROPOSALS),
    adrr,
    blockNumber
  );
  const tokenizedBallotContract = await TokenizedBallotContract.deployed();
  return tokenizedBallotContract;
}

async function main() {
  // DEPLOY MyToken (MyERC20Votes.sol)
  const [deployer, acc1, acc2] = await ethers.getSigners();
  const ERC20Factory = await ethers.getContractFactory("MyToken");
  const ERC20Contract = await ERC20Factory.deploy();
  const deploymentTx = await ERC20Contract.deployed();
  // GETTING MyToken CONTRACT ADDRESS
  const ERC20ContractAdrr = deploymentTx.address;
  console.log("Deploy address: " + ERC20ContractAdrr);

  // MINTING TOKENS FOR ACC1
  console.log("Minting new tokens for Acc1");
  const mintTx = await ERC20Contract.mint(acc1.address, TOKENS_MINTED);
  await mintTx.wait();
  const totalSupplyAfter = await ERC20Contract.totalSupply();
  console.log(
    `The totalSupply of this contract after minting is ${ethers.utils.formatEther(
      totalSupplyAfter
    )}\n`
  );
  const acc1BalanceAfterMint = await ERC20Contract.balanceOf(acc1.address);
  console.log(
    `The token balance of acc1 after minting is ${ethers.utils.formatEther(
      acc1BalanceAfterMint
    )}\n`
  );

  // SELF-DELEGATION ACC1
  console.log("Delegating from acc1 to acc1?\n");
  const delegateTx = await ERC20Contract.connect(acc1).delegate(acc1.address);
  await delegateTx.wait();
  let acc1VotingBalance = await ERC20Contract.getVotes(acc1.address);
  console.log(
    `The vote balance of acc1 after self-delegation is ${ethers.utils.formatEther(
      acc1VotingBalance
    )}\n`
  );

  //VOTE ACC1
  let currentBlock = await ethers.provider.getBlock("latest");
  console.log("the current Blocknumber is " + currentBlock.number + "\n");

  const TokenizedBallot = await DeployTokenizedBallot(
    ERC20ContractAdrr,
    currentBlock.number
  );

  console.log("Voting acc1\n");
  const acc1Vote = await TokenizedBallot.connect(acc1).vote(
    0,
    ethers.utils.parseEther("1")
  );
  await acc1Vote.wait();

  const voteCount = await (await TokenizedBallot.proposals(0)).voteCount;
  console.log(Number(voteCount._hex));

  // CHECK VOTE COUNT and votePowerSpent
  // currentBlock = await ethers.provider.getBlock("latest");
  // console.log("the current Blocknumber is " + currentBlock.number + "\n");

  const proposal = await TokenizedBallot.proposals(2);
  const name = ethers.utils.parseBytes32String(proposal.name);
  console.log({ index: 2, name, proposal });
  console.log("Proposal Vote Count: " + proposal.voteCount);

  const votePowerSpent = await TokenizedBallot.votePowerSpent(acc1.address);
  console.log({ votePowerSpent });

  acc1VotingBalance = await ERC20Contract.getVotes(acc1.address);
  console.log(
    `The vote balance of acc1 after voting is ${ethers.utils.formatEther(
      acc1VotingBalance
    )}\n`
  );

  const acc1BalanceAfterVote = await ERC20Contract.balanceOf(acc1.address);
  console.log(
    `The token balance of acc1 after voting is ${ethers.utils.formatEther(
      acc1BalanceAfterVote
    )}\n`
  );

  // CHECK WINNING PROPOSAL
  // currentBlock = await ethers.provider.getBlock("latest");
  // console.log("the current Blocknumber is " + currentBlock.number + "\n");

  const winningProposal = await TokenizedBallot.winningProposal();
  console.log({ winningProposal });

  const winnerName = await TokenizedBallot.winningName();
  console.log({ winnerName });

  const pastVotes = await Promise.all([
    // ERC20Contract.getPastVotes(acc1.address, 6),
    // ERC20Contract.getPastVotes(acc1.address, 5),
    // ERC20Contract.getPastVotes(acc1.address, 4),
    ERC20Contract.getPastVotes(acc1.address, 3),
    ERC20Contract.getPastVotes(acc1.address, 2),
    ERC20Contract.getPastVotes(acc1.address, 1),
    ERC20Contract.getPastVotes(acc1.address, 0),
  ]);
  console.log({ pastVotes });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
