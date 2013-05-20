/* codegen.js
   Uses 6502A opcodes to produce readable machine
   languages for the wonderful operating systems
   we built last semester */
   
   
var opCodeStream = [];  
var staticTable = [];
//var heapTable = [];
var jumpTable = [];

var validAssignedString = /[a-z]{2,}/; //Two or more characters, so IDs fall through this regex

var maxLength = 256;
var numStatics = -1;
var stackOffset = -1;
//var heapOffset = -1
//var numHeaps = -1;
var numJumps = -1;

var stringID = -1; //Used when adding unassigned strings to static table
var addID = -1; //Used when adding unassigned sums to static table
var boolID = -1; //Used when adding unassigned (true)bools to static table

var stackTracker = 0; //Starts at one block after program termination (break)
var heapTracker = 127; //Starts at 7F (In order to fit into the OS)
var jumpTracker = 0; //Tracks where the code will move to on branch not equal

var inControl = false; //Used to see if we are in an if or a while body to increment the jump tracker
var printStringLiteral = false;

var memLocTracker = 0;//Convert this to hex

var totalSum = 0; //Used for debugging to insure everything is being added properly
var newHeapStart = 127; //Used globally for the fillout method after backpatching (instantitated with 127 to still work if no strings are assigned in the code)

function opCodeStreamEntry(loc, code) //I find it easier to track 256 objects through this encapsulation. It will also be cleaner for backpatching and filling in the remainder of the heap
{
  this.memLoc = loc; //00 to 7F
	this.data = code; //The 6502
}

//Stores variable declarations of fixed size (ints and bools)
function staticTableEntry(varName, scope, isPointer)
{
	this.name = "T" + ++numStatics + "XX"; //This takes up two blocks of memory, so four characters are necessary
	this.variable = varName; //If the token is a string, this is actually a pointer to its location in the heap
	this.scope = scope;
	this.offset = ++stackOffset; //They are always length one, so systematic incrementing is fine
	this.isPointer = isPointer; //Discern name as pointer to location of string in heap
}

//Stores variable declarations of changeable size (strings)
/*
function heapTableEntry(idToken)
{
	this.name = "T" + ++numHeaps + "XX";
}
*/

//Stores declarations of control statements (if and while)
function jumpTableEntry()
{
	this.name = "J" + ++numJumps; //This only takes up one space of memory as opposed to two, so only two characters are necessary
	this.distance = "undefined"; //This cannot be determined until the code inside the accepting state is generated
}

function codeGen(ast)
{
	var root = ast.root;
	
	if(root.name == "block")
	{
		discernBlockCode(root);
		var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //6502 for break, denoting program termination (not necessary, but a good safeguard)
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
	}
	else if(root.name == "if" || root.name == "while")
	{
		discernControlCode(root);
	}
	else //Hopefully a program with just one statement
	{
		produce6502(root);
	}
	
	backpatch(opCodeStream); //Prepare the code for execution
	fillOut(opCodeStream); //Add in zeroes where there is no data 
	bubbleSort(opCodeStream); //Rearrange memory locations in proper order
							  //I was going to use quicksort, but bubblesort is more stable, even if it takes longer
}

function discernBlockCode(blockNode)
{
	//I will attempt to do this with a breadth-first examination of the ast
	for(var i = 0; i < blockNode.children.length; i++)
	{
		var codeCandidate = blockNode.children[i];
		produce6502(codeCandidate);
	}
}


