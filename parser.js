/* parser.js 
   Uses the recursive descent methodology,
   which is amazing if the recursion is implemented
   properly. Otherwise, be prepared to vigorously
   punch through the monitor until your hand is covered
   in a mess of blood and wires*/

// Global variables
 var tokens = "";
 var tokenIndex = 0;
 var currentToken = "";
 var lineNum = 0;
 var errorCount = 0;
 var EOF = "$"; 
 var trueTokenStream = [];
 //var symbolTable = []; //Rudimentary for now
 
 var leftBraceCount = 0; //Used in balancing statements
 var rightBraceCount = 0; //Used in balancing statements
 var numStatementLists = 0; //Used in balancing statements
  						//Incremented by 1 when left brace is matched, decremented by 1 when right brace is matched
							//If this is > 0 by the time the EOF is detected, an error is thrown
var cstStmtLists = 0; //Used in closing off branches of CST. Increased when a recursive call to statement list is made
var currentScopeLevel = -1; //When a curly brace is detected, the scope level is increased by one 
							//Start at -1 so when the first scope is detected, increase it to zero to make all of the computer scientists happy
							
var inPrintExpr = false; //To determine whether or not if an ID is found if it should be assigned
var inIntExpr = false; //To determine whether on not arithmetic (+ or -) should be carried out
var inBooleanExpr = false; //Ifs and whiles have different structures than regular statement lists
var inAssignExpr = false; //Used mostly to assign the value of an ID to another ID
var expr1Value; //Used in determining equality for boolean expressions
var expr2Value; //Ditto

