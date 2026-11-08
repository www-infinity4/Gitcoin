'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {mintToken}=require('../src/token/mint');
const {credit,transfer,getWallet}=require('../src/wallet/wallet');
const OWNER='www-infinity4';
const tmp=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'gitcoin-owner-')),'wallets.json');

test('GIT Coin issuer credits only www-infinity4, never a customer',()=>{
 assert.throws(()=>mintToken({owner:'customer',repo:'customer/site',pageUrl:'https://customer.github.io/site/'}),/owner_only/);
 const location=tmp();
 assert.throws(()=>credit('customer','receipt-1',1,location),/owner_only/);
 assert.equal(fs.existsSync(location),false);
 assert.equal(getWallet('customer',location),null);
});

test('owner receives one coin per unique token receipt and replay does not double mint',()=>{
 const location=tmp();
 const first=credit(OWNER,'receipt-1',1,location);
 assert.equal(first.balance,1);
 const again=credit(OWNER,'receipt-1',1,location);
 assert.equal(again.balance,1);
 assert.equal(again.transactions.length,1);
 const next=credit(OWNER,'receipt-2',1,location);
 assert.equal(next.balance,2);
 assert.deepEqual(next.tokens,['receipt-1','receipt-2']);
});

test('owner-only GIT awards cannot be transferred or inflated by client amounts',()=>{
 const location=tmp();
 credit(OWNER,'receipt-1',1,location);
 assert.throws(()=>credit(OWNER,'receipt-3',2,location),/one_per_receipt/);
 assert.throws(()=>credit(OWNER,'',1,location),/invalid_receipt/);
 assert.throws(()=>transfer(OWNER,'customer',1,'receipt-1',location),/owner_only_not_transferable/);
 assert.equal(getWallet(OWNER,location).balance,1);
 assert.equal(getWallet('customer',location),null);
});

test('token metadata retains exact origin repo and commit but owner is fixed',()=>{
 const token=mintToken({owner:OWNER,repo:'www-infinity4/QuantaPhi',pageUrl:'https://quantaphi.org',commitSha:'a'.repeat(40),title:'Verified site'});
 assert.equal(token.owner,OWNER);
 assert.equal(token.repo,'www-infinity4/QuantaPhi');
 assert.equal(token.commit_sha,'a'.repeat(40));
});