//NOTE TO SELF: MODULARIZE EVERYTHING (if I have time)!!!!!!!!
function produce6502(node)
{
	if(node.name == "declare") //VarDecl production
	{
		var declareType = node.children[0];
		if(declareType.name == "int")
		{
		var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //6502 for loading the accumulator
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //Accumulator initially loaded with zero
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		var symbol = node.children[1]; //The object containing the symbol table entry
		var name = symbol.name.name;
		var scope = symbol.name.scope;
		var newSEntry = new staticTableEntry(name, scope, false);
		staticTable.push(newSEntry);
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //6502 for storing the accumulator
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), newSEntry.name.substr(0,2));
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), newSEntry.name.substr(2,2));
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		}
		else if(declareType.name == "string")
		{
			var symbol = node.children[1]; //The object containing the symbol table entry
			var name = symbol.name.name;
			var scope = symbol.name.scope;
			var newSEntry = new staticTableEntry(name, scope, true);
			staticTable.push(newSEntry);
		}
	}
	else if(node.name == "assign") //Id = Expr production
	{
		var assignValue = node.children[1].name; //Different values require different code
		//Check for digit
		if(validDigit.test(assignValue))
		{
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //6502 for loading the accumulator with constant
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + assignValue); //Store the single digit in a single byte
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //6502 for storing the accumulator
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			var theID = node.children[0];
			var foundID = searchSTable(theID); //Retrieve the temp location of the declared variable
			if(foundID !== null) //This should not(ie never) happen because we don't have forward declarations
			{	
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
		}
		//Check for op
		else if(assignValue == "+" || assignValue == "-")
		{
			produceAdditionCode(node.children[1], node.children[0].name); //The sign itself, then the ID it is being assigned to
		}
		//Check for bool
		else if(validTrue.test(assignValue) || validFalse.test(assignValue))
		{
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //6502 for loading the accumulator
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			if(assignValue == "true")
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "01"); //Stand-in for true
			else
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //Stand-in for false
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;	
			var foundID = searchSTable(theID); //Retrieve the temp location of the declared variable
			if(foundID !== null) //This should not(ie never) happen because we don't have forward declarations
			{	
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
		   
		}
		//Check for string
		else if(validAssignedString.test(assignValue))
		{
			var id = node.children[0].name;
			produceStringCode(assignValue, id);

		}
		//Check for id
		else if(validAlpha.test(assignValue))
		{
			//Look up temp location of ID that is on right of assignment
			var rightID = searchSTable(assignValue);
			if(rightID !== null) //This should not(ie never) happen because we don't have forward declarations
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "AD"); //6502 for loading the accumulator from memory
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				var tempLoc = rightID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //6502 for storing the accumulator
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				var theID = node.children[0].name;
				var foundID = searchSTable(theID); //Retrieve the temp location of the declared variable
				if(foundID !== null) //This should not(ie never) happen because we don't have forward declarations
				{	
					var tempLoc = foundID.name;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
				}
			}
			
		}	
	}	
	
	else if(node.name == "print") //print(Expr) production
	{
		var printCandidate = node.children[0]; //The expr being printed
		var printID = printCandidate;
		if(printCandidate.name == "+" || printCandidate.name == "-") //Printing the result of a more complicated equation
		{
			
			//Make new entry in static table?
			var id = "a" + ++addID; //An ID that is impossible in the regular grammar
			var newSEntry = new staticTableEntry(id, -1, false); 
			staticTable.push(newSEntry);
			produceAdditionCode(printCandidate, id);
			//Load into acc
			var foundID = searchSTable(id);
			if(foundID !== null)
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "AC"); //Load the y register from memory
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				produceIntPrintCode();
			}
		}
		else if(validAssignedString.test(printCandidate.name.name)) //Printing a single string
		{
			
			//Make new entry in static table?
			printStringLiteral = true;
			var id = "s" + ++stringID;
			var newSEntry = new staticTableEntry(id, -1, true);
			staticTable.push(newSEntry);
			produceStringCode(printCandidate.name, id);
			printStringLiteral = false;
			var foundID = searchSTable(id);
			if(foundID !== null)
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "AC"); //Load the y register from memory
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				produceStringPrintCode();
			}
		}
		else if(validAlpha.test(printCandidate.name.name)) //Printing the contents of single ID
		{
			var foundID = searchSTable(printCandidate);
			if(foundID !== null)
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "AC"); //Load the y register from memory
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				if(foundID.isPointer)
					produceStringPrintCode();
				else
					produceIntPrintCode();
			}
		}
		else if(validDigit.test(printCandidate.name)) //Printing a single digit
		{
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A0"); //Load the y register with a constant
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + printCandidate.name); //The digit
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			produceIntPrintCode();

		}

	}
	else if(node.name == "if" || node.name == "while") //if boolExpr { StatementList } production
	{
		discernControlCode(node);
	}
	
	else if(node.name == "block") //{ StatementList } production
	{
		discernBlockCode(node); 
	}
	
   
 }


