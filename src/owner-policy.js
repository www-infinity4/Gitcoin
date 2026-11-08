'use strict';
// The issuer and sole recipient of GIT Coin in this repository.
// A customer's code job can carry a separate verified source receipt,
// but cannot receive or redirect the owner's GIT reward.
const GITCOIN_OWNER='www-infinity4';
function assertOwner(owner){
 if(owner!==GITCOIN_OWNER)throw new Error('gitcoin_owner_only');
}
module.exports={GITCOIN_OWNER,assertOwner};
