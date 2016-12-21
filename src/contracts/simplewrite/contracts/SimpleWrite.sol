pragma solidity ^0.4.0;

import "zeppelin-solidity/contracts/Ownable.sol";

contract SimpleWrite is Ownable {
  uint public REGISTRATION_PRICE_PER_B;

  // constructor
  function SimpleWrite(uint price) {
    REGISTRATION_PRICE_PER_B = price;
  }

  function write(string namespace, bytes payload /* MUST be CBOR */) {
    Write(msg.sender, namespace, payload, payload.length * REGISTRATION_PRICE_PER_B);
  }

  event Write(address payer, string namespace, bytes payload, uint fee);
}