//Used when a string is assigned to a variable, or a string is in a print statement
function produceStringCode(node, id)
{
	var nullTerminatedString = node; //00 to show string termination
	var heapReserve = nullTerminatedString.length; //Each character (in hex) will take one space in memory, plus 00 (null) for string termination
	var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //Load the acc with a constant(in this case 
																				//the pointer to the memory location with the first character of the string
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	newHeapStart = heapTracker - heapReserve - 1; //Where the heap will begin after writing the string into it (taking the null that was not in the original string into account)
	heapTracker = newHeapStart;
	var slicedString = nullTerminatedString.split(''); //Move individual characters of string into an array for easier (in my opinion) management
	var stringTracker = newHeapStart; //To be used within the loop below so to not alter newHeapStart variable
	//Iterate over the array to push the hex value of the ASCII values of the characters onto the heap 
	//(This is not really a push since I am starting from the index of the first character and moving forward) 
	//But I could make it an authentic push, if that is what you are into
	for(var k = 0; k < slicedString.length; k++)
	{
		var charToStore = slicedString[k].charCodeAt(0);
		var hexedCharToStore = charToStore.toString(16);
		opCodeEntry = new opCodeStreamEntry(stringTracker.toString(16), hexedCharToStore);
		//memLocTracker++;
		opCodeStream.push(opCodeEntry);
		stringTracker++;
	}
	//Now write the 00 to the end of the string
	opCodeEntry = new opCodeStreamEntry(stringTracker.toString(16), "00"); 
    //memLocTracker++;
	opCodeStream.push(opCodeEntry);
	//The data is the heap location where the first character of the string is stored	
	if(printStringLiteral)
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), (newHeapStart-4).toString(16)); //Subtract four for some strange reason (might be quirk of the OS)
	else
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), (newHeapStart-2).toString(16)); //Subtract two for some strange reason (might be quirk of the OS)												   
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	//6502 for storing the accumulator
	opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); 
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	//search static table for variable
	var theID = id;
	var foundID = searchSTable(theID); //Retrieve the temp location of the declared variable
	if(foundID !== null) //This should not(ie never) happen because we don't have forward declarations
	{	
		var tempLoc = foundID.name;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
	}
}

//Used when a digit op expr production is found within the AST
function produceAdditionCode(node, id)
{
	var theDigit = node.children[0];
	var assignValue = theDigit.name; //The digit
	totalSum += parseInt(assignValue); //Used for debugging to insure that the correct sum will eventually be calculated by the OS
	var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //6502 for loading the accumulator with constant
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + assignValue); //Store the single digit in a single byte
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	var theID = id;
	var foundID = searchSTable(theID); //Retrieve the temp location of the declared variable
	if(foundID !== null) //This should not(ie never) happen because we don't have forward declarations
	{	
		var tempLoc = foundID.name;
		//Right now, the tempLoc has a value of 0, so there is no harm in adding its contents to the acc
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "6D"); //6502 for adding contents of memory to acc, and keep in acc
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //6502 for storing the accumulator
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
	}
	var nextOp = node.children[1];
	if(nextOp.name == "+" || nextOp.name == "-")
	{
		//Keep going down
		produceAdditionCode(nextOp,id);
	}
	else //Only two digits are being added
	{
		var nextAssignValue = node.children[1].name;
		//IDs can only be the last adder in an IntExpr
		if(validAlpha.test(nextAssignValue))
		{
			var theID = nextAssignValue;
			var foundID = searchSTable(theID); //Retrieve the temp location of the declared variable
			if(foundID !== null) //This should not(ie never) happen because we don't have forward declarations 
			{
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "6D"); //6502 for adding contents of memory to acc, and keep in acc
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				theID = searchSTable(id);
				tempLoc = theID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //6502 for adding contents of memory to acc, and keep in acc
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
		}
		else
		{
		totalSum += parseInt(nextAssignValue);
		var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //6502 for loading the accumulator with constant
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + nextAssignValue); //Store the single digit in a single byte
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		//We already know the ID exists from checking the first added digit, so it is not necessary again
		var tempLoc = foundID.name;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "6D"); //6502 for adding contents of memory to acc, and keep in acc
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one bytes
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //6502 for storing the accumulator
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2));
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2));  
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
			}
	}
	totalSum = 0; //Reset for next addition
}

//Loads the X register with one, and makes a system call to tell OS to print integer contents of Y register
function produceIntPrintCode()
{
	var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A2"); //Load the x register with constant
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "01"); //Load 01 into x register
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "FF"); //System call
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
}

//Loads the X register with two, and makes a system call to tell OS to print string contents of the address in the Y register
function produceStringPrintCode()
{
	var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A2"); //Load the x register with constant
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "02"); //Load 01 into x register
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
	opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "FF"); //System call
	memLocTracker++;
	opCodeStream.push(opCodeEntry);
	if(inControl)
		jumpTracker++;
}

