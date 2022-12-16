const createClaimableBalance = async (store) => {
  const keypair = StellarSdk.Keypair.fromSecret(store.secret);
  const server = new StellarSdk.Server("https://horizon-testnet.stellar.org");
  const account = await server.loadAccount(store.source);

  // create the desired claimants for this claimable balance
  const destinationClaimant = new StellarSdk.Claimant(
    store.destination,
    StellarSdk.Claimant.predicateUnconditional()
  );
  const sourceClaimant = new StellarSdk.Claimant(
    store.source,
    StellarSdk.Claimant.predicateUnconditional()
  );
  let claimants = [destinationClaimant];
  store.selfClaim && claimants.push(sourceClaimant);

  // create the asset this claimable balance will put on hold
  const cbAsset =
    store.asset.code === "XLM"
      ? StellarSdk.Asset.native()
      : new StellarSdk.Asset(store.asset.code, store.asset.issuer);

  // build the transaction with a single `createClaimableBalance` operation
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.createClaimableBalance({
        asset: cbAsset,
        amount: store.amount.toString(),
        claimants: claimants
      })
    )
    .setTimeout(30)
    .build();

  // sign and submit the transaction
  transaction.sign(keypair);
  try {
    let res = await server.submitTransaction(transaction);
    store.txHash = res.hash;
    store.cbId = transaction.getClaimableBalanceId(0);
  } catch (error) {
    console.error(
      `${error}. More details:\n${JSON.stringify(
        error.response.data.extras, null, 2
      )}`
    );
  }
};

document.addEventListener("alpine:init", () => {
  window.Alpine.store("createClaimableBalanceStore", () => ({
    source: "GBCZUDIPBLG2A5VJSUWH2J547QZXVCTA3WMCVNGHHD3PYFALJPWO2G3J",
    destination: "GDRZF5NWK5GZX6WTGFXP2RRPEXIYTSLM3DYZCV6E5NYXZTX4GEMDGAV4",
    asset: {
      code: "XLM",
      issuer: null
    },
    amount: 10,
    secret: "SDJICCM5LOMHMTF3ZKABLEO3V3P3XDVUSR6GCELQAUFPMP7JLQOSSUPP",
    selfClaim: false,
    txHash: "",
    cbId: "",

    async createClaimableBalance() {
      createClaimableBalance(this);
    }
  }));
});
// TODO: More than just unconditional predicates
