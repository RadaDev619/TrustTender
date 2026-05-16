const { ethers } = require("hardhat");

async function main() {
  const [owner, defaultRelayer] = await ethers.getSigners();
  const initialRelayer = process.env.RELAYER_ADDRESS ?? defaultRelayer.address;
  const AuditLog = await ethers.getContractFactory("EGPTrustAuditLog");
  const auditLog = await AuditLog.deploy(initialRelayer);

  await auditLog.waitForDeployment();

  const deployment = {
    contract: "EGPTrustAuditLog",
    address: await auditLog.getAddress(),
    owner: owner.address,
    initialRelayer,
    network: (await ethers.provider.getNetwork()).name,
    chainId: String((await ethers.provider.getNetwork()).chainId),
  };

  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
