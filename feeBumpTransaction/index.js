import Alpine from "https://cdn.skypack.dev/alpinejs@3.10.5";
window.Alpine = Alpine;

const wrapInFeeBump = (store) => {
  const innerTx = new StellarSdk.TransactionBuilder.fromXDR(store.innerTx, StellarSdk.Networks.TESTNET)
  const transaction = new StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    store.source,
    store.baseFee,
    innerTx,
    StellarSdk.Networks.TESTNET
  )
  store.feeBumpXDR = transaction.toEnvelope().toXDR("base64")
}

const signFeeBumpTransaction = (store) => {
  const sourceKeypair = StellarSdk.Keypair.fromSecret(store.secret);
  const transaction = new StellarSdk.TransactionBuilder.fromXDR(store.feeBumpXDR, StellarSdk.Networks.TESTNET)
  const signature = transaction.getKeypairSignature(sourceKeypair);
  transaction.addSignature(sourceKeypair.publicKey(), signature);
  store.signedXDR = transaction.toEnvelope().toXDR("base64");
}

const submitFeeBumpTransaction = async (store) => {
  const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  const transaction = new StellarSdk.TransactionBuilder.fromXDR(store.signedXDR, StellarSdk.Networks.TESTNET)
  try {
    const res = await server.submitTransaction(transaction);
    store.txHash = res.hash;
  } catch (error) {
    console.error(`${error}. More details: \n${JSON.stringify(error.response.data.extras, null, 2)}`);
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.store('feeBumpTransactionStore', () => ({
    source: 'GBCZUDIPBLG2A5VJSUWH2J547QZXVCTA3WMCVNGHHD3PYFALJPWO2G3J',
    secret: 'SDJICCM5LOMHMTF3ZKABLEO3V3P3XDVUSR6GCELQAUFPMP7JLQOSSUPP',
    baseFee: 10000,
    innerTx: '',
    feeBumpXDR: '',
    signedXDR: '',
    txHash: '',

    resetState() {
      this.baseFee = 1000;
      this.innerTx = '';
      this.feeBumpXDR = '';
      this.txHash = '';
    },

    wrapInFeeBump() {
      wrapInFeeBump(this)
    },

    signFeeBumpTransaction() {
      signFeeBumpTransaction(this)
    },

    async submitFeeBumpTransaction() {
      submitFeeBumpTransaction(this)
    }
  }))
})

Alpine.start()