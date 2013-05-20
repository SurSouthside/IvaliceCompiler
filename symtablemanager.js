/* symTableManager.js */

var symbolTables = new symTblTree(); //Hashtable (assoc. array) of hashtables (assoc. arrays) of key-value pairs[]
var numOfScopes = symbolTables.length;

var allSymData = ""; //Used to hold toString of symbol table

var validIntValue = /^\d+$/;
var validStringValue = /[abcdefghijklmnopqrstuvwxyz\s]+/;

//A tree to hold the symbol tables
//Borrowed from Alan's tree code which in turn was borrowed from Ardizzone and Smith
function symTblTree(){
// ----------
// Attributes
// ----------
  this.root = { name: "superroot",
				children: [],
				parent: null
}; // Note the NULL root node of this tree.
	this.cur = {}; // Note the EMPTY current node of the tree we're building.
// -- ------- --
// -- Methods --
// -- ------- --
// Add a node: kind in {branch, leaf}.
	this.addTable = function(name, kind) {
// Construct the node object. 
	var node = { name: name,
				children: [],
				parent: {}
};
// Check to see if it needs to be the root node.
if ( this.root.children.length == 0)
{
// We are the child of the superroot node.
	this.root.children.push(node);
	node.parent = this.root;
	this.cur = node;
} 
else
{
// We are the children.
// Make our parent the CURrent node...
	node.parent = this.cur;
// ... and add ourselves (via the unfortunately-named
// "push" function) to the children array of the current node. 
	this.cur.children.push(node);
	this.cur = node;
}
//Note: branch can no longer be properly used because scopes can be nested infinitely, or be infinitely parallel
this.endChildren = function() {
// ... by moving "up" to our parent node (if possible).
	if ((this.cur.parent !== null) && (this.cur.parent.name !== undefined))
	{
		this.cur = this.cur.parent;
	}
	else
	{
// TODO: Some sort of error logging.
// This really should not happen, but it will, of course.
	}
};
}}

//An object that contains data about the symbol (to be used during CST and AST creation)
function symbolTableEntry(type, token)
{
	this.name = token.value.toString(); //a-z Makes this the key; the value is everything else
	this.type = type; //int or string
	this.value = null; //Value of assigned IntExpr or StringExpr 
	this.lineNum = token.lineNum; 
	this.index = token.position; //Within the entire token stream
	this.scope = currentScopeLevel; //Shift this to each table having its own scope, or keep here for redundancy?
	this.isUsed = false;
}

//An object that contains data about the current scope
function scopeTable()
{
	this.scopeLevel = currentScopeLevel;
	this.residents = [];
}

//Used upon detection of ID by parser to see if ID is already declared in all scopes
function checkForPresence(type, symbol) 
{
	var theTable = symbolTables.cur;
	while(theTable !== symbolTables.root)
	{
		var doesExist = checkCurrentScope(type, theTable, symbol);
		if(doesExist)
			return true;
		else
			theTable = theTable.parent;
	}
	return false;
	/*
	//numOfScopes = symbolTables.length;
	var doesExist = checkCurrentScope(type, scopeTbl, symbol);
	if(doesExist)
	{
		numOfScopes = symbolTables.length;
		return true;
	}
	else
	{
		numOfScopes--;
		if(numOfScopes <= -1)
		{
		    numOfScopes = symbolTables.length;
			return false;
		}	
		else
		{
			scopeTbl = symbolTables[numOfScopes];
			checkForPresence(type, symbol);
			//if(numOfScopes == 0)
		    {
				numOfScopes = symbolTables.length;
				scopeTbl = symbolTables[numOfScopes-1];
				return false;
		    }
		}
	}
	*/
}

//Searches current scope for presence of ID currently being parsed
function checkCurrentScope(type,scopeTable,symbol)
{
	for (var k = 0; k < scopeTable.name.residents.length; k++)
	{
		var symbolMatch = scopeTable.name.residents[k];
		if(symbolMatch.name === symbol.value)
		{
			//if(symbolMatch.scope !== numOfScopes)
				//return false;
		    //else 
			{
				if(typeof type == "undefined" || type == "char")
				  return true;
				if(currentScopeLevel !== symbolMatch.scope /*&& typeof type !== "undefined"*/) //Variables with the same ID can be redeclared in different scopes
					return false;
				//I wonder if this is all necessary?
				else if(symbolMatch.value !== null && !inPrintExpr && !inIntExpr && !inBooleanExpr /*&& typeof type !== "undefined" && currentScopeLevel == symbolMatch.scope*/) 
				//Undefined type assumes type of symbol already declared elsewhere 
				{
					putMessage("Error: symbol " + symbol + " is already declared in current scope, and has a value of " + symbolMatch.value);
					errorCount++;
					return false; //To prevent the symbol from being reassigned the new value
				}
				var symbolType = scopeTable.name.residents[k].type;
				//var value = determineValue(symbolType, symbolMatch, k); 
				scopeTable.name.residents[k].isUsed = true;
				//scopeTable.residents[k].value = value;
				return true;
				//Peek through tokenstream to determine assignment
				//Then break out of loop 
			}
		}
	}
		return false; //For when the current table is empty
}

