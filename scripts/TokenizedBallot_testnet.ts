import { ethers, Signer } from "ethers";
import * as dotenv from "dotenv";
import { prependOnceListener } from "process";
import { MyToken__factory, TokenizedBallot__factory } from "../typechain-types";
import { Address } from "cluster";
import { string } from "hardhat/internal/core/params/argumentTypes";
dotenv.config();

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];
const TOKENS_MINTED = ethers.utils.parseUnits("1000", "gwei");

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

async function DeployTokenizedBallot(
  adrr: string,
  blockNumber: number,
  signer: Signer
) {
  const TokenizedBallotFactory = new TokenizedBallot__factory(signer);
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
  const options = { alchemy: process.env.ALCHEMY_API_KEY };
  const provider = ethers.providers.getDefaultProvider("goerli", options);

  const mnemonic = process.env.MNEMONIC!;
  const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
  const pathIndex: number = 0;
  const path = `m/44'/60'/0'/0/${pathIndex}`;
  const path1 = `m/44'/60'/0'/0/1`;
  const path2 = `m/44'/60'/0'/0/2`;
  const wallet = new ethers.Wallet(hdNode.derivePath(path));
  console.log(`DeployToken Using address ${wallet.address}`);
  const wallet1 = new ethers.Wallet(hdNode.derivePath(path1));
  const wallet2 = new ethers.Wallet(hdNode.derivePath(path2));

  const signer = wallet.connect(provider);
  const balanceBN = await signer.getBalance();
  const balance = Number(ethers.utils.formatUnits(balanceBN));
  console.log(`DeployToken Wallet balance ${balance}`);
  if (balance < 0.01) {
    throw new Error("Not enouth ether");
  }

  const acc1 = wallet1.connect(provider);
  const acc2 = wallet2.connect(provider);

  // DEPLOY MyToken
  console.log("Deploying MyToken");
  const ERC20Factory = new MyToken__factory(signer);
  const ERC20Contract = await ERC20Factory.deploy();
  const deploymentTx = await ERC20Contract.deployed();
  const myTokenContractAdrr = deploymentTx.address;
  console.log("Deployed MyToken contract address: " + myTokenContractAdrr);
  const myTokenContractBlock = await provider.getBlock("latest"); //deploymentTx.deployTransaction.blockNumber as number;
  const myTokenContractBlockNumber = myTokenContractBlock.number;
  console.log("myTokenContractBlock: " + myTokenContractBlockNumber);

  // MINTING TOKENS FOR ACC1
  console.log("Minting new tokens for Acc1");
  const mintTx = await ERC20Contract.mint(acc1.address, TOKENS_MINTED);
  await mintTx.wait();
  const totalSupplyAfter = await ERC20Contract.totalSupply();
  console.log(
    `The totalSupply of this contract after minting is ${ethers.utils.formatUnits(
      totalSupplyAfter,
      "gwei"
    )}\n`
  );
  let acc1VotingPower = await ERC20Contract.getVotes(acc1.address);
  console.log(
    `The vote balance of acc1 after minting is ${ethers.utils.formatUnits(
      acc1VotingPower,
      "gwei"
    )}\n`
  );
  let acc1Balance = await ERC20Contract.balanceOf(acc1.address);
  console.log(
    `The token balance of acc1 after minting is ${ethers.utils.formatUnits(
      acc1Balance,
      "gwei"
    )}\n`
  );

  // SELF-DELEGATION ACC1
  console.log("Delegating from acc1 to acc1?\n");
  const delegateTx = await ERC20Contract.connect(acc1).delegate(acc1.address);
  await delegateTx.wait();

  acc1VotingPower = await ERC20Contract.getVotes(acc1.address);
  console.log(
    `The vote balance of acc1 after self-delegation is ${ethers.utils.formatUnits(
      acc1VotingPower,
      "gwei"
    )}\n`
  );

  acc1Balance = await ERC20Contract.balanceOf(acc1.address);
  console.log(
    `The token balance of acc1 after self-delegation is ${ethers.utils.formatUnits(
      acc1Balance,
      "gwei"
    )}\n`
  );

  //VOTE ACC1
  let currentBlock = await provider.getBlock("latest");
  console.log("the current Blocknumber is " + currentBlock.number + "\n");

  const TokenizedBallot = await DeployTokenizedBallot(
    myTokenContractAdrr,
    currentBlock.number,
    signer
  );

  console.log("Voting acc1\n");
  const acc1Vote = await TokenizedBallot.connect(acc1).vote(
    0,
    ethers.utils.parseUnits("0", "gwei")
  );
  await acc1Vote.wait();

  const voteCount = await (await TokenizedBallot.proposals(0)).voteCount;
  console.log("Proposal Vote Count: " + Number(voteCount._hex));

  let acc1VotingBalance = await ERC20Contract.getVotes(acc1.address);
  console.log(
    `The vote balance of acc1 after voting is ${ethers.utils.formatUnits(
      acc1VotingBalance,
      "gwei"
    )}\n`
  );

  acc1Balance = await ERC20Contract.balanceOf(acc1.address);
  console.log(
    `The token balance of acc1 after voting is ${ethers.utils.formatUnits(
      acc1Balance,
      "gwei"
    )}\n`
  );

  const winningProposal = await TokenizedBallot.winningProposal();
  console.log({ winningProposal });

  const winnerName = await TokenizedBallot.winningName();
  console.log({ winnerName });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
