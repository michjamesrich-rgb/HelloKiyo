## Shipping estimator (Japan → US)

### Customer-facing choice
We present 3 options:
- **Best value** (default): most economical lane
- **Faster**: paid upgrade
- **Fastest**: paid upgrade

In the MVP UI, options are represented in `src/shipping.js`.

### Internal accounting (landed-cost)
Even when the customer pays for upgrades, we still track shipping in two different ways:
- **Customer shipping price**: what the customer pays at checkout.
- **Internal Japan→US shipping cost**: what it actually costs HelloKiyo to move the goods internationally.

### How this ties into the “box capacity” gauge
The gauge uses per-item cost basis:

`itemCostBasis = supplierUnitCost + expectedJapanToUSShippingAllocation + handlingAllowance`

For MVP stability (no surprise jumps), the gauge uses **conservative default allocations** per item.
At checkout / fulfillment, we can reconcile:
- estimated shipping allocation → actual shipping allocation
- and feed that back into future allocations to keep margins stable.

### Upgrade cost multipliers (placeholder)
In `src/shipping.js`, we include `internalJapanToUsCostMultiplier` as a placeholder knob.
Later, this becomes a real rate table by:
- total shipment weight proxy
- carrier/service level
- zone/destination