//Used when the currently parsed ID matches a symbol in the symbol table
//This could probably be optimized, but I would rather be correct slower, than wrong faster
function retrieveSymbol(sym)
{
	var theTable = symbolTables.cur;
	while(theTable !== symbolTables.root)
	{
		for(var k = 0; k < theTable.name.residents.length; k++)
		{
			if(theTable.name.residents[k].name == sym)
				return theTable.name.residents[k];
		}
		theTable = theTable.parent;
	}
}

//Used when a valid symbol is written in an int expr; ties the symbol to an expected digit(s) or other ID(s)
function lookupForIntExpr(sym)
{
	/*
	var exists = checkForPresence(null, sym);
	if(exists)
	{
		var value = grabValue(sym);
		return value;
	}
	*/
}

function grabValue(sym)
{
	/*
	for(var k = symbolTables.length; k > 0; k--)
	{
		var getSymValue = seekScopes(symbolTables[k-1], sym);
	}
	return getSymValue;
	*/
}

function seekScopes(table,sym)
{
	/*
	for(var j = 0; j < table.residents.length; j++)
	{
		var symName = table.residents[j].name;
		if(symName == sym)
			return table.residents[j].value;
	}
	*/
}

// Sweeps symbol tables for undeclared IDs, instantiated but uninitialized IDs, type mismatches
function tableAnalysis()
{
	/*
	for(var j = 0; j < symbolTables.length; j++)
	{
		var currScopeTbl = symbolTables[j];
		for(var k = 0; k < currScopeTbl.residents.length; k++)
		{
			var sym = currScopeTbl.residents[k];
			semanticAnalysis(sym);
		}
	}
	*/
}

//Checks details of symbol (modularized from tableAnalysis for readability)
function semanticAnalysis(symbol)
{
	if(symbol.value == null)
		putMessage("Warning: " + symbol.type + " " + symbol.name + " " + "on line " + symbol.lineNum + " is declared but is uninitialized."); //It is only a warning
	if(symbol.isUsed == false)
		putMessage("Warning: " + symbol.type + " " + symbol.name + " " + "on line " + symbol.lineNum + " is declared but not used"); //It is only a warning	
    if(symbol.type == null)
	{
	    putMessage("Error: " + symbol.name + " " + "on line " + symbol.lineNum + " does not have a declared type.");
		errorCount++;
	}
    if(symbol.type == "int" && symbol.value !== null && !validIntValue.test(symbol.value))
	{
		putMessage("Error: " + symbol.type + " " + symbol.name + " " + "on line " + symbol.lineNum + " is of type int but does not have an int value.");
		errorCount++;
    }
	if(symbol.type == "string" && symbol.value !== null && !validStringValue.test(symbol.value))
	{
		putMessage("Error: " + symbol.type + " " + symbol.name + " " + "on line " + symbol.lineNum + " is of type string but does not have a string value.");
		errorCount++;
    }
}

//Rework to fit tree structure
function printSymbolTables(table)
{
	
	var theTable = table; //The only child of the superroot
	
	allSymData += "Scope Level " + theTable.name.scopeLevel + "\n";
	allSymData += printSymbolData(theTable.name);
	
	for(var j = 0; j < theTable.children.length; j++)
	{
		var kidTable = theTable.children[j];
		printSymbolTables(kidTable);
	}
	/*
	for(var k = 0; k < symbolTables.length; k++)
	{
		allSymData += "Scope Level " + symbolTables[k].scopeLevel + "\n";
		scopeSymbolData = printSymbolData(symbolTables[k]);
		allSymData += scopeSymbolData;
	}
	*/
	return allSymData;
}

function printSymbolData(scopeTable)
{
	var scopeSymbols = "";
	
	
	for(var j = 0; j < scopeTable.residents.length; j++)
	{
		var symbol = scopeTable.residents[j];
		var symbolData = "";
		var type = "Type: " + symbol.type;
		var name = "Name: " + symbol.name;
		var value = "Value: " + symbol.value;
		var position = "Position: " + symbol.index
		symbolData = type + " " + name + " " + value + " " + position;
		scopeSymbols += symbolData + "\n";
	}
	
	return scopeSymbols;
}
