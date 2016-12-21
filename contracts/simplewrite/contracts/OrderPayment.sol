pragma solidity ^0.4.0;

import "zeppelin-solidity/contracts/Ownable.sol";

/*
 * Order Payment contract helper
 */
contract OrderPayment is Ownable {

  // Order (deferred payment) data structure
  struct Order {
    address payer;
    uint value;
    bool exists;
  }
  // mapping from name of store to its orders, mapped by item
  mapping(string => mapping(bytes => Order)) orders;

  function OrderPayment() Ownable() {}

  function placeOrder(string store, bytes payload, uint value) internal {
    mapping(bytes => Order) storeOrders = orders[store];

    Order memory order = Order(msg.sender, value, true);

    // placeDeposit(value);

    storeOrders[payload] = order;
    OrderPlaced(order.payer, store, payload, value);
  }

  function completeOrder(string store, bytes payload, address account) onlyOwner {
    Order order = orders[store][payload];
    if (!order.exists) throw;

    // sendDeposit(order, account);

    OrderCompleted(order.payer, store, payload, order.value);
    delete orders[store][payload];
  }

  // function placeDeposit(uint value) internal;
  // function sendDeposit(Order order, address account) internal;

  event OrderPlaced(address payer, string store, bytes payload, uint value);
  event OrderCompleted(address payer, string store, bytes payload, uint value);

}
