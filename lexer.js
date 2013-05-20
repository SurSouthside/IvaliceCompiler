/* lexer.js  */

//Regular expressions
var validAlphabet = /[abcdefghijklmnopqrstuvwxyz0123456789P$(){}="+-\\n\s]{1}/; //All characters usable in grammar (EOF is not really a token, but treating it as one makes lexing easier)
var validDigit = /[\d]{1}/; //0 through 9
var validWhiteSpace = /[\s]{1}/;  //Whitespace
var validAlpha = /[a-z]{1}/; //Lowercase only (with one exception)
var validInt = /[int]/; //Keyword
var validString = /[string]/; //Keyword 
var validChar = /[char]/; //Keyword (Deprecated as of Project 2)
var validPrint = /[print]/; //Keyword
var validWhile = /[while]/; //Keyword
var validIf = /[if]/; //Keyword
var validBoolean = /[boolean]/; //Keyword
var validTrue = /(^|\s)(true)(\s|$)/; //Keyword (before, my regex would just match any occurence of t,r,u or e; this version is much tighter)
var validFalse = /(^|\s)(false)(\s|$)/; //Keyword (before, my regex would just match any occurence of f,a,l,s or e; this version is much tighter)

//Globals
var sourceCode = "";
var tokenStream = [];
//var partialTokenStream = [];
var codeLine = "";
var codeLines = [];
var pushToStream = "";
var currentTokenIndex = 0;
var nextTokenIndex = 1;
var lineNum = 0;
var totalIndex = 0;
var tokenTracer = 0; //For use in the for loop to lex a given line. I would use the regular loop character if each token was only one character.
  				 //However, the presence of 'int' and 'char' throw that off, so I am using a tracker instead. 

var totalErrors = 0;
var position = 0; //The position of a given token throughout entireity of source code
var foundEOF = false; //Used to detect presence of EOF meta-token (whether or not it is found at the end of the source code)

//Spaces aren't tokens
//Spaces aren't tokens
var inCharList = false;

	function Token() //Class for tokens
	{
		//this.lineNum = -1;
		this.name = "";
		this.type = null;
		this.value = null;
		this.lineNum = lineNum;
		this.currentTokenIndex = currentTokenIndex;
		this.position = position;
	}
	/*
		Lex checks "words", not "sentences"
	*/
    function lex()
    {
        // Grab the "raw" source code.
        sourceCode = document.getElementById("taSourceCode").value;
        // Trim the leading and trailing spaces.
        sourceCode = trim(sourceCode);
		/*Check to see if the user added a $ at the end to denote code termination
		  If not, add it for the
		*/
		var eof = sourceCode.charAt(sourceCode.length - 1);
		if(eof != '$')
		{
			sourceCode = sourceCode + '$';
			if(document.getElementById("mode").checked == true)
			{
				putMessage("You no haz dollar sign at end of code, so I putz there");
			}
			else
				putMessage("You forgot to include a $ at the end of the program, so I appended one for you.");
	    }
		
        // TODO: remove all spaces in the middle; remove line breaks too. (Line breaks now, internal spaces later)
		codeLines = sourceCode.split("\n");
		
		for(var i = 0; i < codeLines.length; i++)
		{
			if(!foundEOF)
			{
			lineNum = i;
			codeLine = codeLines[i];
			//Eliminate internal spaces
			codeLine = killSpaces(codeLine);
			tokenize(codeLine); 
			if(inCharList)
			{
				putMessage("Error on line " + i + ": Charlist cannot contain a line break.");
				totalErrors++;
			}
			currentTokenIndex = 0;
			nextTokenIndex = 1;
			}
			else
				return;
		}
		/*
		while (currentTokenIndex < sourceCode.length) //Traverse source code one character at a time to determine tokens
		{
			var theChar = new Token();
			theChar.value = sourceCode[currentTokenIndex];
			
			/*Check to see if token is valid in character alphabet for grammar
			  Otherwise, notify user and stop execution
			 
			
			//var validChar = validAlphabet.test(theChar);
			if(validAlphabet.test(theChar) === false)
			{
				putMessage("Error at line " + lineNum + ", lineIndex " + theChar.lineIndex + ": Invalid character found.");
				totalErrors++;
				//return sourceCode;
		    }
			else
				lexToken(theChar);
				
			currentTokenIndex++;
			nextTokenIndex++;
			lineIndex++;
		}
		*/
		if(document.getElementById("mode").checked == true)
		{
			putMessage("Lex returned thiz many errorz:" + totalErrors);
			//tokenStream = tidyTS(); //Utility function to clean up source code
			return sourceCode;
		}
		else
		{
			putMessage("Lex returned " + totalErrors + " error(s).");
			//tokenStream = tidyTS(); //Utility function to clean up source code
			return sourceCode;
		}
		
    }
	
	//Prepares line of code for more precise lexing
	//Checks for invalid characters in grammar 
	function tokenize(lineOfCode)
	{
		
		for(currentTokenIndex; currentTokenIndex < lineOfCode.length; currentTokenIndex = currentTokenIndex) //Change to index?
		{	
			if(!foundEOF)
			{
				//lineOfCode = codeLine;
				var theChar = new Token();
				theChar.value = lineOfCode[currentTokenIndex];
				//var is = validAlphabet.test(theChar.value) // For some reason, this is always true
				if(validAlphabet.test(theChar.value) == false) //There may be a bug here that causes a stack overflow error when the character is invalid(or Firefox just sucks for some reason)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement no haz right char");
					return;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid character found.");
				totalErrors++;
		    }
			else
				lexToken(theChar);
				currentTokenIndex++; //Within a line
				nextTokenIndex++; //Within a line
				position++;
			}
		else
			return;
		}
		
	}
	
	/*Only executes if character is valid for grammar
	  Modularizes code for easier readability
	*/  
	function lexToken(token)
	{
	/*
		if(token.value == '$') //The EOF symbol is not really token. However, treating it like one makes lexing easier
		{
			//EOF symbol at last spot of line, last line of code(lineNum === codeLines.length && length of last ele in codeLines
			if(lineNum !== codeLines.length - 1) //$ not at end of file (CLEAN THIS UP)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You no haz dollar sign at end of code. You iz very wrong");
					return;
				}
				putMessage("Warning: End of file denoter not found at end of file. Everything following the symbol will be ignored.");
				tokenStream.push(token);
			}
			else
			{
				tokenStream.push(token);
			}
		}
		/*
		if(token.value == '\n') //New line
		{
			lineNum++;
			//token.type = "whitespace";
			//tokenStream.push(token); //Do we push new line?
		}
		*/
		if(validDigit.test(token.value) == true) //0 through 9
		{
			var isDigit = codeLine[nextTokenIndex]; //Even I can't tell why I must do this
			if(validDigit.test(isDigit) && !inCharList) //My lexer is a bit more stringent in that it will throw an error if a non-char is in a char list
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + nextTokenIndex + " : Ur statement haz number that iz too big");
					totalErrors++;
					//nextTokenIndex -= 2; //Erase earlier change
					return;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + nextTokenIndex + ": Invalid digit found; digits can only be between 0 and 9 inclusive.");
				totalErrors++;
				//nextTokenIndex -= 2; //Erase earlier change
				
			}
			else
			{
				token.type = "digit";
				token.value = parseInt(token.value);
				tokenStream.push(token);
				//tokenTracer--;
			}
			/*
			check = getNextLToken();
			if(validWhiteSpace.test(check.value) !== true && check.value !== ")") //Only one digit numbers are allowed (nothing >= 10)
			{
				putMessage("Error at line " + lineNum + ", lineIndex " + check.currentTokenIndex + ": Invalid number found.");
				totalErrors++;
			}
			*/
		}
		
		else if(validAlpha.test(token.value) == true) //a through z
		{
		
		  if(token.value === "i" || token.value === "p" || token.value === "s" || token.value === "w" || token.value === "b" || token.value === "t" || token.value === "f" ) //Beginning of non-terminals
		  {
			if(inCharList)
			{
				token.type = "char";
				token.value = token.value.toString();
				tokenStream.push(token);
				return;
			}
			var isType = peekToComplete(token); //Check to see if keyword or idenitifier (separate into int, print, string checkers?)
			if(!isType)
			{
				token.type = "char";
				token.value = token.value.toString();
				tokenStream.push(token);
			}
			//Or check for valid id here?
			//if(getNextToken != validWhiteSpace)
			   
		  }
			
		  else //Any other character
		  {
			token.type = "char";
			token.value = token.value.toString();
			tokenStream.push(token);
			
		  }
		}
		else if (token.value == '+' || token.value == '-') //Plus or minus sign
		{
			token.type = "op";
			token.value = token.value.toString();
			tokenStream.push(token);
		}
		
		
		else if (token.value == 'P') //Print function (Deprecated as of Project 2)
		{
			token.type = "print";
			tokenStream.push(token);
		}
		
		
		else if(token.value == '"') //Quotation mark
		{
			if(inCharList) 
			{
				inCharList = false;
				token.type = "quotes";
				token.value = token.value.toString();
				tokenStream.push(token);
				return;
			}	
			inCharList = true;
			token.type = "quotes";
			token.value = token.value.toString();
			tokenStream.push(token);
		}
		
		
		else if(token.value == " ") //Whitespace
		{
			//Nothing. because whitespace are not tokens
			//currentTokenIndex--;
			//nextTokenIndex--;
			if(inCharList) //Spaces are allowed inside CharList as of Project 2
			{
				token.type = "space";
				token.value = token.value.toString();
				tokenStream.push(token);
			}
		}
		
		
		else if(token.value == "$") //EOF meta-token
		{
			token.type = "eof"; 
			token.value = token.value.toString();
			tokenStream.push(token);
			foundEOF = true;
		
		}
		
		else if(token.value == "=") //Can be assignment or first sign of equality check
		{
			var isEquality = getNextLToken();
			if(isEquality.value == "=")
			{
				token.type = "equality";
				token.value = token.value.toString() + isEquality.value.toString();
				tokenStream.push(token);
			}
			else
			{
				token.type = "assign";
				token.value = token.value.toString();
				tokenStream.push(token); 
				currentTokenIndex--; //To move back to the item following the equal sign
				nextTokenIndex--; //Can't skip a token completely
			}
		}
		
		else //Special characters
		{
			token.type = "special";
			token.value = token.value.toString();
			tokenStream.push(token);
		}
		
	}
	
	//Used if current token is 'i' or 'c' to detect presence of 'int' or 'char'
	function peekToComplete(token)
	{
		var temp = "";
		if (token.value == 'i') //Possible declaration of 'int'
		{
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false;  //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp == "if")
			{
				var newToken = new Token();
				newToken.type = "control";
				newToken.value = temp;
				tokenStream.push(newToken);
				return true;
			}
			else if(temp !== "in" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + secondChar.currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}	
				putMessage("Error at line " + lineNum + ", lineIndex " + secondChar.currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(validInt.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + secondChar.currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + thirdChar.currentTokenIndex + ": Invalid word found."); 
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "typeID";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 1; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 2;
			//tokenTracer += 3;
			position += 4; //Magic number?
			//var piece1 = codeLine.substring(0, currentTokenIndex);
			//var piece2 = codeLine.substring(nextTokenIndex + 1);
			//codeLine = piece2;
			//call tokenize here?
			return true;
			
		}
		else if(token.value === "c")//Possible declaration of 'char' (Deprecated as of Project 2)
		{
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "ch" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "cha")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(validChar.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "typeID";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			position += 5; //Magic number?
			//var piece2 = codeLine.substring(nextTokenIndex + 1);
			//codeLine = piece2;
			return true;
		}
		else if(token.value === "t")//Possible declaration of 'true'
		{
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "tr" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "tru")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(validTrue.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "bool";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			position += 5; //Magic number?
			//var piece2 = codeLine.substring(nextTokenIndex + 1);
			//codeLine = piece2;
			return true;
		}
		else if(token.value === "f")//Possible declaration of 'false'
		{
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "fa" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "fal")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(temp !== "fals")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fifthChar = getNextLToken();
			temp += fifthChar.value;
			if(validFalse.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "bool";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			//var piece2 = codeLine.substring(nextTokenIndex);
			//codeLine = piece2;
			return true;
		}
		else if(token.value === "w")//Possible declaration of 'while'
		{
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "wh" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "whi")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(temp !== "whil")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fifthChar = getNextLToken();
			temp += fifthChar.value;
			if(validWhile.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "control";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			//var piece2 = codeLine.substring(nextTokenIndex);
			//codeLine = piece2;
			return true;
		}
		else if(token.value === "p")//Possible declaration of 'print'
		{
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "pr" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "pri")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(temp !== "prin")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fifthChar = getNextLToken();
			temp += fifthChar.value;
			if(validPrint.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "print";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			//var piece2 = codeLine.substring(nextTokenIndex);
			//codeLine = piece2;
			return true;
		}
		else if(token.value === "s")//Possible declaration of 'string'
		{
		
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "st" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "str")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(temp !== "stri")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fifthChar = getNextLToken();
			temp += fifthChar.value;
			if(temp !== "strin")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			sixthChar = getNextLToken();
			temp += sixthChar.value;
			if(validString.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "typeID";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			//var piece2 = codeLine.substring(nextTokenIndex + 1);
			//codeLine = piece2;
			return true;
		}
		else if(token.value === "b")//Possible declaration of 'boolean'
		{
		
			temp += token.value;
			secondChar = getNextLToken();
			temp += secondChar.value;
			if(!validAlpha.test(secondChar.value) || typeof secondChar.value === "undefined")
			{
				return false; //It is only an ID, let the main lex token take care of pushing it into token stream
			}
			if(temp !== "bo" && validWhiteSpace.test(secondChar.value) !== true) //Check for possible valid id as well
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			thirdChar = getNextLToken();
			temp += thirdChar.value;
			if(temp !== "boo")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fourthChar = getNextLToken();
			temp += fourthChar.value;
			if(temp !== "bool")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			fifthChar = getNextLToken();
			temp += fifthChar.value;
			if(temp !== "boole")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			sixthChar = getNextLToken();
			temp += sixthChar.value;
			if(temp !== "boolea")
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			seventhChar = getNextLToken();
			temp += seventhChar.value;
			if(validBoolean.test(temp) !== true)
			{
				if(document.getElementById("mode").checked == true)
				{
					putMessage("You haz errorz at line " + lineNum + " index " + currentTokenIndex + " : Ur statement haz word that iz incorrect");
					totalErrors++;
					return false;
				}
				putMessage("Error at line " + lineNum + ", lineIndex " + currentTokenIndex + ": Invalid word found.");
				totalErrors++;
				return false;
			}
			var newToken = new Token();
			newToken.type = "typeID";
			newToken.value = temp;
			tokenStream.push(newToken);
			//currentTokenIndex += 2; //Need to skip over the space between the type and (possible) ID
			//nextTokenIndex += 3;
			//tokenTracer += 4;
			//var piece2 = codeLine.substring(nextTokenIndex + 1);
			//codeLine = piece2;
			return true;
		}
	}
	
	//Grabs the next character in the source code
	function getNextLToken()
	{
		var token = new Token();
		token.value = codeLine[nextTokenIndex];
		currentTokenIndex++;
		nextTokenIndex++;
		return token;
	}
	
	//The way my lexer is currently set up, after it detects the 'i' and pushes 'int' to the stream, it also pushes the 'n' and the 't' as separate tokens
	//(Likewise for the 'tring' in string and 'rint' in print) This function gets rid of those letters
	//Now obsolete due to reworking tokenize
	function tidyTS()
	{
		for(var k = 0; k < tokenStream.length; k++)
		{
			if(tokenStream[k].value === 'if')
			{
				tokenStream.splice(k+1, 1);
			}
			if(tokenStream[k].value === 'int')
			{
				tokenStream.splice(k+1, 2);
			}
			
			if(tokenStream[k].value === 'char' || tokenStream[k].value === 'true') //Char deprecated as of Project 2
			{
				tokenStream.splice(k+1, 3);
			}
			
			if(tokenStream[k].value === 'print' || tokenStream[k].value === 'false' || tokenStream[k].value === 'while')
			{
				tokenStream.splice(k+1, 5);
			}
			
			if(tokenStream[k].value === 'string')
			{
				tokenStream.splice(k+1, 6);
			}
			if(tokenStream[k].value === 'boolean')
			{
				tokenStream.splice(k+1, 7);
			}
		}
		
		return tokenStream;
	}
	/*
	function getNextToken()
    {
        var thisToken = EOF;    // Let's assume that we're at the EOF.
        if (tokenIndex < tokens.length)
        {
            // If we're not at EOF, then return the next token in the stream and advance the index.
            thisToken = tokens[tokenIndex];
            putMessage("Current token:" + thisToken);
            tokenIndex++;
        }
        return thisToken;
    }
	*/

