export function getLatestClientSequenceNumber(transactions, clientId) {
  return transactions
    .filter((transaction) => transaction.clientId === clientId)
    .at(-1)?.clientSequenceNumber ?? 0;
}

export function getNextClientSequenceNumber(transactions, clientId) {
  return getLatestClientSequenceNumber(transactions, clientId) + 1;
}
