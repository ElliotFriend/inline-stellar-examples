import Alpine from "https://cdn.skypack.dev/alpinejs@3.10.5";
window.Alpine = Alpine;

const fetchClaimableBalances = async (store) => {
  const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  const cbRecords = await server
    .claimableBalances()
    .claimant(store.claimant)
    .limit(200)
    .call()
    .then((res) => res.records)
  store.cbArray = cbRecords;
  store.fetchedCBs = true;
}

const claimSelectedBalances = async (store) => {
  // load the source account from the horizon server
  const keypair = StellarSdk.Keypair.fromSecret(store.secret);
  const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  const account = await server.loadAccount(store.claimant);

  // begin the transaction
  let transaction = new StellarSdk.TransactionBuilder(
    account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  });

  // add a claim operation for each selected balance
  store.selectedCBs.forEach(cbId => {
    transaction.addOperation(StellarSdk.Operation.claimClaimableBalance({
      balanceId: cbId
    }))
  })

  // build, sign, submit the transaction
  transaction = transaction.setTimeout(30).build()
  transaction.sign(keypair)
  try {
    let res = await server.submitTransaction(transaction);
    store.txHash = res.hash;
    store.cbArray = store.cbArray
      .filter(obj => !store.selectedCBs.includes(obj.id))
    store.selectedCBs = []
  } catch (error) {
    console.error(
      `${error}. More details:\n${JSON.stringify(
        error.response.data.extras, null, 2
      )}`)
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.store('claimClaimableBalanceStore', () => ({
    claimant: 'GDRZF5NWK5GZX6WTGFXP2RRPEXIYTSLM3DYZCV6E5NYXZTX4GEMDGAV4',
    secret: 'SCHJCCPM6NKIWHEDUIWQIFUCLJJSDMW7FZ5L4SYZFSNNT2TM2WG5PSNL',
    cbArray: [],
    selectedCBs: [],
    fetchedCBs: false,
    txHash: '',

    resetState() {
      this.cbArray = [];
      this.fetchedCBs = false;
      this.txHash = '';
    },

    async fetchClaimableBalances() {
      fetchClaimableBalances(this)
    },

    async claimSelectedBalances() {
      claimSelectedBalances(this)
    }
  }))
})

Alpine.start()