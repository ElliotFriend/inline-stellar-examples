import Alpine from "https://cdn.skypack.dev/alpinejs@3.10.5";
window.Alpine = Alpine;

const fundUsingFriendbot = async (publicKey) => {
  if (StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    const friendbotUrl = `https://friendbot.stellar.org?addr=${publicKey}`;
    try {
      await fetch(friendbotUrl);
    } catch (error) {
      console.log(`Error: Something went wrong funding ${publicKey}. ${error}`);
    }
  }
}

const mergeBackToFriendbot = async (keypair) => {
  // const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  const account = await server.loadAccount(keypair.publicKey());
  const transaction = new StellarSdk.TransactionBuilder(
    account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.accountMerge({
      destination: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR'
    }))
    .setTimeout(30)
    .build();

  transaction.sign(keypair);
  try {
    await server.submitTransaction(transaction)
    return true
  } catch (error) {
    console.log(`Error: Something went wrong merging ${keypair.publicKey()}. ${error}`);
    return false
  }
}

const generateChannelAccounts = async (store) => {
  store.channelKeypairs = [];
  store.channelAccounts = [];
  for (let i = 0; i < store.numChannels; i++) {
    const kp = StellarSdk.Keypair.random()
    store.channelKeypairs.push(kp);
    fundUsingFriendbot(kp.publicKey())
    .then(() => {
      const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
      server.loadAccount(kp.publicKey())
      .then((account) => store.channelAccounts.push(account));
    });
  }
}

const makeChannelPayment = async (channelAccount, channelKeypair, senderKeypair, destination, amount, resultsArr) => {
  const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  const sequence = channelAccount.sequence
  const transaction = new StellarSdk.TransactionBuilder(
    channelAccount, {
      fee: amount % 2 === 0 ? StellarSdk.BASE_FEE : parseInt(StellarSdk.BASE_FEE) * 5000,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.payment({
      destination: destination,
      asset: StellarSdk.Asset.native(),
      amount: amount.toString(),
      source: senderKeypair.publicKey(),
    }))
    .setTimeout(30)
    .build()

  transaction.sign(channelKeypair);
  transaction.sign(senderKeypair);
  try {
    server.submitTransaction(transaction)
    .then(res => {
      const resultObj = {
        channelPublic: channelKeypair.publicKey(),
        amount: amount,
        sequence: sequence,
        hash: res.hash,
      }
      resultsArr.push(resultObj);
    })
  } catch (error) {
    console.log(`Error: Something went wrong with a channel payment from ${keypair.publicKey()}. More Details:\n${JSON.stringify(error.response.data.extras, null, 2)}`);
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.store('channelAccountsStore', () => ({
    recipientPublic: 'GAUYICDMMWJYZXMKAESEELYDHX3KNSLSJOTPWUHHRZ63MHGZJAG23IL5',
    senderPublic: 'GDYG5GKRZMBQYYA3R3T3PLMOEIC7W5J7Q22YMOHD3C2PS6SQECR5OXI6',
    senderSecret: 'SAAJY6SHRXDZAI3LGJIUVFUE7K46N2TQNV5EFDAN4IT62I3KHYZHOTJH',
    numChannels: 10,
    channelKeypairs: [],
    channelAccounts: [],
    paymentResults: [],

    generateChannelAccounts() {
      generateChannelAccounts(this);
    },

    cleanUpChannelAccounts() {
      this.channelKeypairs.forEach((kp) =>
        mergeBackToFriendbot(kp)
        .then((merged) => {
          if (merged) {
            const kpIndex = this.channelKeypairs.indexOf(kp);
            this.channelKeypairs.splice(kpIndex, 1)
            this.channelAccounts = this.channelAccounts
            .filter(obj => obj.account_id !== kp.publicKey())
            this.paymentResults = this.paymentResults
            .filter(obj => obj.channelPublic !== kp.publicKey())
          }
        })
      )
    },

    simulateTransactions() {
      const senderKeypair = StellarSdk.Keypair.fromSecret(this.senderSecret)
      for (let i = 0; i < this.channelKeypairs.length; i++) {
        let channelKeypair = this.channelKeypairs[i];
        const channelAccount = this.channelAccounts.find(acc => acc.account_id === channelKeypair.publicKey());
        makeChannelPayment(channelAccount, channelKeypair, senderKeypair, this.recipientPublic, i + 1, this.paymentResults)
      }
    }
  }))
})

Alpine.start()