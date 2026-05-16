const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("EGPTrustAuditLog", function () {
  async function deployAuditLog() {
    const [owner, relayer, newRelayer, unauthorized] =
      await ethers.getSigners();
    const AuditLog = await ethers.getContractFactory("EGPTrustAuditLog");
    const auditLog = await AuditLog.deploy(relayer.address);
    await auditLog.waitForDeployment();

    return { auditLog, owner, relayer, newRelayer, unauthorized };
  }

  function hashLabel(label) {
    return ethers.id(label);
  }

  it("authorizes the initial relayer and owner can manage relayers", async function () {
    const { auditLog, owner, relayer, newRelayer, unauthorized } =
      await deployAuditLog();

    expect(await auditLog.owner()).to.equal(owner.address);
    expect(await auditLog.authorizedRelayers(relayer.address)).to.equal(true);
    expect(await auditLog.authorizedRelayers(newRelayer.address)).to.equal(
      false,
    );

    await expect(auditLog.connect(unauthorized).setRelayer(newRelayer.address, true))
      .to.be.revertedWithCustomError(auditLog, "UnauthorizedOwner")
      .withArgs(unauthorized.address);

    await expect(auditLog.connect(owner).setRelayer(newRelayer.address, true))
      .to.emit(auditLog, "RelayerAuthorizationUpdated")
      .withArgs(newRelayer.address, true);

    expect(await auditLog.authorizedRelayers(newRelayer.address)).to.equal(true);
  });

  it("blocks writes from non-relayer accounts", async function () {
    const { auditLog, unauthorized } = await deployAuditLog();

    await expect(
      auditLog
        .connect(unauthorized)
        .recordTenderCreated(
          hashLabel("TT-2026-001"),
          hashLabel("tender-hash"),
          hashLabel("actor-hash"),
        ),
    )
      .to.be.revertedWithCustomError(auditLog, "UnauthorizedRelayer")
      .withArgs(unauthorized.address);
  });

  it("emits tender and proposal audit events without storing plaintext", async function () {
    const { auditLog, relayer } = await deployAuditLog();
    const tenderId = hashLabel("TT-2026-001");
    const proposalId = hashLabel("P-001");
    const tenderHash = hashLabel("tender-json-hash");
    const approvalHash = hashLabel("officer-approval-hash");
    const proposalManifestHash = hashLabel("encrypted-proposal-manifest");
    const vendorHash = hashLabel("vendor-identity-hash");
    const actorHash = hashLabel("officer-identity-hash");

    await expect(
      auditLog
        .connect(relayer)
        .recordTenderCreated(tenderId, tenderHash, actorHash),
    )
      .to.emit(auditLog, "TenderCreated")
      .withArgs(tenderId, tenderHash, actorHash, anyValue);

    await expect(
      auditLog
        .connect(relayer)
        .recordTenderPublished(tenderId, approvalHash, actorHash),
    )
      .to.emit(auditLog, "TenderPublished")
      .withArgs(tenderId, approvalHash, actorHash, anyValue);

    await expect(
      auditLog
        .connect(relayer)
        .recordProposalSubmitted(
          tenderId,
          proposalId,
          proposalManifestHash,
          vendorHash,
        ),
    )
      .to.emit(auditLog, "ProposalSubmitted")
      .withArgs(
        tenderId,
        proposalId,
        proposalManifestHash,
        vendorHash,
        anyValue,
      );
  });

  it("emits lifecycle, evaluation, board vote, and award events", async function () {
    const { auditLog, relayer } = await deployAuditLog();
    const tenderId = hashLabel("TT-2026-001");
    const proposalId = hashLabel("P-001");
    const stageHash = hashLabel("BOARD_VOTING-stage-change");
    const evaluationHash = hashLabel("evaluation-signature-hash");
    const voteHash = hashLabel("board-vote-hash");
    const awardHash = hashLabel("award-decision-hash");
    const actorHash = hashLabel("officer-identity-hash");
    const evaluatorHash = hashLabel("evaluator-identity-hash");
    const boardMemberHash = hashLabel("board-member-identity-hash");

    await expect(
      auditLog
        .connect(relayer)
        .recordStageChanged(tenderId, stageHash, actorHash),
    )
      .to.emit(auditLog, "TenderStageChanged")
      .withArgs(tenderId, stageHash, actorHash, anyValue);

    await expect(
      auditLog
        .connect(relayer)
        .recordEvaluationSigned(
          tenderId,
          proposalId,
          evaluationHash,
          evaluatorHash,
        ),
    )
      .to.emit(auditLog, "EvaluationSigned")
      .withArgs(tenderId, proposalId, evaluationHash, evaluatorHash, anyValue);

    await expect(
      auditLog
        .connect(relayer)
        .recordBoardVote(tenderId, proposalId, voteHash, boardMemberHash),
    )
      .to.emit(auditLog, "BoardVoteRecorded")
      .withArgs(tenderId, proposalId, voteHash, boardMemberHash, anyValue);

    await expect(
      auditLog
        .connect(relayer)
        .recordAwardDeclared(tenderId, proposalId, awardHash, actorHash),
    )
      .to.emit(auditLog, "AwardDeclared")
      .withArgs(tenderId, proposalId, awardHash, actorHash, anyValue);
  });

  it("rejects zero hashes to prevent empty audit proofs", async function () {
    const { auditLog, relayer } = await deployAuditLog();

    await expect(
      auditLog
        .connect(relayer)
        .recordAwardDeclared(
          ethers.ZeroHash,
          hashLabel("P-001"),
          hashLabel("award-decision-hash"),
          hashLabel("actor-hash"),
        ),
    ).to.be.revertedWithCustomError(auditLog, "ZeroValue");
  });
});
