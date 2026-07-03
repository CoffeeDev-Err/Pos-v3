Inventory Unit Conversion Enhancement

Requirement:

The system should support Unit Conversion for all products.

Concept:

* Each product has a Base Unit (smallest unit for inventory counting).
* All inventory transactions should be stored and deducted using the Base Unit.
* Sales can be made using different packaging units.

Examples:

EGGS

* Base Unit: Piece
* 1 Box = 30 Pieces
* 1 Tray = 12 Pieces

MILKTEA CUPS

* Base Unit: Piece
* 1 Pack = 50 Pieces

SOFTDRINKS

* Base Unit: Bottle
* 1 Case = 24 Bottles

NOODLES

* Base Unit: Piece
* 1 Box = 40 Pieces

Inventory Logic:

* Stock In:

  * 10 Boxes of Eggs
  * Conversion: 1 Box = 30 Pieces
  * Inventory Stored = 300 Pieces
* Sales:

  * Sell 1 Box = Deduct 30 Pieces
  * Sell 5 Pieces = Deduct 5 Pieces

Display:

* Inventory can be shown as:

  * Total Base Units
  * Equivalent Packaging Units

Example:
265 Pieces = 8 Boxes + 25 Pieces

Database Suggestion:

Product

* ProductID
* ProductName
* BaseUnit

ProductUnitConversion

* ProductID
* UnitName
* ConversionQty

Example:
Eggs

* Piece = 1
* Tray = 12
* Box = 30

Benefits:

* Supports wholesale and retail selling.
* Single inventory source of truth.
* Scalable for all products with different packaging sizes.
* Prevents stock discrepancies.

same po sa Rice, per sack sya pero binibenta din ng per kilo, so ang select ni cashier yung 1kilo, deducted dun sa per sack if ma open.Para hindi hirap at hindi din mano mano yung inventory like maglalaan ng per kilo, or per pc. pag bubuksan yung 1 sack, mag deduct ng 1 sack sa inventory at gagawing per kilo na 25 kilos.ang goal ay tuloy tuloy po yung inventory at di mahirapan si client if inoffer natin itong apps sa kanila.

same po sa Rice, per sack sya pero binibenta din ng per kilo, so ang select ni cashier yung 1kilo, deducted dun sa per sack if ma open.

Para hindi hirap at hindi din mano mano yung inventory like maglalaan ng per kilo, or per pc. pag bubuksan yung 1 sack, mag deduct ng 1 sack sa inventory at gagawing per kilo na 25 kilos.

ang goal ay tuloy tuloy po yung inventory at di mahirapan si client if inoffer natin itong apps sa kanila.
and for the ledger, ma select sa calendar kung hanggang saan ang gustong ma check nila.

and for the ledger, ma select sa calendar kung hanggang saan ang gustong ma check nila.
