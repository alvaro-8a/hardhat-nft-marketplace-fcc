const { assert } = require("chai")
const { network, getNamedAccounts, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("basicNft Unit Tests", function () {
          let basicNft, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["basicNft"])
              basicNft = await ethers.getContract("BasicNft")
          })

          it("Allows users to mint and updates counter and tokenURI", async function () {
              const txResponse = await basicNft.mintNft()
              await txResponse.wait(1)
              const counter = await basicNft.getTokenCounter()
              const tokenURI = await basicNft.tokenURI(0)

              assert.equal(counter.toString(), "1")
              assert.equal(tokenURI, await basicNft.TOKEN_URI())
          })
      })

module.exports.tags = ["all", "basicNftTest"]
