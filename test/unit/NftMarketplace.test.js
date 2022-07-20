const { expect, assert } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

const PRICE = ethers.utils.parseEther("0.1")
const TOKEN_ID = 0

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace Unit Tests", function () {
          let nftMarketplace, deployer, nftAddress, basicNft, user
          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              basicNft = await ethers.getContract("BasicNft", deployer)
              nftMarketplace = await ethers.getContract("NftMarketplace", deployer)
              nftAddress = basicNft.address
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          describe("listItem", function () {
              it("Creates the listing and emits the event", async function () {
                  await expect(nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)).to.emit(
                      nftMarketplace,
                      "ItemListed"
                  )
                  const listing = await nftMarketplace.getListing(nftAddress, TOKEN_ID)
                  assert.equal(listing.price.toString(), PRICE.toString())
                  assert.equal(listing.seller, deployer.address)
              })

              it("Revert if the NFT it's already listed", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(
                      `NftMarketplace__AlreadyListed("${nftAddress}", ${TOKEN_ID})`
                  )
              })

              it("Revert if the listing is not create by the owner of the NFT", async function () {
                  const nftMarketplaceUser = nftMarketplace.connect(user)
                  await expect(
                      nftMarketplaceUser.listItem(nftAddress, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })

              it("Revert if the price set is <= 0", async function () {
                  const invalidPrice = ethers.utils.parseEther("0")
                  await expect(
                      nftMarketplace.listItem(nftAddress, TOKEN_ID, invalidPrice)
                  ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero")
              })

              it("Revert if the Marketplace is not approved", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
              })
          })

          describe("buyItem", function () {
              it("Bought succsesfully, transfers the NFT, updates the proceeds and emits event", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  const nftMarketplaceUser = nftMarketplace.connect(user)

                  // Event
                  await expect(
                      nftMarketplaceUser.buyItem(nftAddress, TOKEN_ID, { value: PRICE })
                  ).to.emit(nftMarketplaceUser, "ItemBought")

                  // Transfer
                  const owner = await basicNft.ownerOf(TOKEN_ID)
                  assert.equal(owner, user.address)

                  // Proceeds
                  const proceedsOfDeployer = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(PRICE.toString(), proceedsOfDeployer.toString())
              })

              it("Revert if item is not listed", async () => {
                  await expect(
                      nftMarketplace.buyItem(nftAddress, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith(`NftMarketplace__NotListed("${nftAddress}", ${TOKEN_ID})`)
              })

              it("Revert if price is not met", async () => {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)

                  await expect(
                      nftMarketplace.buyItem(nftAddress, TOKEN_ID, {
                          value: ethers.utils.parseEther("0.01"),
                      })
                  ).to.be.revertedWith(
                      `NftMarketplace__PriceNotMet("${nftAddress}", ${TOKEN_ID}, ${PRICE})`
                  )
              })
          })

          describe("cancelItem", function () {
              it("Delete listing and emit event", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.cancelItem(nftAddress, TOKEN_ID)).to.emit(
                      nftMarketplace,
                      "ItemCancelled"
                  )
              })

              it("Revert if the listing is not cancelled by the owner of the NFT", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  const nftMarketplaceUser = nftMarketplace.connect(user)

                  await expect(
                      nftMarketplaceUser.cancelItem(nftAddress, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })

              it("Revert if item is not listed", async () => {
                  await expect(nftMarketplace.cancelItem(nftAddress, TOKEN_ID)).to.be.revertedWith(
                      `NftMarketplace__NotListed("${nftAddress}", ${TOKEN_ID})`
                  )
              })
          })

          describe("updateListing", function () {
              let newPrice

              beforeEach(async function () {
                  newPrice = ethers.utils.parseEther("0.2")
              })

              it("Update the listing data and emits an event", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.updateListing(nftAddress, TOKEN_ID, newPrice)
                  ).to.emit(nftMarketplace, "ItemListed")
                  const listing = await nftMarketplace.getListing(nftAddress, TOKEN_ID)
                  assert.equal(listing.price.toString(), newPrice.toString())
              })

              it("Revert if the listing is not updated by the owner of the NFT", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  const nftMarketplaceUser = nftMarketplace.connect(user)

                  await expect(
                      nftMarketplaceUser.updateListing(nftAddress, TOKEN_ID, newPrice)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })

              it("Revert if item is not listed", async () => {
                  await expect(
                      nftMarketplace.updateListing(nftAddress, TOKEN_ID, newPrice)
                  ).to.be.revertedWith(`NftMarketplace__NotListed("${nftAddress}", ${TOKEN_ID})`)
              })
          })

          describe("withdrawProceeds", function () {
              it("Withdraw successful", async function () {
                  await nftMarketplace.listItem(nftAddress, TOKEN_ID, PRICE)
                  const nftMarketplaceUser = nftMarketplace.connect(user)
                  nftMarketplaceUser.buyItem(nftAddress, TOKEN_ID, { value: PRICE })

                  const balanceBeforeWithdraw = await deployer.getBalance()
                  const proceeds = await nftMarketplace.getProceeds(deployer.address)

                  const transactionResponse = await nftMarketplace.withdrawProceeds()
                  const transactionReceive = await transactionResponse.wait(1)
                  // Calculate the gas cost of the withdraw transaction to compare the endingDeployerBalance with the initial balance
                  const { gasUsed, effectiveGasPrice } = transactionReceive
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const balanceAfterWithdraw = await deployer.getBalance()

                  assert.equal(
                      balanceBeforeWithdraw.add(proceeds).toString(),
                      balanceAfterWithdraw.add(gasCost).toString()
                  )

                  const finalProceeds = await nftMarketplace.getProceeds(deployer.address)

                  assert.equal(finalProceeds.toString(), "0")
              })

              it("Reverts if theres no proceeds to withdraw", async () => {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NoProceeds"
                  )
              })
          })
      })
