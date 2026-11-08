'use strict';
// Manual Termux/GitHub token creation is open to each user and stays in
// that user's own Gitcoin registry. It does not credit Bubbles' executor.
// Bubbles/AI work rewards belong to the owner-scoped verified server ledger,
// not this local script's untrusted --owner argument.
const BUBBLES_EXECUTOR='www-infinity4';
function assertBubblesExecutor(recipient){
 if(recipient!==BUBBLES_EXECUTOR)throw new Error('gitcoin_executor_recipient_mismatch');
}
module.exports={BUBBLES_EXECUTOR,assertBubblesExecutor};