//Used to write code for equality comparisons within ifs and whiles, and makes entries in the jump table
function discernControlCode(node)
{
	var compareType = node.children[0];
	
	if(compareType.name == "isEqual") //Complicated equality expression
	{
		var expr1 = compareType.children[0]; //Left side of comparison
		var expr2 = compareType.children[1]; //Right side of comparison
		
		if(validTrue.test(expr2.name))
		{
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A9"); //6502 for loading the accumulator
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "01"); //Use 1 as a numeric representation of true
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			var id = "b" + ++stringID;
			var newSEntry = new staticTableEntry(id, -1, false);
			staticTable.push(newSEntry);
			var foundID = searchSTable(id);
			if(foundID !== null) //It should not be
			{
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "8D"); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
		}
		
		//Check for true/false
		if(validTrue.test(expr2.name) || validFalse.test(expr2.name))
		{
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A2"); //Load the x register with constant
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			if(expr2.name == "true")
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "01"); //Use 1 as a numeric representation of true
			else
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //Use 0 as a numeric representation of false
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "EC"); //Compare byte in memory to x register, set Z flag if equal
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			if (validTrue.test(expr1.name) || validFalse.test(expr1.name))
			{
				if(expr1.name == "true")
				{
					//Scan for id
					var id = "b" + ++boolID;
					var newSEntry = new staticTableEntry(id, -1, true);
					staticTable.push(newSEntry);
					var foundID = searchSTable(id);
					if(foundID !== null) //It should not be
					{ 
						var tempLoc = foundID.name;
						opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
						memLocTracker++;
						opCodeStream.push(opCodeEntry);
						if(inControl)
							jumpTracker++;
						opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
						memLocTracker++;
						opCodeStream.push(opCodeEntry);
						if(inControl)
							jumpTracker++;
					}
				}
				else
				{
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "7F"); //No matter the code, the data of location 7F will always be 0, so it is safe to use it 
					memLocTracker++;														//as a value for false
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //Load constant into x register
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
				}
					
			}
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "D0"); //Branch if z flag equals 0
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			var newJEntry = new jumpTableEntry();
			jumpTable.push(newJEntry);
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), newJEntry.name); //Branch if z flag equals 0
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
		}
		else if(validDigit.test(expr2.name)) //0 through 9
		{
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A2"); //Load the x register with constant
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
					jumpTracker++;
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + expr2.name); //Load constant into x register
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
					jumpTracker++;
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "EC"); //Compare byte in memory to x register, set Z flag if equal
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
					jumpTracker++;
			if(validAlpha.test(expr1.name)) //An ID
			{
				var foundID = searchSTable(expr1.name);
				if(foundID !== null)
				{
					var tempLoc = foundID.name;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
				}
			}
			
			else if(validDigit.test(expr2.name))
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + expr2.name); //"Hardwire" the digit into the image
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
			}
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "D0"); //Branch if z flag equals 0
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
					jumpTracker++;
			var newJEntry = new jumpTableEntry();
			jumpTable.push(newJEntry);
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), newJEntry.name); //Branch if z flag equals 0
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
					jumpTracker++;
		}
		
		else if(validAlpha.test(expr2.name)) //An ID
		{
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "AE"); //Load the y register from memory
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
					jumpTracker++;
			var foundID = searchSTable(expr1);
			if(foundID !== null) //This should not happen, but just to be safe
			{
				var tempLoc = foundID.name;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "EC"); //Compare byte in memory to x register, set Z flag if equal
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			if(validAlpha.test(expr2.name)) //An ID
			{
				foundID = searchSTable(expr2);
				if(foundID !== null)
				{
					var tempLoc = foundID.name;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(0,2)); //Split into two hex digits so it can fit it one byte
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
					opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), tempLoc.substr(2,2)); //Split into two hex digits so it can fit it one byte
					memLocTracker++;
					opCodeStream.push(opCodeEntry);
					if(inControl)
						jumpTracker++;
				}
			}
			else if(validDigit.test(expr2.name))
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "0" + expr2.name); //"Hardwire" the digit into the image
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "D0"); //Branch if z flag equals 0
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			var newJEntry = new jumpTableEntry();
			jumpTable.push(newJEntry);
			opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), newJEntry.name); //Branch if z flag equals 0
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
		   }
		}
	else //Simple true/false
	{
		
			var opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "A2"); //Load the x register with constant
			memLocTracker++;
			opCodeStream.push(opCodeEntry);
			if(inControl)
				jumpTracker++;
			if(compareType.name == "true")
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "01"); //Load constant into x register
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
			else
			{
				opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //Load constant into x register
				memLocTracker++;
				opCodeStream.push(opCodeEntry);
				if(inControl)
					jumpTracker++;
			}
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "EC"); //Load the x register with constant
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "7F"); //No matter the code, the data of location 7F will always be 0, so it is safe to use it 
		memLocTracker++;														//as a value for false
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "00"); //Load constant into x register
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), "D0"); //Branch if z flag equals 0
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
		var newJEntry = new jumpTableEntry();
		jumpTable.push(newJEntry);
		opCodeEntry = new opCodeStreamEntry(memLocTracker.toString(16), newJEntry.name); //Branch if z flag equals 0
		memLocTracker++;
		opCodeStream.push(opCodeEntry);
		if(inControl)
			jumpTracker++;
	}
	inControl = true;
	discernBlockCode(node.children[1]);
	inControl = false;
}