var scopeTbl;
var currSymbol;
var symIntValue = 0;
var symStringValue = "";
	
    function parse(tokenStream)
    { 
        putMessage("Parsing [" + tokens + "]");
		/*Because Javascript arrays function like stacks, it is
		  necessary to reverse the array in order to start from the
		  beginning. Otherwise, the EOF symbol will be the first
		  character parsed
		*/
		trueTokenStream = tokenStream.reverse();
		// Update positions?
		confirmPosition();
        // Grab the next token.
        currentToken = getNextToken();
        // A valid parse derives the P(rogram) production, so begin there.
        parseProgram();
		// Perform type checking and variable usage
		tableAnalysis();
        // Report the results.
        putMessage("Parsing found " + errorCount + " error(s).");   
		if(errorCount == 0)
			return;
    }
	
	//A Program can only begin with a statement, so check for that next
	function parseProgram()
	{
		csTree = new Tree();
		csTree.addNode("program", "branch");
		parseStmt();
		checkEOF();
		if(numBlocks > 0 || trueTokenStream.length === 0) //Unbalanced braces have been detected
		{
			if(document.getElementById("mode").checked == true)
			{
				putMessage("You haz error: No haz right amount of squigglies");
				errorCount++;
				return;
			}	
			putMessage("Error: Imbalanced braces detected");
			errorCount++;
		}
	}
	
	//A Statement can be one of four types
	function parseStmt()
	{	
		csTree.addNode("statement", "branch");
		matchSTokenType(currentToken.type);
	}	
	
	//A StatementList is a Statement followed by a StatementList, or the empty set epsilon
	function parseStmtList()
	{
		//Check for closing brace
		
		if(currentToken.value === "}") 
		{
			symbolTables.endChildren();
			//numStatementLists--;
			numBlocks--;
			csTree.addNode("epsilon", "leaf"); //Empty set
			while(csTree.cur.parent.name == "statementlist") //Once the parent is a statement, we know that we reached the beginning of the block
				csTree.endChildren();
			currentScopeLevel--; 
			csTree.endChildren(); //Set it to the parent of the statement, a statement list, which has only one child at this time
			csTree.addNode("}", "leaf");
			//numBlocks--;
			csTree.endChildren();
			if(numBlocks == 0)
			{
				currentToken = getNextToken(); //It better be the EOF meta-symbol
				if(currentToken.value === "$")
					return;
			}
			if(csTree.cur.name == "program")
			{
				currentToken = getNextToken(); //It better be the EOF meta-symbol
				if(currentToken.value === "$")
					return;
			}
			scopeTbl = symbolTables.cur.name;
			csTree.addNode("statementlist", "branch"); //Add the second child to the statementlist
			currentToken = getNextToken(); 
			parseStmtList();
			
			if(numBlocks < 0) //Imbalanced braces = parse error
			{
				putMessage("Error: Imbalanced braces detected at line " + currentToken.lineNum);
				errorCount++;
				tokenIndex--;
				currentToken = getNextToken();
				if(currentToken.value === "$")
					return;
				//currentToken = getNextToken();
			}
		}
		
		if(currentToken.value === "$")
			return;
		//if
			parseStmt(); //Call recursively
			//if(numBlocks == 0)
				//return;
			if(numBlocks !== 0)
			{
				csTree.addNode("statementlist", "branch");
				cstStmtLists++;
			}
			parseStmtList();
		//else
			//Epsilon - production that contains the empty set
		
	}
	
	//An Expr can be one of three types
	function parseExpr(op)
	{
		csTree.addNode("expr", "branch");
		matchETokenType(currentToken.type, op); //Switch statement
	}
	
	
	//An IDExpr can only begin with an ID, so check for that first
	function parseIDExpr(op)
	{
		parseID();
		currentToken = getNextToken(); //Hopefully an assignment
		if(currentToken.value === "=")
		{
			currentToken = getNextToken(); //Int, char or quotation mark (for charlist)
			csTree.addNode("=", "leaf");
			//inAssignExpr = true;
			parseExpr(op);
		}
		else
		{
			if(document.getElementById("mode").checked == true)
			{
				putMessage("You haz errorz at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Ur IDExpr no haz assignment");
				errorCount++;
				return;
			}
			putMessage("Parse error at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : A valid IDExpr must contain an assignment");
			errorCount++;
		}
	}
	
	//An IntExpr must begin with a digit
	//Follows standard algebraic conventions 
	function parseIntExpr(op)
	{
		if(validDigit.test(currentToken.value))
		{
			if(typeof currSymbol !== "undefined")
			{
				if(currSymbol.scope !== currentScopeLevel) //Can redeclare same variable in different scopes; this primes it to do so
					symIntValue = 0;
			}
			if(inBooleanExpr) //This keeps track of multiple additions/subtractions when checking for equality
			{
				symIntValue += currentToken.value;
			}
			else if(!inPrintExpr)
			{
				if(currSymbol.value == null)
					symIntValue = 0;
				symIntValue += currentToken.value;
				currSymbol.value = symIntValue;
			}
			csTree.addNode("digit", "branch");
			csTree.addNode(currentToken.value.toString(), "leaf");
			csTree.endChildren(); //A digit is a terminal, so it is impossible for it to have children in a cst
			//csTree.endChildren();
			currentToken = getNextToken(); //Op or nothing
			var addOrSub = currentToken.value;
			if(addOrSub === "+")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("I haz a plus sign");
					//currentCST.children.push('+');
					csTree.addNode("op", "branch");
					csTree.addNode("+", "leaf");
					csTree.endChildren(); //Terminal
					currentToken = getNextToken();
					parseExpr("+");
					csTree.endChildren();
				}
				else
				{
					putMessage("Got a plus sign");
					//currentCST.children.push('+');
					csTree.addNode("op", "branch");
					csTree.addNode("+", "leaf");
					csTree.endChildren(); //Terminal
					currentToken = getNextToken();
					inAssignExpr = true;
					parseExpr("+");
					csTree.endChildren();
				}
			}
			else if(addOrSub === "-")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("I haz a minus sign");
					//currentCST.children.push('-');
					csTree.addNode("op", "branch");
					csTree.addNode("-", "leaf");
					csTree.endChildren(); //Terminal
					currentToken = getNextToken();
					parseExpr("-");
					csTree.endChildren();
				}
				else
				{
					putMessage("Got a minus sign");
					//currentCST.children.push('-');
					csTree.addNode("op", "branch");
					csTree.addNode("-", "leaf");
					csTree.endChildren(); //Terminal
					currentToken = getNextToken();
					parseExpr("-");
					csTree.endChildren();
				}
			}
			else
			{
				trueTokenStream.push(currentToken);
				csTree.endChildren();
				if(currSymbol != null && !inBooleanExpr)
				{
					currSymbol.value = symIntValue;
				}
				else if(inBooleanExpr)
				{
					if(expr1Value == null)
					{
						expr1Value = symIntValue;
						//trueTokenStream.push(currentToken);
						//csTree.endChildren();
						symIntValue = 0;
					}
					else
					{
						expr2Value = symIntValue;
						//trueTokenStream.push(currentToken);
						//csTree.endChildren(); 
						symIntValue = 0;
					}
				}
			}
 		}
	}
	
	//A CharExpr begins with quotation marks (Soon to be StringExpr)
	function parseStringExpr(op)
	{
		//if(currSymbol.value == null)
			//symStringValue = "";
		currentToken = getNextToken(); //First character after double quotes
		match();
		parseCharList();
	}
	
	var finished = false;
	//A CharList is contained within quotation marks, and is composed of a character followed by a character list, or the empty set epsilon
	function parseCharList()
	{
		csTree.addNode("charlist", "branch");
		while(currentToken.value !== '"')
		{
			if(validAlpha.test(currentToken.value) || currentToken.value == " ")
			{
				symStringValue += currentToken.value;
				currentToken = getNextToken();
			}
			else
			{
				putMessage("Parse error at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : CharList contains invalid character");
				errorCount++;
				currentToken = getNextToken();
			}
		}
		
		symStringValue = symStringValue.toString();
		if(!inPrintExpr)
			currSymbol.value = symStringValue;
		//updateTable(currSymbol);
		csTree.addNode(symStringValue, "leaf");
		csTree.endChildren();
		csTree.addNode("\"", "leaf");
		csTree.endChildren();
		symStringValue = "";
	}
	
	//A BooleanExpr can be either the evaluation of equality between two exprs, or a simple true or false
	function parseBooleanExpr(type)
	{
		if(type == "bool") //Solely 'true' or 'false'
		{
			csTree.addNode("boolval", "branch");
			csTree.addNode(currentToken.value.toString(), "leaf");
			csTree.endChildren(); //A boolval can only have one child
			csTree.endChildren();
			//csTree.endChildren();
		}
		else //A parentheses denoting a more complicated evaluation of equality for two exprs
			 //(Only IntExpr and BooleanExpr can be evaluated this way)
		{
			csTree.addNode("(", "leaf");
			currentToken = getNextToken(); //First of Expr
			//csTree.addNode("expr", "branch");
			parseExpr();
			currentToken = getNextToken(); //Hopefully the equality sign
			if(currentToken.value !== "==")
			{
				putMessage("Parse error at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Boolean expression does not check for equality");
				errorCount++;
				currentToken = getNextToken();
			}
			else
			{
				csTree.addNode("==", "leaf");
				currentToken = getNextToken(); //First of Expr
				//csTree.addNode("expr", "branch");
				parseExpr();
				currentToken = getNextToken(); //Closing parens 
				csTree.addNode(")", "leaf");
				csTree.endChildren();
			}
		}
	}
	
	//A VarDecl can begin with 'int' or 'char'
	function parseVarDecl()
	{
		//putMessage("Expecting a type declaration");
		if(validInt.test(currentToken.value) || validString.test(currentToken.value))
			{
				putMessage("Got a type declaration");
				var type = currentToken.value; 
				csTree.addNode("type", "branch");
				csTree.addNode(type.toString(), "leaf");
				csTree.endChildren(); //'int' or 'char' is non-terminal, so children are impossible in a CST
				currentToken = getNextToken(); //The actual identifier (maybe?)
				parseID(type);
				csTree.endChildren();
			}
		else
		{
			if(document.getElementById("mode").checked == true)
			{
				putMessage("You haz errorz at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Ur op no iz plus or minus");
				errorCount++;
				return;
			}
			putMessage("Parse error at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Invalid identifier found");
			errorCount++;
		}	
		
	}
	
	function parseID(type, op)
	{
		putMessage("Expecting an ID");
		if(validAlpha.test(currentToken.value))
		{
			putMessage("Found an ID");
			csTree.addNode("id", "branch");
			csTree.addNode("char", "branch");
			//csTree.addNode(currentToken.value.toString(), "leaf");
			//csTree.endChildren();
			//csTree.endChildren(); //The char representing the id is a terminal, so children are impossible in a CST
			var occurs = checkForPresence(type, currentToken);
			if (typeof occurs == "undefined")
			{
				putMessage("Error at line " + currentToken.lineNum + ": Undeclared identifier found");
				errorCount++;
			}
			else if(!occurs)
			{
				var newEntry = new symbolTableEntry(type, currentToken);
				scopeTbl.residents.push(newEntry);
				putMessage(type + " " + currentToken.value + " added to symbol table");
				csTree.addNode(newEntry, "leaf");
				currSymbol = newEntry;
				csTree.endChildren();
				csTree.endChildren(); //The char representing the id is a terminal, so children are impossible in a CST
			}
			else if(occurs)
			{
				
				if(inAssignExpr)
				{
					var reassignedSym = retrieveSymbol(currentToken.value);
					currSymbol.value += reassignedSym.value;
					inAssignExpr = false;
				}
				
				
				//if(!inIntExpr) //This needs to be changed
					currSymbol = retrieveSymbol(currentToken.value); //Just to be safe
					
				csTree.addNode(currSymbol, "leaf");	
				csTree.endChildren();
				csTree.endChildren();
				
				//if(inIntExpr)
					//symIntValue += currSymbol.value;
				
				//Redeclared ID within same scope
				
				if(currSymbol.isUsed == true && currSymbol.value != null && !inPrintExpr && !inIntExpr && !inBooleanExpr && currSymbol.scope == currentScopeLevel) 
				//As you can see, I am very strict with my checks
				//Do I need this if I do this in symbol table scan as well?
				{
					putMessage("Error at line " + currentToken.lineNum + ", position " + currentToken.currentTokenIndex + ": Symbol " + currentToken.value + " has already been declared in the current scope.");
				    errorCount++;
				}
				
				//scopeTbl.residents[currentToken].isUsed = true;
				/*
				if(inIntExpr && !inPrintExpr)
				{
					//currSymbol = retrieveSymbol(currentToken.value); //Just to be safe
					var idValue = lookupForIntExpr(currentToken.value.toString());
					if(op == "+")
						symIntValue += idValue;
					else if(op == "-")
						symIntValue -= idValue;
					currSymbol.value = symIntValue;
				}
				*/
			}
		}
		else
		{
			if(document.getElementById("mode").checked == true)
			{
					putMessage("You haz errorz at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Ur ID haz wrong char");
					errorCount++
					return;
			}
			putMessage("Parse error at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : ID is an invalid character");
			errorCount++;
		}
	}
	
	//If and While are basically same sans the first keyword, so should I combine them into one?
	
	//An if statement is composed of the keyword if, followed by a boolean expression evaluation, followed by a statement list
	function parseControlStmt()
	{
		currentToken = getNextToken();
		csTree.addNode("boolexpr", "branch");
		inBooleanExpr = true;
		parseBooleanExpr(currentToken.type);
		inBooleanExpr = false;
		//currentToken = getNextToken(); 
		match();
		currentToken = getNextToken(); //The braces denoting a statement list
		csTree.addNode("{", "leaf");
		//numStatementLists++;
		currentScopeLevel++;
		numBlocks++;
		match();
		csTree.addNode("statementlist", "branch");
		scopeTbl = new scopeTable(); //By creating this, we assume that the program will include IDs
														 //Note: this should (will) not be created on when an ID (char) is found because the grammar does not support forward referencing for variables
		symbolTables.addTable(scopeTbl); 
		currentToken = getNextToken(); //The first statement within the list
		parseStmtList();
	}
	
	//"Global" function that matches (and hopefully confirms) expected character for parsing
	function match(type)
	{
		switch(type)
		{
			/*
			case "digit":	if(validDigit.test(currentToken.value))
							{
								if(document.getElementById("mode").checked == true)
								{
									putMessage("I can haz digit");
									break;
								}	
								putMessage("Got a digit");
								break;
							}
							
			case "op":		if(currentToken.value === '+' || currentToken.value === '-')
							{
								if(document.getElementById("mode").checked == true)
								{
									putMessage("I can haz op");
									break;
								}	
								putMessage("Got an op");
								break;
							}
							
			case "char":	if(validAlpha.test(currentToken.value))
							{
								if(document.getElementById("mode").checked == true)
								{
									putMessage("I can haz char");
									break;
								}	
								putMessage("Got an char");
								break;
							}
							
			case "typeID":	if(validInt.test(currentToken.value) || validChar.test(currentToken.value))
							{
							if(document.getElementById("mode").checked == true)
								{
									putMessage("I can haz typeID");
									break;
								}	
								putMessage("Got a typeID");
								break;
							}
							
			case "special":	if(currentToken.value == '"')
							{
								putMessage("Got a quotation mark");
								break;
							}
							else if(currentToken.value == '=')
							{
								putMessage("Got an assignment");
								break;
							}
							else if(currentToken.value == "(")
							{
								putMessage("Got a left parens");
								break;
							}
							else if(currentToken.value == ")")
							{
								putMessage("Got a right parens");
								break;
							}
							else if(currentToken.value == "{")
							{
								putMessage("Got a left brace");
								break;
							}
							else if(currentToken.value == "}")
							{
								putMessage("Got a right brace");
								break;
							}
							else if(currentToken.value == "P")
							{
								putMessage("Got a print command");
								break;
							}
							//break;
			default:		putMessage("Error: Invalid token found");
							errorCount++;
							break;
							
			*/
		}
	}
	
	//Determines which of the four types of statements is being parsed
	function matchSTokenType(type)
	{
		switch(type)
		{ 
			//Uppercase P
			case "print":	putMessage("Expecting a print command");
							match();
							csTree.addNode("print", "leaf");
							currentToken = getNextToken();	//Opening parens
							putMessage("Expecting a left parens");
							match();
							csTree.addNode("(", "leaf");
							inPrintExpr = true;
							currentToken = getNextToken(); //First token after parens
							if(codeLines.length == 1) //Programs can be only one line, unbound by braces
							{
								scopeTbl = new scopeTable(); //By creating this, we assume that the program will include IDs
														 //Note: this should (will) not be created on when an ID (char) is found because the grammar does not support forward referencing for variables
							    symbolTables.addTable(scopeTbl); 
								//currentScopeLevel++;
							}
							parseExpr();
							putMessage("Expecting a right parens");
							currentToken = getNextToken();
							match();
							//pCST.children.push(')');
							if(currentToken.value != ")")
							{
								putMessage("Error: Expected right parens not found.");
								errorCount++;
							}
							csTree.addNode(")", "leaf");
							csTree.endChildren();
							//if(numBlocks == 0) //Just in case
								//break;
							//else
							{
								inPrintExpr = false;
								currentToken = getNextToken();
								break;
							}
			//Any lowercase English letter
			case "char":	putMessage("Expecting a character");
							match();
							if(codeLines.length == 1) //Programs can be only one line, unbound by braces
							{
								scopeTbl = new scopeTable(); //By creating this, we assume that the program will include IDs
														 //Note: this should (will) not be created on when an ID (char) is found because the grammar does not support forward referencing for variables
							    symbolTables.addTable(scopeTbl); 
								//currentScopeLevel++;
							}
							parseIDExpr();
							csTree.endChildren();
							currentToken = getNextToken();
							break;
			//"int" or "string" or "bool"(char deprecated as of Project 2)
			case "typeID":	putMessage("Expecting a type declaration"); 
							match();
							csTree.addNode("vardecl", "branch");
							if(codeLines.length == 1) //Programs can be only one line, unbound by braces
							{
								scopeTbl = new scopeTable(); //By creating this, we assume that the program will include IDs
														 //Note: this should (will) not be created on when an ID (char) is found because the grammar does not support forward referencing for variables
							    symbolTables.addTable(scopeTbl); 
								//currentScopeLevel++;
							}
							parseVarDecl();
							csTree.endChildren();
							currentToken = getNextToken();
							break;
			//"if" or "while" statement
			case "control": putMessage("Expecting a control statement");
							match();
							//scopeTbl = new scopeTable(); //By creating this, we assume that the program will include IDs
														 //Note: this should (will) not be created on when an ID (char) is found because the grammar does not support forward referencing for variables
							    //symbolTables.addTable(scopeTbl); 
							if(currentToken.value == 'if')
							{
								csTree.addNode("ifstatement", "branch");
								csTree.addNode("if", "leaf");
							}
							else 
							{
								csTree.addNode("whilestatement", "branch");
								csTree.addNode("while", "leaf");
							}
							parseControlStmt();
							csTree.endChildren();
							currentToken = getNextToken();
							break;
			//Opening brace
			case "special": //Match opening brace
							if(currentToken.value === "{")
							{
								//numStatementLists = 0;
								putMessage("Expecting a left brace");
								//leftBraceCount++;
								csTree.addNode('{', "leaf");
								//csTree.endChildren(); 
								numStatementLists++;
								numBlocks++;
								currentScopeLevel++;
								match();
								csTree.addNode("statementlist", "branch");
								
								scopeTbl = new scopeTable(); //By creating this, we assume that the program will include IDs
														 //Note: this should (will) not be created on when an ID (char) is found because the grammar does not support forward referencing for variables
							    symbolTables.addTable(scopeTbl); 
								//numOfScopes++;
								currentToken = getNextToken();
								parseStmtList();
								
							}
							else //Assume that it is a right brace
							{
								currentToken = getNextToken();
								//errorCount++;
							}
							break;
			case "eof":		break; //Just to be safe
			default:		if(document.getElementById("mode").checked == true)
							{
								putMessage("You haz errorz at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Ur statement no haz right starting char");
								errorCount++
								break;
							}
							putMessage("Parse error at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Statement can only begin with P, {, int, char or a valid ID");
							currentToken = getNextToken();
							errorCount++;
							break;
			
		}
	}
	
	//An expr can begin with a digit, op (+ or -), or a quotation mark
	function matchETokenType(type, op)
	{
		switch(type)
		{
			//0 through 9
			case "digit":	putMessage("Got a digit");
							csTree.addNode("intexpr", "branch");
							inIntExpr = true;
							parseIntExpr(op);
							//currentToken = getNextToken();
							inIntExpr = false;
							csTree.endChildren();
							break;
			//Any lowercase English letter
			case "char":	putMessage("Got a character");
							parseID(type, op);
							//currentToken = getNextToken();
							csTree.endChildren();
							break;
			//Opening double quotes to denote StringExpr
			case "quotes":	putMessage("Got a character list");
							match();
							csTree.addNode("stringexpr", "branch");
							csTree.addNode("\"", "leaf");
							//csTree.endChildren(); //A quotation mark is a terminal, so it is impossible to have children in a cst
							parseStringExpr(op);
							csTree.endChildren();
							//currentToken = getNextToken();
							break;
			//Opening parentheses to denote boolean expression
			case "special": putMessage("Got a boolean expression");
							match();
							csTree.addNode("booleanexpr", "branch");
							csTree.addNode("(", "leaf");
							inBooleanExpr = true;
							parseBooleanExpr(type);
							inBooleanExpr = false;
							csTree.endChildren();
							break;
			//'true' or 'false' to denote boolean expression
			case "bool":	putMessage("Got a boolean expression");
							match();
							csTree.addNode("booleanexpr", "branch");
							//csTree.addNode("boolval", "branch");
							inBooleanExpr = true;
							parseBooleanExpr(type);
							inBooleanExpr = false;
							csTree.endChildren();
							break;
			default:		if(document.getElementById("mode").checked == true)
							{
								putMessage("You haz errorz at line " + currentToken.lineNum + " index " + currentToken.currentTokenIndex + " : Ur expr no haz right starting char");
								errorCount++
								breakl
							}
							putMessage("Parse error at line " + currentToken.lineNum +  " index " + currentToken.currentTokenIndex +" : Expr can only begin with a digt, char or a quotation mark");
							errorCount++;
							break;
		}
	}
	
	//A Program must end with the end of file marker($)
	function checkEOF()
	{
		var eof = trueTokenStream.pop() //If everything is correct, the EOF symbol '$' should be the final item in the stream
		if(eof.value !== EOF)
		{
			if(document.getElementById("mode").checked == true)
					putMessage("");
			putMessage("Warning: End of file denoter not found.");
			errorCount++;
		}
		trueTokenStream.push(eof); //Push it back on to make sure it fits with checkEOF.
	}
    
	//Retrieves the next token in the token stream
    function getNextToken()
    {
        var thisToken = EOF;    // Let's assume that we're at the EOF.
        if (tokenIndex < tokens.length)
        {
            // If we're not at EOF, then return the next token in the stream and advance the index.
			thisToken = trueTokenStream.pop(); //Then push into another stream for a second pass?
            //thisToken = tokens[tokenIndex];
            putMessage("Current token:" + thisToken.value.toString());
            tokenIndex++;
			if(thisToken.value == EOF)
			{
				trueTokenStream.push(thisToken); //Push it back on to make sure it fits with checkEOF.
				checkEOF();
			}
        }
        return thisToken;
    }
	
	//Assigns correct position to tokens (my lexer is not perfect at this)
	function confirmPosition()
	{
		for (var i = 0; i < trueTokenStream.length; i++)
		{
			trueTokenStream[i].position = trueTokenStream.length - i - 1;
		}
	}
	
