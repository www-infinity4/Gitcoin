'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {mintToken}=require('../src/token/mint');
const {credit,transfer,getWallet}=require('../src/wallet/wallet');
const {BUBBLES_EXECUTOR,assertBubblesExecutor}=require('../src/owner-policy');
const tmp=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'gitcoin-user-')),'wallets.json');

test('people can create GIT through Termux without AI and own their separate local coins',()=>{
 const token=mintToken({owner:'customer',repo:'customer/site',pageUrl:'https://customer.github.io/site/',title:'My site'});
 assert.equal(token.owner,'customer');
 const location=tmp();
 const saved=credit('customer',token.id,1,location);
 assert.equal(saved.balance,1);
 assert.equal(getWallet('customer',location).balance,1);
 assert.equal(getWallet(BUBBLES_EXECUTOR,location),null);
});

test('individual manual mints are idempotent per receipt',()=>{
 const location=tmp();
 credit('customer','receipt-1',1,location);
 credit('customer','receipt-1',1,location);
 credit('customer','receipt-2',1,location);
 assert.equal(getWallet('customer',location).balance,2);
 assert.equal(getWallet('customer',location).transactions.length,2);
});

test('a manual transfer affects users own balances, not the owner reward account',()=>{
 const location=tmp();
 credit('alice','receipt-a',1,location);
 transfer('alice','bob',1,'receipt-a',location);
 assert.equal(getWallet('alice',location).balance,0);
 assert.equal(getWallet('bob',location).balance,1);
 assert.equal(getWallet(BUBBLES_EXECUTOR,location),null);
});

test('Bubbles executor reward attribution never resolves to a customer recipient',()=>{
 assert.equal(BUBBLES_EXECUTOR,'www-infinity4');
 assert.doesNotThrow(()=>assertBubblesExecutor(BUBBLES_EXECUTOR));
 assert.throws(()=>assertBubblesExecutor('customer'),/executor_recipient_mismatch/);
});

test('manual mint cannot inflate receipts with arbitrary quantity',()=>{
 const location=tmp();
 assert.throws(()=>credit('customer','receipt-b',2,location),/one_per_receipt/);
 assert.throws(()=>credit('customer','',1,location),/invalid_receipt/);
 assert.equal(fs.existsSync(location),false);
});

test('mint attaches the right originating repository and SHA',()=>{
 const token=mintToken({owner:'customer',repo:'customer/site',pageUrl:'https://customer.github.io/site/',commitSha:'a'.repeat(40),title:'Verified site'});
 assert.equal(token.repo,'customer/site');
 assert.equal(token.commit_sha,'a'.repeat(40));
});