//Uses the static and jump tables to insert the proper addresses to replace temp memory locations
function backpatch(code)
{
	stackTracker = memLocTracker;
	for(var i = 0; i < staticTable.length; i++)
	{
		var tempAddr = staticTable[i].name; 
		scanToChangeAddr(tempAddr);
	}
	for(var k = 0; k < jumpTable.length; k++)
	{
		var tempDistance = jumpTable[k].name;
		scanToChangeJump(tempDistance);
	}
	
	//Include some kind of resort to get memLocs in order
}

//Searches the current source code, and replaces any instances of the temp address argument with the stackTracker counter
function scanToChangeAddr(addr)
{
	for(var j = 0; j < opCodeStream.length; j++)
	{
		var slot = opCodeStream[j];
		var halfAddr = addr.substr(0,2); //T0, T1, T2, ...
		if(slot.data == halfAddr) //Only match first two because second half is always "XX"
		{
			opCodeStream[j].data = stackTracker.toString(16); //Using Little Endian notation 
			opCodeStream[j+1].data = "00";
			//Change in static table as well
		}
	}
	stackTracker++; //Move to next byte for next static entry
}

//Searches the current source code, and replaces any instances of the temp jump argument with the jumpTracker counter
function scanToChangeJump(distance)
{
	for(var i = 0; i < opCodeStream.length; i++)
	{
		var slot = opCodeStream[i];
		if(slot.data == distance)
		{
			var jump = jumpTracker;
			var intJump = parseInt(jump);
			if(intJump < 16) //Only one hex digit
				intJump = "0" + intJump.toString(16); //The jump distance needs to take up one whole byte in memory, so this adds the second byte
			else
				intJump = intJump.toString(16); //> 16 becomes two hex digits, which fills the entire byte
			opCodeStream[i].data = intJump;
			
			//Change in jumptable as well 
		}
	}
}

//Fills any unused faces (between 0 and 127) with 00, the break opcode, to prevent viruses from being injected onto this rudimentary system
function fillOut(code)
{
	for(var i = stackTracker - 1; i <= newHeapStart - 1; i++)
	{
		var opCodeEntry = new opCodeStreamEntry(i.toString(16), "00")
		opCodeStream.push(opCodeEntry);
	}
}


//Rearranges the code to follow the proper memory location order
//This is only really necessary because strings are involved, because
//while they are given the proper locations (in the heap), they are
//pushed onto the stack in place, and as such are not at the end
//where they should be
//Credit for this goes to Stoimen's Web Blog
function bubbleSort(code)
{
    var swapped;
    do {
        swapped = false;
        for (var i=0; i < code.length-1; i++) {
            if (parseInt(code[i].memLoc,16) > parseInt(code[i+1].memLoc,16)) {
                var temp = code[i];
                code[i] = code[i+1];
                code[i+1] = temp;
                swapped = true;
            }
        }
    } while (swapped);
}

//Scans the static table to see if an entry has already been declared
function searchSTable(id)
{
	for(var k = 0; k < staticTable.length; k++)
	{
		var sEntry = staticTable[k];
		//A -1 scope defines a string or sum literal that is being printed
		/*
		if((sEntry.variable == id || sEntry.variable == id.name || sEntry.variable == id.name.name) && (sEntry.scope == id.scope || sEntry.scope == id.name.scope || sEntry.scope == -1)) //Check for scope as well
			return sEntry;
		*/
		if(sEntry.variable == id && sEntry.scope == -1)
			return sEntry;
		else if(typeof id.name !== "undefined" && sEntry.variable == id.name && sEntry.scope == id.scope)
			return sEntry;
		else if(typeof id.name !== "undefined" && typeof id.name.name !== "undefined" && sEntry.variable == id.name.name && sEntry.scope == id.name.scope)
			return sEntry;
	}
}


//Print the code so it can be transfered to the OS
function printCode(codeArray)
{
	var code = "";
	for(var k = 0; k < codeArray.length; k++)
	{
		var the6502 = codeArray[k].data;
		code += the6502;
		code += " ";
	}
	return code;
}
